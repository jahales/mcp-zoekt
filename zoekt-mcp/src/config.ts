import type { LogLevel } from './logger.js';

/**
 * MCP Server Configuration
 */
export interface McpServerConfig {
  zoektUrl: string;
  transport: 'stdio' | 'http';
  port: number | undefined;
  host: string | undefined;
  logLevel: LogLevel;
  timeoutMs: number;
}

/**
 * Parse command line arguments and environment variables to build config
 */
export function loadConfig(args: string[]): McpServerConfig {
  // Track which values were explicitly set via CLI
  let transportSet = false;
  let logLevelSet = false;
  let timeoutSet = false;

  const config: Partial<McpServerConfig> = {};

  // Parse CLI arguments (highest priority)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--url':
        if (nextArg) config.zoektUrl = nextArg;
        i++;
        break;
      case '--transport':
        if (nextArg === 'stdio' || nextArg === 'http') {
          config.transport = nextArg;
          transportSet = true;
        }
        i++;
        break;
      case '--port':
        config.port = parseInt(nextArg ?? '3000', 10);
        i++;
        break;
      case '--host':
        if (nextArg) config.host = nextArg;
        i++;
        break;
      case '--log-level':
        if (['debug', 'info', 'warn', 'error'].includes(nextArg ?? '')) {
          config.logLevel = nextArg as LogLevel;
          logLevelSet = true;
        }
        i++;
        break;
      case '--debug':
        config.logLevel = 'debug';
        logLevelSet = true;
        break;
      case '--timeout':
        config.timeoutMs = parseInt(nextArg ?? '30000', 10);
        timeoutSet = true;
        i++;
        break;
    }
  }

  // Fall back to environment variables (only if CLI didn't set)
  if (!config.zoektUrl && process.env['ZOEKT_URL']) {
    config.zoektUrl = process.env['ZOEKT_URL'];
  }
  if (!transportSet && (process.env['MCP_TRANSPORT'] === 'stdio' || process.env['MCP_TRANSPORT'] === 'http')) {
    config.transport = process.env['MCP_TRANSPORT'];
  }
  if (config.port === undefined && process.env['MCP_PORT']) {
    config.port = parseInt(process.env['MCP_PORT'], 10);
  }
  if (config.host === undefined && process.env['MCP_HOST']) {
    config.host = process.env['MCP_HOST'];
  }
  if (!logLevelSet && process.env['LOG_LEVEL'] && ['debug', 'info', 'warn', 'error'].includes(process.env['LOG_LEVEL'])) {
    config.logLevel = process.env['LOG_LEVEL'] as LogLevel;
  }
  if (!timeoutSet && process.env['ZOEKT_TIMEOUT_MS']) {
    config.timeoutMs = parseInt(process.env['ZOEKT_TIMEOUT_MS'], 10);
  }

  // Apply defaults (lowest priority)
  config.transport = config.transport ?? 'stdio';
  config.logLevel = config.logLevel ?? 'info';
  config.timeoutMs = config.timeoutMs ?? 30000;

  // Validate required fields
  if (!config.zoektUrl) {
    throw new Error('Zoekt URL is required. Use --url flag or ZOEKT_URL environment variable.');
  }

  return config as McpServerConfig;
}
