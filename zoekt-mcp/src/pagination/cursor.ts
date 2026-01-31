/**
 * Stateless pagination cursor implementation
 * 
 * Cursors encode query hash + offset for stateless pagination.
 * They never expire but are only valid for the same query.
 */

import { createHash } from 'crypto';

/** Decoded cursor structure */
export interface DecodedCursor {
  /** SHA-256 hash of the query string */
  queryHash: string;
  /** Number of results already returned */
  offset: number;
  /** Page size */
  limit: number;
}

/** Cursor validation result */
export interface CursorValidation {
  valid: boolean;
  error?: string;
  cursor?: DecodedCursor;
}

/**
 * Encode a pagination cursor as a base64 string
 * 
 * @param query - The search query string
 * @param offset - Number of results already returned
 * @param limit - Page size
 * @returns Base64-encoded cursor string
 */
export function encodeCursor(query: string, offset: number, limit: number): string {
  const queryHash = hashQuery(query);
  const json = JSON.stringify({ q: queryHash, o: offset, l: limit });
  return Buffer.from(json).toString('base64');
}

/**
 * Decode a pagination cursor from a base64 string
 * 
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor or null if invalid
 */
export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const data = JSON.parse(json) as { q?: string; o?: number; l?: number };
    
    if (typeof data.q !== 'string' || 
        typeof data.o !== 'number' || 
        typeof data.l !== 'number') {
      return null;
    }

    return {
      queryHash: data.q,
      offset: data.o,
      limit: data.l,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a cursor against the current query
 * 
 * @param cursor - Base64-encoded cursor string
 * @param query - Current search query to validate against
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Validation result with decoded cursor if valid
 */
export function validateCursor(
  cursor: string,
  query: string,
  maxLimit: number = 100
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

  if (decoded.limit < 1 || decoded.limit > maxLimit) {
    return { valid: false, error: `Invalid cursor: limit must be 1-${maxLimit}` };
  }

  return { valid: true, cursor: decoded };
}

/**
 * Create a hash of the query string for cursor validation
 */
export function hashQuery(query: string): string {
  return createHash('sha256').update(query).digest('hex').substring(0, 16);
}

/**
 * Calculate if there are more results and generate nextCursor
 * 
 * @param query - The search query
 * @param currentOffset - Current offset (results already returned)
 * @param limit - Page size
 * @param totalResults - Total number of results available
 * @returns Next cursor string or undefined if no more results
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
  return encodeCursor(query, nextOffset, limit);
}
