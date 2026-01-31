/**
 * search_files tool implementation
 * 
 * Searches for files by filename pattern across repositories.
 * Uses Zoekt's type:filename query mode to match only file paths.
 */

import type { ZoektClient } from '../zoekt/client.js';
import type { Logger } from '../logger.js';
import type { FileMatch } from '../zoekt/types.js';
import { validateCursor, generateNextCursor } from '../pagination/cursor.js';
import { enhanceError, formatStructuredError } from '../errors/codes.js';

/** Default result limit for pagination */
const DEFAULT_LIMIT = 30;

/**
 * Wraps a query with type:filename for file search.
 * Preserves existing filters (lang:, repo:, etc.) and adds type:filename.
 * 
 * @example
 * wrapFilenameQuery('package.json') -> 'type:filename package.json'
 * wrapFilenameQuery('config repo:myrepo') -> 'type:filename config repo:myrepo'
 * wrapFilenameQuery('type:filename test') -> 'type:filename test' (unchanged)
 */
export function wrapFilenameQuery(query: string): string {
  const trimmedQuery = query.trim();
  
  // Already has type:filename or type:file prefix - return as is
  if (trimmedQuery.startsWith('type:filename') || trimmedQuery.startsWith('type:file')) {
    return trimmedQuery;
  }
  
  // Add type:filename prefix
  return `type:filename ${trimmedQuery}`;
}

/**
 * File result with metadata only (no content)
 */
export interface FileResult {
  fileName: string;
  repository: string;
  branches: string[];
  language?: string;
}

/**
 * Extract file information from Zoekt FileMatch results.
 * Returns only metadata, not content.
 */
export function extractFiles(fileMatches: FileMatch[]): FileResult[] {
  return fileMatches.map(match => {
    const result: FileResult = {
      fileName: match.FileName,
      repository: match.Repository ?? match.Repo ?? 'Unknown',
      branches: match.Branches ?? [],
    };
    
    if (match.Language) {
      result.language = match.Language;
    }
    
    return result;
  });
}

/**
 * Format files as markdown output.
 */
function formatFileResults(
  query: string,
  files: FileResult[],
  stats: { matchCount: number; fileCount: number; durationMs: number },
  nextCursor?: string
): string {
  let output = `## File Search Results: \`${query}\`\n\n`;
  
  if (files.length === 0) {
    output += 'No files found matching your query.\n';
    return output;
  }
  
  output += `Found ${files.length} files (${stats.durationMs.toFixed(0)}ms)\n\n`;
  
  // Group by repository
  const byRepo = new Map<string, FileResult[]>();
  for (const file of files) {
    const existing = byRepo.get(file.repository) ?? [];
    existing.push(file);
    byRepo.set(file.repository, existing);
  }
  
  for (const [repo, repoFiles] of byRepo) {
    output += `### ${repo}\n\n`;
    
    for (const file of repoFiles) {
      const langInfo = file.language ? ` (${file.language})` : '';
      const branchInfo = file.branches.length > 0 ? ` [${file.branches[0]}]` : '';
      output += `- 📄 \`${file.fileName}\`${langInfo}${branchInfo}\n`;
    }
    
    output += '\n';
  }
  
  if (nextCursor) {
    output += `---\n\n`;
    output += `📄 More results available. Use cursor: \`${nextCursor}\`\n`;
  }
  
  return output;
}

/**
 * Handler input type
 */
export interface SearchFilesInput {
  query: string;
  limit?: number;
  cursor?: string | undefined;
}

/**
 * Handler result type (compatible with MCP tool response)
 */
export interface SearchFilesResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Create the search_files handler function.
 */
export function createSearchFilesHandler(
  client: ZoektClient,
  logger: Logger
): (input: SearchFilesInput) => Promise<SearchFilesResult> {
  return async ({ query, limit = DEFAULT_LIMIT, cursor }) => {
    const startTime = Date.now();
    const wrappedQuery = wrapFilenameQuery(query);
    
    logger.info({ query, wrappedQuery, limit, cursor }, 'search_files request');
    
    // Validate cursor if provided
    let offset = 0;
    if (cursor) {
      const validation = validateCursor(cursor, wrappedQuery, limit);
      if (!validation.valid) {
        return {
          content: [{ type: 'text' as const, text: `**Error**: ${validation.error}` }],
          isError: true,
        };
      }
      offset = validation.cursor?.offset ?? 0;
    }
    
    try {
      // Request extra results for pagination detection
      // For file search, contextLines doesn't apply
      const requestLimit = limit + offset + 1;
      const response = await client.search(wrappedQuery, { limit: requestLimit, contextLines: 0 });
      
      const duration = Date.now() - startTime;
      const fileMatches = response.result?.FileMatches ?? [];
      const zoektStats = response.result?.Stats;
      
      // Extract files
      const allFiles = extractFiles(fileMatches);
      
      // Apply pagination
      const paginatedFiles = allFiles.slice(offset, offset + limit);
      const hasMore = allFiles.length > offset + limit;
      
      const stats = {
        matchCount: zoektStats?.MatchCount ?? allFiles.length,
        fileCount: zoektStats?.FileCount ?? fileMatches.length,
        durationMs: duration,
      };
      
      logger.info(
        { query: wrappedQuery, duration, fileCount: paginatedFiles.length, hasMore },
        'search_files complete'
      );
      
      // Generate next cursor if more results available
      const nextCursor = hasMore
        ? generateNextCursor(wrappedQuery, offset, limit, allFiles.length)
        : undefined;
      
      const formattedResults = formatFileResults(query, paginatedFiles, stats, nextCursor);
      
      return {
        content: [{ type: 'text' as const, text: formattedResults }],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ query: wrappedQuery, duration, error }, 'search_files error');
      
      const structuredError = enhanceError(error);
      const errorText = formatStructuredError(structuredError);
      
      return {
        content: [{ type: 'text' as const, text: errorText }],
        isError: true,
      };
    }
  };
}
