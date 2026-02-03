/**
 * search_symbols tool implementation
 * 
 * Searches for symbol names (functions, classes, methods) across repositories.
 * Uses Zoekt's sym: query prefix to match symbols indexed by ctags.
 */

import type { ZoektClient } from '../zoekt/client.js';
import type { Logger } from '../logger.js';
import type { FileMatch, Symbol, SymbolKind } from '../zoekt/types.js';
import { validateCursor, generateNextCursor } from '../pagination/cursor.js';
import { enhanceError, formatStructuredError } from '../errors/codes.js';

/** Default result limit for pagination */
const DEFAULT_LIMIT = 30;

/** Default context lines for search results */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * Known Zoekt query operators that should not be prefixed with sym:
 */
const QUERY_OPERATORS = [
  'lang:', 'language:',
  'repo:', 'r:',
  'file:', 'f:',
  'branch:', 'b:',
  'case:', 'c:',
  'content:',
  'sym:', 'type:',
  'archived:',
];

/**
 * Wraps a query with sym: prefix for symbol search.
 * Preserves existing filters (lang:, repo:, etc.) and adds sym: to the search term.
 * 
 * @example
 * wrapSymbolQuery('handleRequest') -> 'sym:handleRequest'
 * wrapSymbolQuery('handler lang:typescript') -> 'sym:handler lang:typescript'
 * wrapSymbolQuery('sym:handler') -> 'sym:handler' (unchanged)
 */
export function wrapSymbolQuery(query: string): string {
  const trimmedQuery = query.trim();
  
  // Already has sym: prefix - return as is
  if (trimmedQuery.startsWith('sym:')) {
    return trimmedQuery;
  }
  
  // Split into tokens
  const tokens = trimmedQuery.split(/\s+/);
  const searchTerms: string[] = [];
  const filters: string[] = [];
  
  for (const token of tokens) {
    // Check if this is an operator
    const isOperator = QUERY_OPERATORS.some(op => token.toLowerCase().startsWith(op.toLowerCase()));
    
    if (isOperator) {
      filters.push(token);
    } else {
      searchTerms.push(token);
    }
  }
  
  // If we have search terms, wrap them with sym:
  if (searchTerms.length > 0) {
    const symQuery = `sym:${searchTerms.join(' ')}`;
    return filters.length > 0 ? `${symQuery} ${filters.join(' ')}` : symQuery;
  }
  
  // No search terms, just filters - add sym: prefix anyway
  return `sym:${trimmedQuery}`;
}

/**
 * Normalizes Zoekt symbol kind to our enum.
 */
function normalizeKind(kind: string): SymbolKind {
  const normalized = kind.toLowerCase();
  
  switch (normalized) {
    case 'function':
    case 'func':
    case 'def':
      return 'function';
    case 'class':
      return 'class';
    case 'method':
    case 'member':
      return 'method';
    case 'variable':
    case 'var':
    case 'let':
    case 'const':
      return 'variable';
    case 'interface':
      return 'interface';
    case 'type':
    case 'typedef':
    case 'typealias':
      return 'type';
    case 'constant':
    case 'enum':
    case 'enumerator':
      return 'constant';
    case 'property':
    case 'field':
      return 'property';
    default:
      return 'unknown';
  }
}

/**
 * Extract symbols from Zoekt FileMatch results.
 * Looks for SymbolInfo in ChunkMatches and builds Symbol objects.
 */
export function extractSymbols(fileMatches: FileMatch[]): Symbol[] {
  const symbols: Symbol[] = [];
  
  for (const fileMatch of fileMatches) {
    const repository = fileMatch.Repository ?? fileMatch.Repo ?? 'Unknown';
    const fileName = fileMatch.FileName;
    
    if (!fileMatch.ChunkMatches) {
      continue;
    }
    
    for (const chunk of fileMatch.ChunkMatches) {
      if (!chunk.SymbolInfo || chunk.SymbolInfo.length === 0) {
        continue;
      }
      
      // SymbolInfo array is aligned with Ranges array
      for (let i = 0; i < chunk.SymbolInfo.length; i++) {
        const symInfo = chunk.SymbolInfo[i];
        if (!symInfo) {
          continue;  // Skip null entries
        }
        
        const range = chunk.Ranges[i];
        const lineNumber = range?.Start?.LineNumber ?? chunk.ContentStart.LineNumber;
        const column = range?.Start?.Column ?? chunk.ContentStart.Column;
        
        const symbol: Symbol = {
          name: symInfo.Sym,
          kind: normalizeKind(symInfo.Kind),
          file: fileName,
          repository,
          line: lineNumber,
          column,
        };
        
        // Add parent info if present
        if (symInfo.Parent && symInfo.Parent.length > 0) {
          symbol.parent = symInfo.Parent;
          symbol.parentKind = normalizeKind(symInfo.ParentKind);
        }
        
        symbols.push(symbol);
      }
    }
  }
  
  return symbols;
}

/**
 * Format symbols as markdown output.
 */
function formatSymbolResults(
  query: string,
  symbols: Symbol[],
  stats: { matchCount: number; fileCount: number; durationMs: number },
  nextCursor?: string
): string {
  let output = `## Symbol Search Results: \`${query}\`\n\n`;
  
  if (symbols.length === 0) {
    output += 'No symbols found matching your query.\n';
    return output;
  }
  
  output += `Found ${symbols.length} symbols in ${stats.fileCount} files (${stats.durationMs.toFixed(0)}ms)\n\n`;
  
  // Group by repository
  const byRepo = new Map<string, Symbol[]>();
  for (const symbol of symbols) {
    const existing = byRepo.get(symbol.repository) ?? [];
    existing.push(symbol);
    byRepo.set(symbol.repository, existing);
  }
  
  for (const [repo, repoSymbols] of byRepo) {
    output += `### ${repo}\n\n`;
    
    for (const sym of repoSymbols) {
      const parentInfo = sym.parent ? ` (in ${sym.parentKind ?? 'unknown'} \`${sym.parent}\`)` : '';
      output += `- **${sym.kind}** \`${sym.name}\`${parentInfo}\n`;
      output += `  📁 ${sym.file}:${sym.line}:${sym.column}\n`;
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
export interface SearchSymbolsInput {
  query: string;
  limit?: number;
  contextLines?: number;
  cursor?: string | undefined;
}

/**
 * Handler result type (compatible with MCP tool response)
 */
export interface SearchSymbolsResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Create the search_symbols handler function.
 */
export function createSearchSymbolsHandler(
  client: ZoektClient,
  logger: Logger
): (input: SearchSymbolsInput) => Promise<SearchSymbolsResult> {
  return async ({ query, limit = DEFAULT_LIMIT, contextLines = DEFAULT_CONTEXT_LINES, cursor }) => {
    const startTime = Date.now();
    const wrappedQuery = wrapSymbolQuery(query);
    
    logger.info({ query, wrappedQuery, limit, contextLines, cursor }, 'search_symbols request');
    
    // Validate cursor if provided
    let offset = 0;
    if (cursor) {
      const validation = validateCursor(cursor, wrappedQuery);
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
      const requestLimit = limit + offset + 1;
      const response = await client.search(wrappedQuery, { limit: requestLimit, contextLines });
      
      const duration = Date.now() - startTime;
      const fileMatches = response.result?.FileMatches ?? [];
      const zoektStats = response.result?.Stats;
      
      // Extract symbols
      const allSymbols = extractSymbols(fileMatches);
      
      // Apply pagination
      const paginatedSymbols = allSymbols.slice(offset, offset + limit);
      const hasMore = allSymbols.length > offset + limit;
      
      const stats = {
        matchCount: zoektStats?.MatchCount ?? allSymbols.length,
        fileCount: zoektStats?.FileCount ?? fileMatches.length,
        durationMs: duration,
      };
      
      logger.info(
        { query: wrappedQuery, duration, symbolCount: paginatedSymbols.length, hasMore },
        'search_symbols complete'
      );
      
      // Generate next cursor if more results available
      const nextCursor = hasMore
        ? generateNextCursor(wrappedQuery, offset, limit, allSymbols.length)
        : undefined;
      
      const formattedResults = formatSymbolResults(query, paginatedSymbols, stats, nextCursor);
      
      return {
        content: [{ type: 'text' as const, text: formattedResults }],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ query: wrappedQuery, duration, error }, 'search_symbols error');
      
      const structuredError = enhanceError(error);
      const errorText = formatStructuredError(structuredError);
      
      return {
        content: [{ type: 'text' as const, text: errorText }],
        isError: true,
      };
    }
  };
}
