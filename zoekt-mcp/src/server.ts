import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { McpServerConfig } from './config.js';
import type { Logger } from './logger.js';
import { ZoektClient, ZoektError } from './zoekt/client.js';

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
