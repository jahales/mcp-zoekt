/**
 * search tool implementation
 *
 * Full-text and regex code search across indexed repositories using Zoekt
 * query syntax. Returns matching file chunks with surrounding context,
 * paginated by file match so large result sets can be walked with a cursor.
 */

import type { ZoektClient } from '../zoekt/client.js';
import type { Logger } from '../logger.js';
import type { FileMatch, SearchStats } from '../zoekt/types.js';
import { validateCursor, generateNextCursor } from '../pagination/cursor.js';
import { enhanceError, formatStructuredError } from '../errors/codes.js';

/** Default result limit for pagination */
const DEFAULT_LIMIT = 30;

/** Default context lines for search results */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * Decode base64 content from Zoekt response
 */
export function decodeBase64(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return encoded; // Return as-is if not base64
  }
}

/**
 * Format search results as readable text.
 */
export function formatSearchResults(
  query: string,
  fileMatches: FileMatch[],
  stats?: SearchStats,
  nextCursor?: string
): string {
  let output = `## Results for: \`${query}\`\n\n`;

  for (const match of fileMatches) {
    const repoName = match.Repo ?? match.Repository ?? 'Unknown';
    output += `### ${repoName} - ${match.FileName}\n`;
    output += `Language: ${match.Language || 'Unknown'} | Branch: ${match.Branches?.[0] || 'HEAD'}\n\n`;

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

  if (nextCursor) {
    output += `\n---\n\n`;
    output += `📄 More results available. Use cursor: \`${nextCursor}\`\n`;
  }

  return output;
}

/**
 * Handler input type
 */
export interface SearchInput {
  query: string;
  limit?: number;
  contextLines?: number;
  cursor?: string | undefined;
}

/**
 * Handler result type (compatible with MCP tool response)
 */
export interface SearchResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Create the search handler function.
 */
export function createSearchHandler(
  client: ZoektClient,
  logger: Logger
): (input: SearchInput) => Promise<SearchResult> {
  return async ({ query, limit = DEFAULT_LIMIT, contextLines = DEFAULT_CONTEXT_LINES, cursor }) => {
    const startTime = Date.now();

    logger.info({ query, limit, contextLines, cursor }, 'search request');

    // Validate cursor if provided
    let offset = 0;
    if (cursor) {
      const validation = validateCursor(cursor, query);
      if (!validation.valid) {
        return {
          content: [{ type: 'text' as const, text: `**Error**: ${validation.error}` }],
          isError: true,
        };
      }
      offset = validation.cursor?.offset ?? 0;
    }

    try {
      // Request extra file matches so we can detect whether more pages exist.
      const requestLimit = limit + offset + 1;
      const response = await client.search(query, { limit: requestLimit, contextLines });
      const duration = Date.now() - startTime;

      const fileMatches = response.result?.FileMatches ?? [];
      const stats = response.result?.Stats;

      // Apply pagination (offset is measured in file matches)
      const paginated = fileMatches.slice(offset, offset + limit);
      const hasMore = fileMatches.length > offset + limit;

      logger.info(
        { query, duration, matchCount: stats?.MatchCount ?? 0, fileCount: paginated.length, hasMore },
        'search complete'
      );

      if (paginated.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `## Results for: \`${query}\`\n\nNo matches found.` }],
        };
      }

      const nextCursor = hasMore
        ? generateNextCursor(query, offset, limit, fileMatches.length)
        : undefined;

      const formattedResults = formatSearchResults(query, paginated, stats, nextCursor);
      return {
        content: [{ type: 'text' as const, text: formattedResults }],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ query, duration, err: error }, 'search error');

      const structuredError = enhanceError(error);
      return {
        content: [{ type: 'text' as const, text: formatStructuredError(structuredError) }],
        isError: true,
      };
    }
  };
}
