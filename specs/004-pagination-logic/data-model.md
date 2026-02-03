# Data Model: Pagination Logic

**Feature**: 004-pagination-logic  
**Date**: February 3, 2026  
**Status**: Complete

## Entities

### Cursor (Modified)

The pagination cursor encodes position information for stateless pagination.

**Current Structure** (to be changed):
```typescript
interface DecodedCursor {
  queryHash: string;  // SHA-256 hash of query (first 16 chars)
  offset: number;     // Number of results already returned
  limit: number;      // Page size (TO BE REMOVED)
}
```

**New Structure**:
```typescript
interface DecodedCursor {
  queryHash: string;  // SHA-256 hash of query (first 16 chars)
  offset: number;     // Number of results already returned
}
```

**Encoding**: Base64-encoded JSON  
**Validation Rules**:
- `queryHash` must match current query's hash
- `offset` must be >= 0

---

### CursorValidation

Result of cursor validation.

```typescript
interface CursorValidation {
  valid: boolean;
  error?: string;        // Human-readable error message
  cursor?: DecodedCursor;  // Decoded cursor if valid
}
```

---

### Page

Conceptual entity representing a page of results.

| Field | Type | Description |
|-------|------|-------------|
| items | Item[] | The results for this page |
| offset | number | Starting position in full result set |
| limit | number | Maximum items requested |
| hasMore | boolean | Whether more pages exist |
| nextCursor | string? | Cursor for next page (if hasMore) |

---

### Item (Abstract)

The granular result unit. Concrete types vary by tool:

| Tool | Item Type | Extracted From |
|------|-----------|----------------|
| search_symbols | Symbol | FileMatch.ChunkMatches.SymbolInfo |
| search_files | FileResult | FileMatch (one per file) |
| find_references | Reference | FileMatch.ChunkMatches (with sym: or content match) |

---

## State Transitions

### Pagination State Machine

```
[Initial Request]
       |
       v
  ┌─────────────────────┐
  │   No Cursor         │
  │   offset = 0        │
  └─────────┬───────────┘
            │
            v
  ┌─────────────────────┐     hasMore = false
  │   Fetch Results     │──────────────────────► [End - No Cursor]
  │   slice(offset,     │
  │     offset+limit)   │
  └─────────┬───────────┘
            │ hasMore = true
            v
  ┌─────────────────────┐
  │   Generate Cursor   │
  │   nextOffset =      │
  │     offset + limit  │
  └─────────┬───────────┘
            │
            v
  ┌─────────────────────┐
  │   Return with       │
  │   nextCursor        │
  └─────────────────────┘
            │
            │ [Next Request with cursor]
            v
  ┌─────────────────────┐
  │   Validate Cursor   │──── invalid ────► [Error Response]
  │   Extract offset    │
  └─────────┬───────────┘
            │ valid
            v
       [Fetch Results] (loop)
```

---

## Relationships

```
Query ─────► generates ─────► Cursor
                                │
                                │ encodes
                                v
                         queryHash + offset
                                │
                                │ used by
                                v
               ┌────────────────┼────────────────┐
               │                │                │
               v                v                v
        search_symbols   search_files   find_references
               │                │                │
               v                v                v
            Symbol[]       FileResult[]     Reference[]
```

---

## Validation Rules

### Cursor Validation

| Rule | Error Message | HTTP Status |
|------|---------------|-------------|
| Invalid base64 | "Invalid cursor format" | 400 |
| Invalid JSON structure | "Invalid cursor format" | 400 |
| Query hash mismatch | "Cursor does not match current query" | 400 |
| Negative offset | "Invalid cursor: negative offset" | 400 |

### Limit Validation (Zod Schema)

| Rule | Constraint | Enforced By |
|------|------------|-------------|
| Minimum | limit >= 1 | Zod schema |
| Maximum | limit <= 100 | Zod schema |
| Default | limit = 30 | Zod schema |
| Integer | Must be integer | Zod schema |

---

## Migration Notes

### Cursor Format Change

**Old format**: `{"q":"hash","o":30,"l":30}` → base64  
**New format**: `{"q":"hash","o":30}` → base64

**Backward compatibility**: None required. Old cursors will fail with "Invalid cursor format" which is acceptable for transient session data.

**Decoder change**: `decodeCursor()` should accept both formats during transition:
- If `l` (limit) is present, ignore it
- Only require `q` (queryHash) and `o` (offset)
