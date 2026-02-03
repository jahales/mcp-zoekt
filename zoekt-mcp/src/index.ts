#!/usr/bin/env node

import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createMcpServer, startServer } from './server.js';

async function main(): Promise<void> {
  // Parse arguments (skip node and script path)
  const args = process.argv.slice(2);

  // Handle --help
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Handle --version
  if (args.includes('--version') || args.includes('-v')) {
    console.log('zoekt-mcp v1.0.0');
    process.exit(0);
  }

  try {
    // Load configuration
    const config = loadConfig(args);
    
    // Create logger
    const logger = createLogger(config.logLevel);
    logger.debug({ config }, 'Configuration loaded');

    // Create and start server
    const server = createMcpServer(config, logger);
    
    // Handle graceful shutdown
    const shutdown = async (): Promise<void> => {
      logger.info('Shutting down...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start the server
    await startServer(server, config, logger);
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
zoekt-mcp - MCP server for Zoekt code search

USAGE:
  zoekt-mcp --url <zoekt-url> [options]

OPTIONS:
  --url <url>           Zoekt webserver URL (required)
                        Can also use ZOEKT_URL environment variable
  
  --transport <type>    Transport type: 'stdio' or 'http' (default: stdio)
  --port <port>         HTTP server port (default: 3000, only for http transport)
  --host <host>         HTTP server host (default: 0.0.0.0, only for http transport)
  
  --log-level <level>   Log level: debug, info, warn, error (default: info)
  --debug               Shorthand for --log-level debug
  
  --timeout <ms>        Request timeout in milliseconds (default: 30000)
  
  --help, -h            Show this help message
  --version, -v         Show version number

EXAMPLES:
  # Start with stdio transport (for local MCP clients)
  zoekt-mcp --url http://localhost:6070

  # Start with HTTP/SSE transport (for remote access)
  zoekt-mcp --url http://localhost:6070 --transport http --port 3001

  # Start with debug logging
  zoekt-mcp --url http://localhost:6070 --debug

  # Using environment variables (Docker)
  ZOEKT_URL=http://zoekt-webserver:6070 MCP_TRANSPORT=http MCP_PORT=3001 zoekt-mcp

AVAILABLE TOOLS:
  search        Search code across indexed repositories
  list_repos    List all indexed repositories
  file_content  Retrieve file contents from a repository
`);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
