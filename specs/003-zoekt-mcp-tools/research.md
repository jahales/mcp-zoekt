# Research: Zoekt MCP Tools Enhancement

**Date**: 2026-01-31  
**Spec**: [spec.md](./spec.md)

## Overview

This document captures research findings for implementing new Zoekt MCP tools. All technical unknowns from the plan have been resolved.

---

## 1. Zoekt Symbol Search API

### Decision
Use Zoekt's `sym:` query prefix to search for symbols. Symbol information is returned in `ChunkMatch.SymbolInfo` or `LineFragmentMatch.SymbolInfo` arrays.

### Rationale
- Zoekt natively supports symbol search via ctags integration
- The `sym:` prefix filters results to symbol definitions only
- Symbol metadata (kind, parent) is included in the response

### API Details

**Query Syntax:**
```
sym:MyFunction              # Search for symbol named MyFunction
sym:handler lang:typescript # Symbol + language filter
sym:/handle.*/              # Regex symbol search
```

**Response Structure (from `api.go`):**
```go
type Symbol struct {
    Sym        string  // Symbol name (e.g., "handleRequest")
    Kind       string  // Symbol type: function, class, method, variable
    Parent     string  // Parent symbol name (e.g., "UserService")
    ParentKind string  // Parent type (e.g., "class")
}
```

Symbol info is attached to:
- `ChunkMatch.SymbolInfo []*Symbol` - array aligned with `Ranges`
- `LineFragmentMatch.SymbolInfo *Symbol` - single symbol per fragment

### Alternatives Considered
- Custom ctags parsing on MCP side: Rejected as Zoekt already handles this
- Separate symbol index: Rejected as Zoekt's integrated approach is simpler

---

## 2. Zoekt File Search API

### Decision
Use `type:filename` or `file:` query prefix for file-only searches.

### Rationale
- `type:filename` changes result type to return only matching filenames (no content)
- `file:` filters by path pattern within content searches
- For pure filename search, `type:filename` is more efficient

### API Details

**Query Syntax:**
```
type:filename package.json       # Files named package.json
type:filename .*\.test\.ts$      # Regex for test files
file:src/.*\.go                  # Files in src/ with .go extension
```

**Result Differences:**
- `type:filename`: Returns `FileMatch` with only `FileName`, `Repository`, `Branches`
- `file:` filter: Returns full `FileMatch` with content but filtered by path

### Alternatives Considered
- Client-side filtering: Rejected as Zoekt handles this more efficiently server-side

---

## 3. Zoekt Health Check Endpoint

### Decision
Use Zoekt's `/healthz` endpoint for backend health verification.

### Rationale
- Native endpoint that performs a minimal search to verify the server is operational
- Returns JSON with search result (used to confirm connectivity)
- HTTP 200 = healthy, HTTP 500 = not ready

### API Details

**Endpoint:** `GET /healthz`

**Response (healthy):**
```json
{
  "result": {
    "Stats": {
      "MatchCount": 1,
      "FileCount": 1,
      "Duration": 12345,
      ...
    }
  }
}
```

**Response (unhealthy):** HTTP 500 with error message

### Statistics Endpoint
For repository counts and index stats, query `type:repo` and examine the RepoStats structure:

```go
type RepoStats struct {
    Repos        int    // Number of repositories
    Shards       int    // Number of search shards
    Documents    int    // Number of indexed files
    IndexBytes   int64  // RAM for index overhead
    ContentBytes int64  // RAM for raw content
}
```

### Alternatives Considered
- Custom ping endpoint: Rejected as `/healthz` already exists
- Just checking HTTP connectivity: Rejected as it doesn't verify search functionality

---

## 4. Stateless Cursor-Based Pagination

### Decision
Implement stateless cursors encoding query hash + offset. Zoekt supports offset-based pagination via `num` (limit) parameter; we add client-side offset tracking.

### Rationale
- Zoekt doesn't have native cursor support, but accepts `num` limit parameter
- Stateless cursors avoid server-side session storage
- Query hash ensures cursor is only valid for the same query

### Implementation Design

**Cursor Format (base64-encoded JSON):**
```json
{
  "q": "sha256-hash-of-query",
  "o": 50,  // offset (number of results already seen)
  "l": 50   // limit per page
}
```

**Pagination Flow:**
1. First request: `limit=50`, no cursor
2. Response includes 50 results + `nextCursor` if more exist
3. Next request: same query + `cursor` from previous response
4. Server decodes cursor, fetches `offset + limit` results, returns slice

**Consistency Model:**
- Eventual consistency: if index updates between pages, results may shift
- Documented behavior: users accept this trade-off for stateless simplicity

### Alternatives Considered
- Server-side cursor storage: Rejected per constitution (complexity, state management)
- Keyset pagination: Rejected as Zoekt doesn't support `after:id` semantics
- Skip pagination: This IS the approach, just encoded in cursors

---

## 5. Find References Implementation

### Decision
Combine `sym:` (definitions) and content search (usages) in a single tool response.

### Rationale
- Users want to see both where a symbol is defined AND where it's used
- Zoekt can do both searches efficiently
- Single tool reduces API surface area

### Implementation Design

**Algorithm:**
1. Execute `sym:{symbol}` to find definitions
2. Execute content search for `{symbol}` to find usages
3. Deduplicate (remove definition locations from usage results)
4. Label each result: `definition` or `usage`

**Response Structure:**
```typescript
{
  definitions: [{ file, line, column, context, repository }],
  usages: [{ file, line, column, context, repository }],
  stats: { definitionCount, usageCount, duration }
}
```

### Limitations
- Content search for usages may include false positives (string literals, comments)
- Consider future enhancement: add `lang:` auto-filter based on definition language

### Alternatives Considered
- Separate tools (find_definitions, find_usages): Rejected for simplicity
- Only symbol search: Rejected as it misses usage sites

---

## 6. Error Message Enhancement

### Decision
Parse Zoekt error responses and provide structured errors with codes, messages, and hints.

### Rationale
- Constitution requires actionable error messages (Principle V)
- Common errors can be detected and enhanced with hints

### Error Categories

| Error Type | Detection | Hint |
|------------|-----------|------|
| Invalid regex | Error contains "regexp" or "parse" | Show correct regex syntax |
| Unknown field | Error contains "unknown" | List valid fields |
| Timeout | AbortError or timeout error | Suggest narrowing query |
| Unavailable | Network/connection error | Check server status |
| Not found | 404 or no results | Suggest alternative queries |

### Implementation
```typescript
function enhanceError(error: Error): StructuredError {
  if (error.message.includes('regexp')) {
    return {
      code: 'QUERY_ERROR',
      message: error.message,
      hint: 'Check regex syntax. Use /pattern/ for regex, "text" for literal.'
    };
  }
  // ... more patterns
}
```

### Alternatives Considered
- Pass-through Zoekt errors: Rejected as they lack context
- Error classification ML: Overkill for known error patterns

---

## Summary

All NEEDS CLARIFICATION items from the Technical Context have been resolved:

| Item | Resolution |
|------|------------|
| Symbol API format | `sym:` prefix, Symbol struct in SymbolInfo arrays |
| File search API | `type:filename` for filename-only results |
| Health endpoint | `/healthz` + RepoStats from `type:repo` query |
| Pagination mechanism | Stateless cursors with query hash + offset |
| Reference finding | Combined sym: + content search with dedup |
| Error enhancement | Pattern matching on Zoekt errors |

**Next Step:** Proceed to Phase 1 (data-model.md, contracts/, quickstart.md)
