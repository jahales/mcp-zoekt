# Code Review: 005 — Zoekt List API Migration

**Reviewer**: Automated (speckit.review)  
**Branch**: `005-zoekt-list-api`  
**Scope**: 6 modified source/test files in `zoekt-mcp/`  
**Date**: 2025-07-16

---

## Summary

This changeset migrates `listRepos()` and `getStats()` from the Zoekt `/api/search` endpoint (which caps results via `MaxDocDisplayCount`) to the purpose-built `POST /api/list` endpoint, fixing the critical bug where only 5–7 repositories appeared instead of ~1,100. It also enriches the `Repository` type with per-repo metadata (branches with SHAs, document count, content size, symbol availability, index timestamp) and adds shard count to health statistics.

All 169 unit tests pass. Zero type errors. No new lint errors introduced.

---

## Specification Compliance

| Requirement | Status | Notes |
|---|---|---|
| **FR-001**: `listRepos()` calls `POST /api/list` | ✅ PASS | `/api/list` with `{ Q: "" }` body |
| **FR-002**: No artificial cap on result count | ✅ PASS | Full `List.Repos[]` iterated |
| **FR-003**: Extract from `RepoList.Repos[].Repository` and `Stats` | ✅ PASS | All fields mapped correctly |
| **FR-004**: `getStats()` uses `RepoList.Stats` | ✅ PASS | Aggregate stats from `List.Stats` |
| **FR-005**: Correct `repositoryCount`, `documentCount`, byte sizes | ✅ PASS | Maps `Stats.Repos`, `Stats.Documents`, `Stats.IndexBytes`, `Stats.ContentBytes` |
| **FR-006**: Per-repo metadata (branches+SHAs, docCount, symbols, indexTime) | ✅ PASS | Enriched `Repository` type + `formatRepoList()` |
| **FR-007**: Regex filtering preserved | ✅ PASS | Client-side `RegExp(filter, 'i')` with upfront validation |
| **FR-008**: `IndexStats.shardCount` | ✅ PASS | From `Stats.Shards` |
| **FR-009**: Readable markdown output | ✅ PASS | Numbered list with bold names, branch@SHA, symbol indicator |
| **FR-010**: Error handling preserved | ⚠️ PARTIAL | `listRepos()` correctly handles `DOMException/AbortError` → TIMEOUT; `getStats()` does not (see SF-01) |
| **FR-011**: Invalid regex → clear error | ✅ PASS | Validated upfront, throws `QUERY_ERROR` |

| Success Criteria | Status | Notes |
|---|---|---|
| **SC-001**: Correct total repo count | ✅ PASS | No cap — returns full `List.Repos[]` |
| **SC-002**: Health stats match backend aggregates | ✅ PASS | Direct mapping from `RepoList.Stats` |
| **SC-003**: No response time regression | ✅ PASS | `/api/list` is metadata-only (no content search) |
| **SC-004**: All existing tests pass | ✅ PASS | 169/169 |
| **SC-005**: Per-repo enriched output | ✅ PASS | Name, branches@SHA, docCount, symbols, indexDate |
| **SC-006**: Shard count in health output | ✅ PASS | "Shards" row in health table |

---

## Test Coverage

| Test File | Tests | Status | Notes |
|---|---|---|---|
| `zoekt-client.test.ts` | 14 | ✅ PASS | 2 updated (search→list mocks), 6 new tests (null repos, null branches, Go zero dates, invalid regex, aggregate stats, shardCount) |
| `get-health.test.ts` | updated | ✅ PASS | Mocks include `shardCount`, assertion for "shards" row |
| `list-repos-tool.test.ts` | 7 | ⚠️ STALE | Tests pass but validate **old** format — see SF-02 |
| Integration tests | — | N/A | Not run (requires live Zoekt backend) |

---

## Automated Checks

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ Zero errors |
| `npm run lint` | ✅ No new errors (1 pre-existing: `RequestInit` no-undef at `client.ts:245`) |
| `npm run test` | ✅ 169/169 pass, 12 test files |

---

## Findings

### Blockers

*None.*

### Should Fix (SF)

#### SF-01: `getStats()` missing timeout detection

**File**: [client.ts](zoekt-mcp/src/zoekt/client.ts#L316-L331)  
**Severity**: Should Fix  
**Spec**: FR-010 — "All existing error handling behavior (timeout, backend unreachable, query error) MUST be preserved for both `listRepos()` and `getStats()`."

`listRepos()` correctly detects `DOMException/AbortError` and throws `ZoektError` with code `'TIMEOUT'`. `getStats()` does not — if the `/api/list` call times out, the abort error falls through to the generic catch and is thrown as `'UNAVAILABLE'` instead of `'TIMEOUT'`.

**Fix**: Add the same `DOMException/AbortError` check to `getStats()`:

```typescript
} catch (error) {
  if (error instanceof ZoektError) {
    throw error;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new ZoektError(
      `Get stats timed out after ${this.timeoutMs}ms.`,
      'TIMEOUT'
    );
  }
  throw new ZoektError(
    `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
    'UNAVAILABLE'
  );
}
```

---

#### SF-02: `list-repos-tool.test.ts` tests stale format

**File**: [list-repos-tool.test.ts](zoekt-mcp/tests/unit/list-repos-tool.test.ts#L85-L99)  
**Severity**: Should Fix

This file has a **local** `formatRepoList()` function with the old type signature `Array<{ name: string; branches: string[] }>`. It does not import from `server.ts`. The tests pass because they are self-contained, but they validate the **old** output format (`repo.branches.join(', ')`) — not the new enriched format with `Branch[]`, document counts, symbol indicators, and index dates.

The actual `formatRepoList()` in `server.ts` is effectively **untested** by this file.

**Fix**: Either:
1. Rewrite `list-repos-tool.test.ts` to import and test the real `formatRepoList()` from `server.ts`, or
2. Update the local helper to match the new type signature and expected format, or
3. Delete the formatting tests here and add them to a dedicated `server.test.ts`

---

### Suggestions (SG)

#### SG-01: Null-safe access for `data.List.Stats` in `getStats()`

**File**: [client.ts](zoekt-mcp/src/zoekt/client.ts#L312)

`listRepos()` uses `data.List?.Repos ?? []` (null-safe), but `getStats()` uses `data.List.Stats` without optional chaining. If the backend returns an unexpected shape, this throws a `TypeError` (caught as `UNAVAILABLE`, not a crash — but slightly misleading). For consistency:

```typescript
const stats = data.List?.Stats;
if (!stats) {
  throw new ZoektError('Unexpected response: missing stats', 'QUERY_ERROR');
}
```

#### SG-02: `getStats()` error message could include `baseUrl`

**File**: [client.ts](zoekt-mcp/src/zoekt/client.ts#L328)

`listRepos()` includes `baseUrl` in its UNAVAILABLE error for debuggability:
> `Search backend unavailable at ${this.baseUrl}. Ensure zoekt-webserver is running.`

`getStats()` uses a generic message:
> `Failed to get stats: ${error.message}`

Consider aligning the error message format for consistency.

---

### Nits

#### N-01: `parseGoDate()` could be documented inline

**File**: [client.ts](zoekt-mcp/src/zoekt/client.ts#L1-L15)

The Go zero-value detection (`year <= 1`) is correct but non-obvious to future maintainers unfamiliar with Go's `time.Time`. A one-line comment like `// Go's zero-value for time.Time serializes as 0001-01-01T00:00:00Z` would help.

#### N-02: Pre-existing lint error in `client.ts:245`

`RequestInit` is flagged as `no-undef` — this is a DOM type available in Node.js 18+ but not recognized by the ESLint config. Not caused by this PR.

---

## Architecture & Design Assessment

- **Correct approach**: Using `/api/list` is the purpose-built endpoint for repo enumeration. The migration is architecturally sound.
- **Client-side filtering**: Regex filtering applied after fetching all repos is consistent with existing behavior and avoids coupling to Zoekt's query syntax for the `repo:` atom.
- **Type safety**: Wire types (`Zoekt*`) are cleanly separated from domain types (`Repository`, `Branch`, `IndexStats`). Mapping handles nullable fields defensively.
- **YAGNI compliance**: `listRepos()` and `getStats()` are kept as separate methods despite both calling `/api/list`. This matches the task spec and avoids premature abstraction.
- **Breaking change management**: `Repository.branches` changed from `string[]` to `Branch[]` — all consumers in `server.ts` were updated. Search-path `FileMatch.Branches` remains `string[]` (correct — different data flow).

---

## Security Assessment

- No credentials or secrets in the changeset
- No new external inputs beyond existing `filter` parameter (already validated as regex)
- No SQL/command injection vectors — `/api/list` body is hardcoded `{ Q: "" }`
- Regex validation prevents ReDoS via upfront `new RegExp()` check

---

## Performance Assessment

- `/api/list` is a metadata-only operation — no content search, expected to be faster than the previous `/api/search` approach
- No pagination needed — `/api/list` returns all repos in a single response (appropriate for expected index sizes <10K repos)
- Client-side regex filtering iterates the full list once — O(n), acceptable for expected scale

---

## Verdict

### ✅ APPROVED WITH COMMENTS

The implementation correctly migrates from `/api/search` to `/api/list`, fixes the critical bug (Issue #5), and meets 10 of 11 functional requirements fully (FR-010 is partially met). All 169 tests pass, type checking is clean, and no new lint errors are introduced.

**Before merging**, address:
1. **SF-01**: Add timeout detection to `getStats()` for FR-010 compliance
2. **SF-02**: Update `list-repos-tool.test.ts` to test the actual enriched format

Both are straightforward fixes (~10 lines of code each).
