# Pagination API Contracts

**Feature**: 004-pagination-logic  
**Date**: February 3, 2026

## Cursor Module API

### `encodeCursor(query: string, offset: number): string`

Encodes pagination state into an opaque cursor string.

**Parameters**:
- `query`: The search query string (used for hash)
- `offset`: Number of results already returned

**Returns**: Base64-encoded cursor string

**Example**:
```typescript
const cursor = encodeCursor('sym:handleRequest', 30);
// Returns: "eyJxIjoiYWJjZDEyMzQiLCJvIjozMH0="
```

---

### `decodeCursor(cursor: string): DecodedCursor | null`

Decodes a cursor string back to its components.

**Parameters**:
- `cursor`: Base64-encoded cursor string

**Returns**: `DecodedCursor` object or `null` if invalid

**Example**:
```typescript
const decoded = decodeCursor("eyJxIjoiYWJjZDEyMzQiLCJvIjozMH0=");
// Returns: { queryHash: "abcd1234...", offset: 30 }
```

**Backward Compatibility**: Accepts old format with `limit` field (ignores it)

---

### `validateCursor(cursor: string, query: string): CursorValidation`

Validates a cursor against the current query.

**Parameters**:
- `cursor`: Base64-encoded cursor string
- `query`: Current search query to validate against

**Returns**: `CursorValidation` object

**Example**:
```typescript
const result = validateCursor(cursor, 'sym:handleRequest');
// Returns: { valid: true, cursor: { queryHash: "...", offset: 30 } }
// Or: { valid: false, error: "Cursor does not match current query" }
```

**Changes from previous API**:
- Removed `maxLimit` parameter (no longer needed)
- No longer validates limit field

---

### `generateNextCursor(query: string, currentOffset: number, limit: number, totalResults: number): string | undefined`

Generates cursor for next page if more results are available.

**Parameters**:
- `query`: The search query string
- `currentOffset`: Current page's starting offset
- `limit`: Current page size
- `totalResults`: Total number of results available

**Returns**: Cursor string for next page, or `undefined` if no more results

**Example**:
```typescript
const next = generateNextCursor('sym:handleRequest', 0, 30, 100);
// Returns: "eyJxIjoiYWJjZDEyMzQiLCJvIjozMH0=" (offset=30)

const noMore = generateNextCursor('sym:handleRequest', 90, 30, 100);
// Returns: undefined (90 + 30 >= 100)
```

---

## Type Definitions

### DecodedCursor (Updated)

```typescript
interface DecodedCursor {
  /** SHA-256 hash of the query string (first 16 hex chars) */
  queryHash: string;
  /** Number of results already returned */
  offset: number;
}
```

### CursorValidation (Unchanged)

```typescript
interface CursorValidation {
  valid: boolean;
  error?: string;
  cursor?: DecodedCursor;
}
```

---

## Tool Handler Contracts

### Pagination Handler Pattern

All paginated tools follow this contract:

```typescript
interface PaginatedInput {
  query: string;       // Search query
  limit?: number;      // Page size (default: 30, max: 100)
  cursor?: string;     // Pagination cursor from previous response
  // ... tool-specific parameters
}

interface PaginatedOutput {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
```

**Pagination behavior**:
1. If `cursor` is provided, validate it against `query`
2. Extract `offset` from cursor (or use 0 if no cursor)
3. Request `offset + limit + 1` items from Zoekt
4. Extract items from file matches
5. Slice items to `[offset, offset + limit]`
6. If more items exist, generate `nextCursor`
7. Include cursor in formatted output

---

## Error Contracts

### Cursor Validation Errors

| Error | Code | Message |
|-------|------|---------|
| Invalid format | INVALID_CURSOR | "Invalid cursor format" |
| Query mismatch | CURSOR_MISMATCH | "Cursor does not match current query. Cursors are only valid for the same query." |
| Negative offset | INVALID_CURSOR | "Invalid cursor: negative offset" |

### Limit Validation Errors (Zod)

| Error | Trigger | Message |
|-------|---------|---------|
| Below minimum | limit < 1 | "Number must be greater than or equal to 1" |
| Above maximum | limit > 100 | "Number must be less than or equal to 100" |
| Not integer | limit = 1.5 | "Expected integer, received float" |
