# Research: Pagination Logic Evaluation & Fix

**Feature**: 004-pagination-logic  
**Date**: February 3, 2026  
**Status**: Complete

## Research Questions

### 1. Cursor Validation Bug: Why does changing limit between pages fail?

**Investigation**: The `validateCursor()` function accepts a third parameter called `maxLimit` (default: 100). However, the tools call it as:

```typescript
const validation = validateCursor(cursor, wrappedQuery, limit);  // passes current limit as maxLimit
```

The validation then checks:
```typescript
if (decoded.limit < 1 || decoded.limit > maxLimit) {
  return { valid: false, error: `Invalid cursor: limit must be 1-${maxLimit}` };
}
```

**Problem**: The cursor's stored limit (from when it was created) is validated against the current request's limit. If page 1 used `limit=50` and page 2 uses `limit=30`, validation fails because `50 > 30`.

**Decision**: Remove limit from cursor structure entirely. Only `queryHash` and `offset` are needed for pagination.

**Rationale**: The cursor's purpose is to track position (offset) for a specific query. The limit is a per-request parameter that shouldn't be stored in the cursor.

**Alternatives Considered**:
1. Always pass 100 as maxLimit → Masks the bug but doesn't fix the conceptual issue
2. Use cursor's limit instead of request limit → Forces same page size, poor UX
3. **Remove limit from cursor** → Cleanest solution, allows flexible page sizes ✅

---

### 2. Is limit correctly passed to Zoekt?

**Investigation**: Traced the code path:
1. `server.ts` → Tool handler receives `limit` parameter
2. `client.search(query, { limit, contextLines })` → Passes to client
3. `client.ts` → `MaxDocDisplayCount: options.limit ?? 30` → Correctly mapped

**Decision**: No changes needed. Limit is correctly passed to Zoekt.

**Rationale**: The Zoekt API accepts `MaxDocDisplayCount` which limits file matches, and the MCP tools correctly extract items from file matches and apply their own slicing.

---

### 3. How do tools handle more items than files?

**Investigation**: For `search_symbols`, each file may contain multiple symbols. The code:
1. Requests `requestLimit = limit + offset + 1` files from Zoekt
2. Extracts all symbols from those files
3. Slices to `allSymbols.slice(offset, offset + limit)`

**Decision**: Current approach is correct but has a potential edge case: if symbols are sparse (1 per file), we might not get enough symbols from the requested file count.

**Rationale**: The `+1` in `requestLimit` is for has-more detection. For sparse distributions, we'd still return fewer results than requested but with no next cursor (correct behavior).

**Alternatives Considered**:
1. Request more files than needed → Wastes bandwidth, complicates logic
2. **Keep current approach** → Works correctly, may return fewer items in sparse cases ✅
3. Implement multi-fetch with retry → Over-engineered for current use case

---

### 4. Deep pagination efficiency

**Investigation**: Current implementation re-fetches all results up to `offset + limit + 1` on every page. For page 10 with limit=30, this means fetching 301 files.

**Decision**: Accept current behavior for now. Document as future optimization.

**Rationale**: 
- MCP usage patterns favor shallow pagination (pages 1-3)
- Deep pagination is rare in AI assistant workflows
- Zoekt handles large requests efficiently
- Optimization would require server-side cursor state, violating stateless design

**Alternatives Considered**:
1. Server-side pagination state → Violates statelessness, adds complexity
2. Zoekt's streaming API → Different integration pattern, not worth for this use case
3. **Keep current approach** → Acceptable performance, simple implementation ✅

---

### 5. Test coverage gaps

**Investigation**: Current tests cover:
- ✅ Cursor encoding/decoding
- ✅ Query hash matching
- ✅ Negative offset rejection
- ⚠️ Limit validation (tests current bug behavior)
- ❌ Multi-page pagination end-to-end
- ❌ Changing limit between pages
- ❌ Deep pagination performance
- ❌ Edge case: offset > total results
- ❌ Edge case: all results fit on one page

**Decision**: Add comprehensive test suite covering all identified gaps.

**Rationale**: Constitution requires TDD and high test coverage. Current tests don't cover the identified bug or edge cases.

---

## Summary of Decisions

| Area | Decision | Impact |
|------|----------|--------|
| Cursor structure | Remove `limit` field | Breaking change to cursor format |
| Cursor validation | Simplify to only check query hash + offset | Simpler, more flexible |
| Limit handling | Keep current approach | No changes needed |
| Deep pagination | Accept current behavior | Document for future optimization |
| Test coverage | Add comprehensive tests | ~15 new test cases |

## Breaking Change Considerations

Removing `limit` from cursor is a **breaking change** for any existing cursors. However:
- Cursors are transient (used within a single session)
- No persistent cursor storage
- MCP clients generate new cursors for each search session

**Migration**: Old cursors will be rejected with "Invalid cursor format" error. This is acceptable since cursors are session-scoped.
