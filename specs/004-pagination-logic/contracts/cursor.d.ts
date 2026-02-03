/**
 * Pagination Cursor Type Definitions
 * Feature: 004-pagination-logic
 * 
 * These types define the public API contract for pagination cursors.
 * Breaking changes to these types require a major version bump.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Decoded cursor structure.
 * 
 * CHANGE: `limit` field removed in 004-pagination-logic.
 * Cursors no longer store the page size - this is now fully controlled
 * by the current request, allowing users to change page size between requests.
 */
export interface DecodedCursor {
  /** 
   * SHA-256 hash of the query string (first 16 hex characters).
   * Used to validate that cursor matches the current query.
   */
  queryHash: string;

  /**
   * Number of results already returned in previous pages.
   * Zero-indexed offset into the result set.
   */
  offset: number;
}

/**
 * Result of cursor validation.
 */
export interface CursorValidation {
  /** Whether the cursor is valid for the current request */
  valid: boolean;

  /** Human-readable error message if invalid */
  error?: string;

  /** Decoded cursor data if valid */
  cursor?: DecodedCursor;
}

// ============================================================================
// Wire Format (Internal)
// ============================================================================

/**
 * JSON structure encoded in the cursor string.
 * This is the internal wire format - not part of public API.
 * 
 * @internal
 */
export interface CursorPayload {
  /** Query hash (abbreviated key for space efficiency) */
  q: string;

  /** Offset (abbreviated key for space efficiency) */
  o: number;
}

/**
 * Legacy cursor payload that includes limit.
 * Supported for backward compatibility during migration.
 * 
 * @internal
 * @deprecated Will be removed in future version
 */
export interface LegacyCursorPayload extends CursorPayload {
  /** Limit - no longer used, ignored during decode */
  l?: number;
}

// ============================================================================
// Function Signatures
// ============================================================================

/**
 * Encodes pagination state into an opaque cursor string.
 * 
 * @param query - The search query string (will be hashed)
 * @param offset - Number of results already returned
 * @returns Base64-encoded cursor string
 */
export type EncodeCursorFn = (query: string, offset: number) => string;

/**
 * Decodes a cursor string back to its components.
 * 
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor object, or null if malformed
 */
export type DecodeCursorFn = (cursor: string) => DecodedCursor | null;

/**
 * Validates a cursor against the current query.
 * 
 * @param cursor - Base64-encoded cursor string
 * @param query - Current search query to validate against
 * @returns Validation result with error message if invalid
 */
export type ValidateCursorFn = (
  cursor: string,
  query: string
) => CursorValidation;

/**
 * Generates cursor for next page if more results are available.
 * 
 * @param query - The search query string
 * @param currentOffset - Current page's starting offset
 * @param limit - Current page size
 * @param totalResults - Total number of results available
 * @returns Cursor string for next page, or undefined if no more results
 */
export type GenerateNextCursorFn = (
  query: string,
  currentOffset: number,
  limit: number,
  totalResults: number
) => string | undefined;

/**
 * Computes hash of query string for cursor validation.
 * 
 * @param query - Search query string
 * @returns First 16 characters of SHA-256 hex digest
 */
export type HashQueryFn = (query: string) => string;
