import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { randomUUID } from 'crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { z } from 'zod';
import type { McpServerConfig } from './config.js';
import type { Logger } from './logger.js';
import { ZoektClient, ZoektError } from './zoekt/client.js';
import { formatRepoList, formatEmptyResponse } from './formatting/repoList.js';
import { createSearchHandler } from './tools/search.js';
import { createSearchSymbolsHandler } from './tools/search-symbols.js';
import { createSearchFilesHandler } from './tools/search-files.js';
import { createFindReferencesHandler } from './tools/find-references.js';
import { createGetHealthHandler } from './tools/get-health.js';
import { VERSION } from './version.js';

/**
 * Create and configure the MCP server with all tools
 */
export function createMcpServer(
  config: McpServerConfig,
  logger: Logger
): McpServer {
  const server = new McpServer({
    name: 'zoekt-mcp',
    version: VERSION,
  });

  const zoektClient = new ZoektClient(config.zoektUrl, config.timeoutMs);
  const toolLogger = logger.child({ module: 'tools' });

  // Register search tool
  registerSearchTool(server, zoektClient, toolLogger);

  // Register list_repos tool
  registerListReposTool(server, zoektClient, toolLogger);

  // Register file_content tool
  registerFileContentTool(server, zoektClient, toolLogger);

  // Register search_symbols tool
  registerSearchSymbolsTool(server, zoektClient, toolLogger);

  // Register search_files tool
  registerSearchFilesTool(server, zoektClient, toolLogger);

  // Register find_references tool
  registerFindReferencesTool(server, zoektClient, toolLogger);

  // Register get_health tool
  registerGetHealthTool(server, zoektClient, toolLogger);

  return server;
}

/**
 * Register the search tool
 */
function registerSearchTool(
  server: McpServer,
  client: ZoektClient,
  logger: Logger
): void {
  const handler = createSearchHandler(client, logger);

  server.tool(
    'search',
    'Search code across indexed repositories using Zoekt query syntax',
    {
      query: z.string().describe(
        'Zoekt search query. Supports regex, file filters (file:, lang:), repo filters (repo:), symbol search (sym:), and boolean operators (and, or, not).'
      ),
      limit: z.number().int().min(1).max(100).default(30).describe(
        'Maximum number of file matches to return'
      ),
      contextLines: z.number().int().min(0).max(10).default(3).describe(
        'Number of context lines to include around each match'
      ),
      cursor: z.string().optional().describe(
        'Pagination cursor from previous response'
      ),
    },
    async ({ query, limit, contextLines, cursor }) => {
      return handler({ query, limit, contextLines, cursor });
    }
  );
}

/**
 * Register the list_repos tool
 */
function registerListReposTool(
  server: McpServer,
  client: ZoektClient,
  logger: Logger
): void {
  server.tool(
    'list_repos',
    'List all indexed repositories or filter by name pattern',
    {
      filter: z.string().optional().describe(
        'Optional filter pattern to match repository names (regex supported)'
      ),
    },
    async ({ filter }) => {
      const startTime = Date.now();
      logger.info({ filter }, 'list_repos request');

      try {
        const repos = await client.listRepos(filter);
        const duration = Date.now() - startTime;

        logger.info({ filter, duration, count: repos.length }, 'list_repos complete');

        if (repos.length === 0) {
          return {
            content: [{ type: 'text' as const, text: formatEmptyResponse(filter) }],
          };
        }

        const formatted = formatRepoList(repos, filter);
        return {
          content: [{ type: 'text' as const, text: formatted }],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error({ filter, duration, err: error }, 'list_repos error');

        return {
          content: [{ type: 'text' as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the file_content tool
 */
function registerFileContentTool(
  server: McpServer,
  client: ZoektClient,
  logger: Logger
): void {
  server.tool(
    'file_content',
    'Retrieve the full contents of a file from an indexed repository',
    {
      repository: z.string().describe(
        "Full repository name (e.g., 'github.com/org/repo')"
      ),
      path: z.string().describe(
        'Path to the file within the repository'
      ),
      branch: z.string().optional().describe(
        'Branch name (optional, defaults to HEAD or working tree)'
      ),
    },
    async ({ repository, path, branch }) => {
      const startTime = Date.now();
      logger.info({ repository, path, branch }, 'file_content request');

      try {
        const content = await client.getFileContent(repository, path, branch);
        const duration = Date.now() - startTime;

        logger.info({ repository, path, branch, duration, size: content.length }, 'file_content complete');

        const language = detectLanguage(path);
        const formatted = formatFileContent(repository, path, branch, content, language);
        return {
          content: [{ type: 'text' as const, text: formatted }],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error({ repository, path, branch, duration, err: error }, 'file_content error');

        return {
          content: [{ type: 'text' as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Register the search_symbols tool
 */
function registerSearchSymbolsTool(
  server: McpServer,
  client: ZoektClient,
  logger: Logger
): void {
  const handler = createSearchSymbolsHandler(client, logger);

  server.tool(
    'search_symbols',
    'Search for symbol names (functions, classes, methods, variables) across indexed repositories. Automatically uses Zoekt sym: query prefix.',
    {
      query: z.string().describe(
        `Symbol search query. Examples:
  - handleRequest - Find symbols named "handleRequest"
  - /^get.*/ - Symbols starting with "get" (regex)
  - handler lang:typescript - TypeScript symbols matching "handler"
  - UserService repo:myorg/myrepo - Symbol in specific repo`
      ),
      limit: z.number().int().min(1).max(100).default(30).describe(
        'Maximum number of symbols to return'
      ),
      contextLines: z.number().int().min(0).max(10).default(3).describe(
        'Number of context lines to include around each match'
      ),
      cursor: z.string().optional().describe(
        'Pagination cursor from previous response'
      ),
    },
    async ({ query, limit, contextLines, cursor }) => {
      return handler({ query, limit, contextLines, cursor });
    }
  );
}

/**
 * Register the search_files tool
 */
function registerSearchFilesTool(
  server: McpServer,
  client: ZoektClient,
  logger: Logger
): void {
  const handler = createSearchFilesHandler(client, logger);

  server.tool(
    'search_files',
    'Search for files by filename pattern across indexed repositories. Returns file paths only, not content.',
    {
      query: z.string().describe(
        `File name search query. Examples:
  - package.json - Exact filename match
  - /.*\\.test\\.ts$/ - TypeScript test files (regex)
  - README.md repo:myorg/myrepo - README in specific repo
  - config lang:yaml - YAML config files`
      ),
      limit: z.number().int().min(1).max(100).default(30).describe(
        'Maximum number of files to return'
      ),
      cursor: z.string().optional().describe(
        'Pagination cursor from previous response'
      ),
    },
    async ({ query, limit, cursor }) => {
      return handler({ query, limit, cursor });
    }
  );
}

/**
 * Register the find_references tool
 */
function registerFindReferencesTool(
  server: McpServer,
  client: ZoektClient,
  logger: Logger
): void {
  const handler = createFindReferencesHandler(client, logger);

  server.tool(
    'find_references',
    'Find all definitions and usages of a symbol across indexed repositories. Returns both where the symbol is defined and where it is used.',
    {
      symbol: z.string().describe(
        `Symbol to find references for. Examples:
  - handleRequest - Find all references to "handleRequest"
  - UserService - Find class definition and usages
  - validateInput - Find function definition and call sites`
      ),
      filters: z.string().optional().describe(
        `Additional query filters. Examples:
  - lang:typescript - Limit to TypeScript files
  - repo:myorg/myrepo - Limit to specific repository
  - lang:go repo:backend - Multiple filters`
      ),
      limit: z.number().int().min(1).max(100).default(30).describe(
        'Maximum number of references to return'
      ),
      contextLines: z.number().int().min(0).max(10).default(3).describe(
        'Number of context lines to include around each match'
      ),
      cursor: z.string().optional().describe(
        'Pagination cursor from previous response'
      ),
    },
    async ({ symbol, filters, limit, contextLines, cursor }) => {
      return handler({ symbol, filters, limit, contextLines, cursor });
    }
  );
}

/**
 * Register the get_health tool
 */
function registerGetHealthTool(
  server: McpServer,
  client: ZoektClient,
  logger: Logger
): void {
  const handler = createGetHealthHandler(client, logger);

  server.tool(
    'get_health',
    'Check health status of the MCP server and Zoekt backend. Returns connectivity status, server version, and index statistics.',
    {
      // No parameters required
    },
    async () => {
      return handler({});
    }
  );
}

// formatSearchResults and decodeBase64 now live in './tools/search.js'.
// formatRepoList, formatBytesCompact, and formatEmptyResponse are imported from './formatting/repoList.js'

/**
 * Format file content response
 */
function formatFileContent(
  repository: string,
  path: string,
  branch: string | undefined,
  content: string,
  language: string
): string {
  let output = `## ${repository}/${path}\n\n`;
  output += `Branch: ${branch || 'HEAD'}\n\n`;
  output += `\`\`\`${language}\n`;
  output += content;
  if (!content.endsWith('\n')) {
    output += '\n';
  }
  output += `\`\`\`\n`;
  return output;
}

/**
 * Format error for MCP response
 */
function formatError(error: unknown): string {
  if (error instanceof ZoektError) {
    return `Error: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return 'An unknown error occurred';
}

/**
 * Detect language from file extension
 */
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    rb: 'ruby',
    php: 'php',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    xml: 'xml',
    toml: 'toml',
  };
  return languageMap[ext ?? ''] ?? '';
}

/** Handle to a running server, used for graceful shutdown */
export interface RunningServer {
  close(): Promise<void>;
}

/**
 * Start the MCP server with the configured transport.
 *
 * Takes a factory rather than a server instance because the SDK's Protocol
 * supports exactly one transport per server: the HTTP/SSE transport needs a
 * fresh McpServer per client connection.
 */
export async function startServer(
  serverFactory: () => McpServer,
  config: McpServerConfig,
  logger: Logger
): Promise<RunningServer> {
  if (config.transport === 'stdio') {
    const server = serverFactory();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info({ transport: 'stdio' }, 'MCP server started');
    return { close: (): Promise<void> => server.close() };
  }
  // HTTP/SSE transport for remote access
  return startHttpServer(serverFactory, config, logger);
}

/**
 * Start HTTP server with SSE transport for remote MCP access
 */
async function startHttpServer(
  serverFactory: () => McpServer,
  config: McpServerConfig,
  logger: Logger
): Promise<RunningServer> {
  const host = config.host ?? '0.0.0.0';
  const port = config.port ?? 3001;

  const httpLogger = logger.child({ module: 'http' });

  // Track active sessions. Each SSE connection gets its own McpServer because
  // the SDK's Protocol binds to a single transport; sharing one instance would
  // silently detach earlier clients whenever a new one connects.
  const sessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Do not trust the Host header for URL parsing; we only need path + query.
    const url = new URL(req.url ?? '/', 'http://localhost');

    const requestIdHeader = req.headers['x-request-id'];
    const requestIdRaw = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
    const requestIdCandidate = requestIdRaw?.trim();
    const requestId = requestIdCandidate && requestIdCandidate.length <= 128 ? requestIdCandidate : randomUUID();

    const startTime = process.hrtime.bigint();
    const method = req.method ?? 'GET';
    const path = url.pathname;
    const remoteAddress = getClientIp(req);
    const userAgentHeader = req.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

    const reqLogger = httpLogger.child({
      requestId,
      method,
      path,
      ...(remoteAddress ? { remoteAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    });
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    // Allow clients to send an inbound request id and read it back.
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMsRaw = Number(process.hrtime.bigint() - startTime) / 1_000_000;
      const durationMs = Math.round(durationMsRaw * 100) / 100;
      const statusCode = res.statusCode;

      if (statusCode >= 500) {
        reqLogger.error({ statusCode, durationMs }, 'request completed');
      } else if (statusCode >= 400) {
        reqLogger.warn({ statusCode, durationMs }, 'request completed');
      } else {
        reqLogger.info({ statusCode, durationMs }, 'request completed');
      }
    });

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health' && req.method === 'GET') {
      reqLogger.debug({ sessions: sessions.size }, 'health check');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', transport: 'http', sessions: sessions.size }));
      return;
    }

    // SSE endpoint - client connects here for server-sent events
    if (url.pathname === '/sse' && req.method === 'GET') {
      const transport = new SSEServerTransport('/messages', res);
      // Use the transport's own session id: it is the one the client is told
      // to send back as ?sessionId= on /messages posts.
      const sessionId = transport.sessionId;
      const sessionServer = serverFactory();
      const sseLogger = reqLogger.child({ sessionId });
      sessions.set(sessionId, { transport, server: sessionServer });

      sseLogger.info('sse connection opened');

      // Clean up on close
      res.on('close', () => {
        sseLogger.info('sse connection closed');
        sessions.delete(sessionId);
        sessionServer.close().catch((err: unknown) => {
          sseLogger.warn({ err }, 'error closing session server');
        });
      });

      await sessionServer.connect(transport);
      return;
    }

    // Messages endpoint - client posts JSON-RPC messages here
    if (url.pathname === '/messages' && req.method === 'POST') {
      // The SSE endpoint event directs clients to POST to /messages?sessionId=<id>
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing sessionId query parameter' }));
        return;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `No active SSE session for sessionId ${sessionId}` }));
        return;
      }

      const transport = session.transport;
      const sseLogger = reqLogger.child({ sessionId });

      // Collect body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString();

      sseLogger.info({ bodyBytes: body.length }, 'message received');

      try {
        await transport.handlePostMessage(req, res, body);
      } catch (error) {
        sseLogger.error({ err: error }, 'Error handling message');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return;
    }

    // 404 for unknown routes
    reqLogger.warn('route not found');
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return new Promise((resolve, reject) => {
    httpServer.on('error', reject);
    httpServer.listen(port, host, () => {
      logger.info({ transport: 'http', host, port, url: `http://${host}:${port}` }, 'MCP HTTP server started');
      resolve({
        close: async (): Promise<void> => {
          for (const { server: sessionServer } of sessions.values()) {
            await sessionServer.close();
          }
          sessions.clear();
          await new Promise<void>((closeResolve, closeReject) => {
            httpServer.close((err) => (err ? closeReject(err) : closeResolve()));
          });
        },
      });
    });
  });
}

function getClientIp(req: IncomingMessage): string | undefined {
  const forwardedForHeader = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;

  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return req.socket.remoteAddress ?? undefined;
}
