import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { McpServerConfig } from './config.js';
import type { Logger } from './logger.js';
import { ZoektClient, ZoektError } from './zoekt/client.js';
import { createSearchSymbolsHandler } from './tools/search-symbols.js';
import { createSearchFilesHandler } from './tools/search-files.js';
import { createFindReferencesHandler } from './tools/find-references.js';
import { createGetHealthHandler } from './tools/get-health.js';

/**
 * Create and configure the MCP server with all tools
 */
export function createMcpServer(
  config: McpServerConfig,
  logger: Logger
): McpServer {
  const server = new McpServer({
    name: 'zoekt-mcp',
    version: '1.0.0',
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
    },
    async ({ query, limit, contextLines }) => {
      const startTime = Date.now();
      logger.info({ query, limit, contextLines }, 'search request');

      try {
        const response = await client.search(query, { limit, contextLines });
        const duration = Date.now() - startTime;

        const fileMatches = response.result?.FileMatches ?? [];
        const stats = response.result?.Stats;

        logger.info(
          { query, duration, matchCount: stats?.MatchCount ?? 0, fileCount: fileMatches.length },
          'search complete'
        );

        if (fileMatches.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `## Results for: \`${query}\`\n\nNo matches found.` }],
          };
        }

        const formattedResults = formatSearchResults(query, fileMatches, stats);
        return {
          content: [{ type: 'text' as const, text: formattedResults }],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error({ query, duration, error }, 'search error');

        return {
          content: [{ type: 'text' as const, text: formatError(error) }],
          isError: true,
        };
      }
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
          const message = filter
            ? `No repositories found matching '${filter}'.`
            : 'No repositories are currently indexed.';
          return {
            content: [{ type: 'text' as const, text: `## Indexed Repositories\n\n${message}` }],
          };
        }

        const formatted = formatRepoList(repos, filter);
        return {
          content: [{ type: 'text' as const, text: formatted }],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error({ filter, duration, error }, 'list_repos error');

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
      branch: z.string().default('HEAD').describe(
        'Branch name (default: HEAD)'
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
        logger.error({ repository, path, branch, duration, error }, 'file_content error');

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

/**
 * Format search results as readable text
 */
function formatSearchResults(
  query: string,
  fileMatches: Array<{
    Repository?: string;
    Repo?: string;
    FileName: string;
    Branches: string[];
    Language: string;
    ChunkMatches?: Array<{ Content: string; ContentStart: { LineNumber: number } }>;
    LineMatches?: Array<{ Line: string; LineNumber: number }>;
  }>,
  stats?: { MatchCount: number; FileCount: number; Duration: number }
): string {
  let output = `## Results for: \`${query}\`\n\n`;

  for (const match of fileMatches) {
    const repoName = match.Repo ?? match.Repository ?? 'Unknown';
    output += `### ${repoName} - ${match.FileName}\n`;
    output += `Language: ${match.Language || 'Unknown'} | Branch: ${match.Branches[0] || 'HEAD'}\n\n`;

    // Handle ChunkMatches (newer format)
    if (match.ChunkMatches && match.ChunkMatches.length > 0) {
      for (const chunk of match.ChunkMatches) {
        const content = decodeBase64(chunk.Content);
        const startLine = chunk.ContentStart.LineNumber;
        output += `\`\`\`${match.Language?.toLowerCase() || ''}\n`;
        output += content;
        output += `\`\`\`\n`;
        output += `Line ${startLine}\n\n`;
      }
    }
    // Handle LineMatches (older format)
    else if (match.LineMatches && match.LineMatches.length > 0) {
      for (const line of match.LineMatches) {
        const content = decodeBase64(line.Line);
        output += `Line ${line.LineNumber}: ${content.trim()}\n`;
      }
      output += '\n';
    }

    output += '---\n\n';
  }

  if (stats) {
    const durationMs = stats.Duration / 1_000_000; // nanoseconds to ms
    output += `Stats: ${stats.MatchCount} matches in ${stats.FileCount} files (${durationMs.toFixed(0)}ms)\n`;
  }

  return output;
}

/**
 * Format repository list
 */
function formatRepoList(
  repos: Array<{ name: string; branches: string[] }>,
  filter?: string
): string {
  let output = '## Indexed Repositories\n\n';
  
  const filterNote = filter ? ` matching '${filter}'` : '';
  output += `Found ${repos.length} repositories${filterNote}:\n\n`;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    if (repo) {
      const branchList = repo.branches.join(', ');
      output += `${i + 1}. ${repo.name} (${branchList})\n`;
    }
  }

  output += `\nTotal: ${repos.length} repositories\n`;
  return output;
}

/**
 * Format file content response
 */
function formatFileContent(
  repository: string,
  path: string,
  branch: string,
  content: string,
  language: string
): string {
  let output = `## ${repository}/${path}\n\n`;
  output += `Branch: ${branch}\n\n`;
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

/**
 * Decode base64 content from Zoekt response
 */
function decodeBase64(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return encoded; // Return as-is if not base64
  }
}

/**
 * Start the MCP server with the configured transport
 */
export async function startServer(
  server: McpServer,
  config: McpServerConfig,
  logger: Logger
): Promise<void> {
  if (config.transport === 'stdio') {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info({ transport: 'stdio' }, 'MCP server started');
  } else {
    // HTTP transport - not implemented in this version
    throw new Error('HTTP transport not yet implemented');
  }
}
