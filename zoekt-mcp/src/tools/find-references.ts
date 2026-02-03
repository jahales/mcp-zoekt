/**
 * find_references tool implementation
 * 
 * Finds all definitions and usages of a symbol across repositories.
 * Performs two searches:
 * 1. Symbol search (sym:) for definitions
 * 2. Content search for usages
 * Then deduplicates to remove definition locations from usages.
 */

import type { ZoektClient } from '../zoekt/client.js';
import type { Logger } from '../logger.js';
import type { FileMatch, ReferenceResult, Symbol, SymbolKind } from '../zoekt/types.js';
import { validateCursor, generateNextCursor } from '../pagination/cursor.js';
import { enhanceError, formatStructuredError } from '../errors/codes.js';

/** Default result limit for pagination */
const DEFAULT_LIMIT = 30;

/** Default context lines for search results */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * Normalize symbol kind to our enum
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
 * Decode base64 content from Zoekt response
 */
function decodeBase64(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return encoded;
  }
}

/**
 * Extract definitions from symbol search results.
 * These are locations where the symbol is defined (function declaration, class definition, etc.)
 */
export function extractDefinitions(fileMatches: FileMatch[]): ReferenceResult[] {
  const definitions: ReferenceResult[] = [];
  
  for (const fileMatch of fileMatches) {
    const repository = fileMatch.Repository ?? fileMatch.Repo ?? 'Unknown';
    const fileName = fileMatch.FileName;
    
    if (!fileMatch.ChunkMatches) {
      continue;
    }
    
    for (const chunk of fileMatch.ChunkMatches) {
      const context = decodeBase64(chunk.Content);
      
      if (!chunk.SymbolInfo || chunk.SymbolInfo.length === 0) {
        continue;
      }
      
      for (let i = 0; i < chunk.SymbolInfo.length; i++) {
        const symInfo = chunk.SymbolInfo[i];
        if (!symInfo) {
          continue;
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
        
        if (symInfo.Parent && symInfo.Parent.length > 0) {
          symbol.parent = symInfo.Parent;
          symbol.parentKind = normalizeKind(symInfo.ParentKind);
        }
        
        definitions.push({
          type: 'definition',
          file: fileName,
          repository,
          line: lineNumber,
          column,
          context: context.trim(),
          symbol,
        });
      }
    }
  }
  
  return definitions;
}

/**
 * Extract usages from content search results.
 * These are locations where the symbol is used (function calls, variable references, etc.)
 * Handles both ChunkMatches (newer API) and LineMatches (legacy API) formats.
 */
export function extractUsages(fileMatches: FileMatch[]): ReferenceResult[] {
  const usages: ReferenceResult[] = [];
  
  for (const fileMatch of fileMatches) {
    const repository = fileMatch.Repository ?? fileMatch.Repo ?? 'Unknown';
    const fileName = fileMatch.FileName;
    
    // Handle ChunkMatches (newer format)
    if (fileMatch.ChunkMatches) {
      for (const chunk of fileMatch.ChunkMatches) {
        const context = decodeBase64(chunk.Content);
        const lineNumber = chunk.ContentStart.LineNumber;
        const column = chunk.Ranges[0]?.Start?.Column ?? chunk.ContentStart.Column;
        
        usages.push({
          type: 'usage',
          file: fileName,
          repository,
          line: lineNumber,
          column,
          context: context.trim(),
        });
      }
    }
    
    // Handle LineMatches (legacy format from /api/search)
    if (fileMatch.LineMatches) {
      for (const lineMatch of fileMatch.LineMatches) {
        // Skip filename matches
        if (lineMatch.FileName) {
          continue;
        }
        
        const context = decodeBase64(lineMatch.Line);
        const lineNumber = lineMatch.LineNumber;
        const column = lineMatch.LineStart ?? 0;
        
        usages.push({
          type: 'usage',
          file: fileName,
          repository,
          line: lineNumber,
          column,
          context: context.trim(),
        });
      }
    }
  }
  
  return usages;
}

/**
 * Remove definitions from usages list (same file + line + repo = definition location)
 */
export function deduplicateReferences(
  definitions: ReferenceResult[],
  usages: ReferenceResult[]
): ReferenceResult[] {
  const defKeys = new Set(
    definitions.map(d => `${d.repository}:${d.file}:${d.line}`)
  );
  
  return usages.filter(u => !defKeys.has(`${u.repository}:${u.file}:${u.line}`));
}

/**
 * Format references as markdown output.
 */
function formatReferenceResults(
  symbol: string,
  definitions: ReferenceResult[],
  usages: ReferenceResult[],
  stats: { durationMs: number },
  nextCursor?: string
): string {
  let output = `## References for: \`${symbol}\`\n\n`;
  
  if (definitions.length === 0 && usages.length === 0) {
    output += 'No references found matching your query.\n';
    return output;
  }
  
  output += `Found ${definitions.length} definition(s) and ${usages.length} usage(s) (${stats.durationMs.toFixed(0)}ms)\n\n`;
  
  // Definitions section
  if (definitions.length > 0) {
    output += `### Definitions\n\n`;
    
    for (const def of definitions) {
      const symInfo = def.symbol ? ` (${def.symbol.kind})` : '';
      output += `- 📍 **${def.repository}** - \`${def.file}:${def.line}\`${symInfo}\n`;
      output += `  \`\`\`\n  ${def.context}\n  \`\`\`\n\n`;
    }
  }
  
  // Usages section
  if (usages.length > 0) {
    output += `### Usages\n\n`;
    
    // Group by repository
    const byRepo = new Map<string, ReferenceResult[]>();
    for (const usage of usages) {
      const existing = byRepo.get(usage.repository) ?? [];
      existing.push(usage);
      byRepo.set(usage.repository, existing);
    }
    
    for (const [repo, repoUsages] of byRepo) {
      output += `**${repo}**\n\n`;
      
      for (const usage of repoUsages) {
        output += `- \`${usage.file}:${usage.line}\`\n`;
        output += `  \`\`\`\n  ${usage.context}\n  \`\`\`\n\n`;
      }
    }
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
export interface FindReferencesInput {
  symbol: string;
  filters?: string | undefined;
  limit?: number;
  contextLines?: number;
  cursor?: string | undefined;
}

/**
 * Handler result type (compatible with MCP tool response)
 */
export interface FindReferencesResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Create the find_references handler function.
 */
export function createFindReferencesHandler(
  client: ZoektClient,
  logger: Logger
): (input: FindReferencesInput) => Promise<FindReferencesResult> {
  return async ({ symbol, filters, limit = DEFAULT_LIMIT, contextLines = DEFAULT_CONTEXT_LINES, cursor }) => {
    const startTime = Date.now();
    
    // Build queries
    const filterSuffix = filters ? ` ${filters}` : '';
    const definitionQuery = `sym:${symbol}${filterSuffix}`;
    const usageQuery = `${symbol}${filterSuffix}`;
    
    logger.info({ symbol, filters, limit, contextLines, cursor }, 'find_references request');
    
    // Validate cursor if provided
    let offset = 0;
    if (cursor) {
      // For find_references, cursor is based on combined query
      const combinedQuery = `${definitionQuery}|${usageQuery}`;
      const validation = validateCursor(cursor, combinedQuery);
      if (!validation.valid) {
        return {
          content: [{ type: 'text' as const, text: `**Error**: ${validation.error}` }],
          isError: true,
        };
      }
      offset = validation.cursor?.offset ?? 0;
    }
    
    try {
      // Request extra results for pagination
      const requestLimit = limit + offset + 1;
      
      // Perform both searches in parallel
      const [defResponse, usageResponse] = await Promise.all([
        client.search(definitionQuery, { limit: requestLimit, contextLines }),
        client.search(usageQuery, { limit: requestLimit * 2, contextLines }),  // More usages expected
      ]);
      
      const duration = Date.now() - startTime;
      
      // Extract definitions and usages
      const definitions = extractDefinitions(defResponse.result?.FileMatches ?? []);
      const rawUsages = extractUsages(usageResponse.result?.FileMatches ?? []);
      
      // Deduplicate: remove definition locations from usages
      const usages = deduplicateReferences(definitions, rawUsages);
      
      // Apply pagination to combined results
      const allRefs = [...definitions, ...usages];
      const paginatedDefs = definitions.slice(offset, offset + Math.min(limit, definitions.length));
      const remainingLimit = limit - paginatedDefs.length;
      const paginatedUsages = remainingLimit > 0 
        ? usages.slice(0, remainingLimit)
        : [];
      
      const hasMore = allRefs.length > offset + limit;
      
      const stats = { durationMs: duration };
      
      logger.info(
        { symbol, duration, defCount: paginatedDefs.length, usageCount: paginatedUsages.length, hasMore },
        'find_references complete'
      );
      
      // Generate next cursor if more results available
      const nextCursor = hasMore
        ? generateNextCursor(`${definitionQuery}|${usageQuery}`, offset, limit, allRefs.length)
        : undefined;
      
      const formattedResults = formatReferenceResults(
        symbol,
        paginatedDefs,
        paginatedUsages,
        stats,
        nextCursor
      );
      
      return {
        content: [{ type: 'text' as const, text: formattedResults }],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ symbol, duration, error }, 'find_references error');
      
      const structuredError = enhanceError(error);
      const errorText = formatStructuredError(structuredError);
      
      return {
        content: [{ type: 'text' as const, text: errorText }],
        isError: true,
      };
    }
  };
}
