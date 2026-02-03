/**
 * Stateless pagination cursor implementation
 * 
 * Cursors encode query hash + offset for stateless pagination.
 * They never expire but are only valid for the same query.
 * 
 * ## Public API (for tool handlers)
 * - `validateCursor()` - Validate and decode a cursor
 * - `generateNextCursor()` - Generate cursor for next page
 * 
 * ## Internal API (not for external use)
 * - `encodeCursor()` - Internal: encode cursor payload
 * - `decodeCursor()` - Internal: decode cursor payload  
 * - `hashQuery()` - Internal: hash query string
 * 
 * @module pagination/cursor
 */

import { createHash } from 'crypto';

/** Decoded cursor structure */
export interface DecodedCursor {
  /** SHA-256 hash of the query string */
  queryHash: string;
  /** Number of results already returned */
  offset: number;
}

/** Cursor validation result */
export interface CursorValidation {
  valid: boolean;
  error?: string;
  cursor?: DecodedCursor;
}

/**
 * Encode a pagination cursor as a base64 string.
 * 
 * @internal This is an internal function. Use `generateNextCursor()` instead.
 * 
 * @param query - The search query string
 * @param offset - Number of results already returned
 * @returns Base64-encoded cursor string
 * 
 * @deprecated Since v1.1.0 - Use `generateNextCursor()` for cursor generation.
 * This function may be made private in a future version.
 */
export function encodeCursor(query: string, offset: number): string {
  const queryHash = hashQuery(query);
  const json = JSON.stringify({ q: queryHash, o: offset });
  return Buffer.from(json).toString('base64');
}

/**
 * Decode a pagination cursor from a base64 string.
 * Supports legacy cursors that include limit field (ignored).
 * 
 * @internal This is an internal function. Use `validateCursor()` instead.
 * 
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor or null if invalid
 * 
 * @deprecated Since v1.1.0 - Use `validateCursor()` which includes validation.
 * This function may be made private in a future version.
 */
export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const data = JSON.parse(json) as { q?: string; o?: number; l?: number };
    
    if (typeof data.q !== 'string' || 
        typeof data.o !== 'number') {
      return null;
    }

    // Note: data.l (limit) is intentionally ignored for backward compatibility
    return {
      queryHash: data.q,
      offset: data.o,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a cursor against the current query.
 * 
 * This is the primary public API for cursor validation in tool handlers.
 * 
 * @param cursor - Base64-encoded cursor string
 * @param query - Current search query to validate against
 * @returns Validation result with decoded cursor if valid
 * 
 * @example
 * ```typescript
 * const result = validateCursor(cursor, query);
 * if (!result.valid) {
 *   return { error: result.error };
 * }
 * const offset = result.cursor.offset;
 * ```
 */
export function validateCursor(
  cursor: string,
  query: string
): CursorValidation {
  const decoded = decodeCursor(cursor);
  
  if (!decoded) {
    return { valid: false, error: 'Invalid cursor format' };
  }

  const currentHash = hashQuery(query);
  if (decoded.queryHash !== currentHash) {
    return { 
      valid: false, 
      error: 'Cursor does not match current query. Cursors are only valid for the same query.' 
    };
  }

  if (decoded.offset < 0) {
    return { valid: false, error: 'Invalid cursor: negative offset' };
  }

  return { valid: true, cursor: decoded };
}

/**
 * Create a hash of the query string for cursor validation.
 * 
 * @internal This is an internal function.
 * 
 * @deprecated Since v1.1.0 - Internal implementation detail.
 * This function may be made private in a future version.
 */
export function hashQuery(query: string): string {
  return createHash('sha256').update(query).digest('hex').substring(0, 16);
}

/**
 * Calculate if there are more results and generate nextCursor.
 * 
 * This is the primary public API for cursor generation in tool handlers.
 * 
 * @param query - The search query
 * @param currentOffset - Current offset (results already returned)
 * @param limit - Page size
 * @param totalResults - Total number of results available
 * @returns Next cursor string or undefined if no more results
 * 
 * @example
 * ```typescript
 * const nextCursor = generateNextCursor(query, offset, limit, totalItems);
 * // Returns cursor string or undefined if no more pages
 * ```
 */
export function generateNextCursor(
  query: string,
  currentOffset: number,
  limit: number,
  totalResults: number
): string | undefined {
  const nextOffset = currentOffset + limit;
  if (nextOffset >= totalResults) {
    return undefined;
  }
  return encodeCursor(query, nextOffset);
}
