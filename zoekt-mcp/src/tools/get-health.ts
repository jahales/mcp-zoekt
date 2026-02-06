/**
 * get_health tool implementation
 * 
 * Checks MCP server and Zoekt backend health status.
 * Returns overall health state, connectivity, and index statistics.
 */

import type { ZoektClient } from '../zoekt/client.js';
import type { Logger } from '../logger.js';
import type { HealthState, HealthStatus, IndexStats } from '../zoekt/types.js';

/** Server version */
const SERVER_VERSION = '1.0.0';

/**
 * Build HealthStatus from check results
 */
export function buildHealthStatus(
  healthResult: { healthy: boolean; error?: string },
  statsResult: IndexStats | null,
  serverVersion: string
): HealthStatus {
  let status: HealthState;
  
  if (!healthResult.healthy) {
    status = 'unhealthy';
  } else if (statsResult === null) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }
  
  const result: HealthStatus = {
    status,
    serverVersion,
    zoektReachable: healthResult.healthy,
  };
  
  if (statsResult !== null) {
    result.indexStats = statsResult;
  }
  
  if (healthResult.error) {
    result.errorMessage = healthResult.error;
  }
  
  return result;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format number with thousand separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format health status as markdown output.
 */
function formatHealthResults(health: HealthStatus): string {
  const statusEmoji = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌',
  };
  
  let output = `## Health Status: ${statusEmoji[health.status]} ${health.status.toUpperCase()}\n\n`;
  
  output += `| Property | Value |\n`;
  output += `|----------|-------|\n`;
  output += `| MCP Server Version | ${health.serverVersion} |\n`;
  output += `| Zoekt Backend | ${health.zoektReachable ? '✅ Reachable' : '❌ Unreachable'} |\n`;
  
  if (health.indexStats) {
    output += `| Repositories | ${formatNumber(health.indexStats.repositoryCount)} repositories |\n`;
    output += `| Documents | ${formatNumber(health.indexStats.documentCount)} documents |\n`;
    output += `| Shards | ${formatNumber(health.indexStats.shardCount)} shards |\n`;
    output += `| Index Size | ${formatBytes(health.indexStats.indexBytes)} |\n`;
    output += `| Content Size | ${formatBytes(health.indexStats.contentBytes)} |\n`;
  }
  
  output += '\n';
  
  if (health.errorMessage) {
    output += `### Error Details\n\n`;
    output += `\`\`\`\n${health.errorMessage}\n\`\`\`\n`;
  }
  
  return output;
}

/**
 * Handler input type (no parameters)
 */
export interface GetHealthInput {
  // No parameters needed
}

/**
 * Handler result type (compatible with MCP tool response)
 */
export interface GetHealthResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Create the get_health handler function.
 */
export function createGetHealthHandler(
  client: ZoektClient,
  logger: Logger
): (input: GetHealthInput) => Promise<GetHealthResult> {
  return async () => {
    const startTime = Date.now();
    
    logger.info({}, 'get_health request');
    
    try {
      // Perform health check
      const healthResult = await client.checkHealth();
      
      // Try to get stats (may fail if unhealthy)
      let statsResult: IndexStats | null = null;
      if (healthResult.healthy) {
        try {
          statsResult = await client.getStats();
        } catch {
          // Stats unavailable, will result in degraded status
        }
      }
      
      const duration = Date.now() - startTime;
      
      const healthStatus = buildHealthStatus(healthResult, statsResult, SERVER_VERSION);
      
      logger.info(
        { status: healthStatus.status, duration, reachable: healthStatus.zoektReachable },
        'get_health complete'
      );
      
      const formattedResults = formatHealthResults(healthStatus);
      
      return {
        content: [{ type: 'text' as const, text: formattedResults }],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ duration, error }, 'get_health error');
      
      // Even on error, return a health status (unhealthy)
      const healthStatus: HealthStatus = {
        status: 'unhealthy',
        serverVersion: SERVER_VERSION,
        zoektReachable: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
      
      const formattedResults = formatHealthResults(healthStatus);
      
      return {
        content: [{ type: 'text' as const, text: formattedResults }],
      };
    }
  };
}
