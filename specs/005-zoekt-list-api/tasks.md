# Tasks: Zoekt List API Migration

**Input**: Design documents from `/specs/005-zoekt-list-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/zoekt-list-api.md, quickstart.md

**Tests**: Included — existing unit tests must be updated and new getStats tests added per quickstart.md step 6 and SC-004.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1 (bug fixes), US3 is P2 (enrichment), US4 is P3 (minor enhancement).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `zoekt-mcp/src/` for source, `zoekt-mcp/tests/` for tests
- All paths relative to repository root

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this is a modification to an existing project with no new dependencies.

*(No tasks in this phase)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add TypeScript types for the Zoekt `/api/list` response and enrich existing domain types. MUST be complete before any user story implementation.

**⚠️ CRITICAL**: All user stories depend on these type definitions.

- [X] T001 Add Zoekt `/api/list` wire types to `zoekt-mcp/src/zoekt/types.ts`
  - Add `ZoektListResponse` interface: `{ List: ZoektRepoList }`
  - Add `ZoektRepoList` interface: `{ Repos: ZoektRepoListEntry[] | null; Stats: ZoektRepoStats; Crashes: number }`
  - Add `ZoektRepoListEntry` interface: `{ Repository: ZoektRepository; IndexMetadata: ZoektIndexMetadata; Stats: ZoektRepoStats }`
  - Add `ZoektRepository` interface: `{ Name: string; URL: string; Branches: ZoektBranch[] | null; HasSymbols: boolean; LatestCommitDate: string }`
  - Add `ZoektBranch` interface: `{ Name: string; Version: string }`
  - Add `ZoektIndexMetadata` interface: `{ IndexTime: string }`
  - Add `ZoektRepoStats` interface: `{ Repos: number; Shards: number; Documents: number; IndexBytes: number; ContentBytes: number }`
  - Reference: `specs/005-zoekt-list-api/data-model.md` "Zoekt `/api/list` Response Types" section
  - Reference: `specs/005-zoekt-list-api/contracts/zoekt-list-api.md` for field types and semantics

- [X] T002 Enrich existing `Repository`, `Branch`, and `IndexStats` types in `zoekt-mcp/src/zoekt/types.ts`
  - Add new `Branch` interface: `{ name: string; version: string }`
  - Change `Repository.branches` from `string[]` to `Branch[]`
  - Add to `Repository`: `url: string`, `hasSymbols: boolean`, `documentCount: number`, `contentBytes: number`, `indexBytes: number`, `latestCommitDate: Date | undefined`
  - Rename `Repository.fileCount` to `documentCount` (or remove `fileCount` and add `documentCount`)
  - Add `shardCount: number` to `IndexStats`
  - Note: This will cause temporary type errors in `client.ts` and `server.ts` until US1/US2/US3 tasks are completed
  - Reference: `specs/005-zoekt-list-api/data-model.md` "Migration from Current Model" section

**Checkpoint**: All types defined — implementation phases can begin

---

## Phase 3: User Story 1 — Accurate Repository Listing at Scale (Priority: P1) 🎯 MVP

**Goal**: `list_repos` returns ALL indexed repositories regardless of index size, fixing the critical bug where only 5-7 repos appear instead of ~1100.

**Independent Test**: Invoke `list_repos` with no filter against an index with 100+ repositories. Verify every repo appears. Compare count against Zoekt backend directly.

### Implementation for User Story 1

- [X] T003 [US1] Rewrite `listRepos()` method to use `POST /api/list` in `zoekt-mcp/src/zoekt/client.ts`
  - Replace the current `/api/search` call with `POST /api/list` using body `{ Q: "" }`
  - Parse response as `ZoektListResponse` (from T001)
  - Map each `List.Repos[].Repository` + `List.Repos[].Stats` + `List.Repos[].IndexMetadata` → enriched `Repository` object:
    - `name` ← `Repository.Name`
    - `url` ← `Repository.URL`
    - `branches` ← `Repository.Branches?.map(b => ({ name: b.Name, version: b.Version })) ?? []` (handle null Branches)
    - `hasSymbols` ← `Repository.HasSymbols`
    - `documentCount` ← `Stats.Documents`
    - `contentBytes` ← `Stats.ContentBytes`
    - `indexBytes` ← `Stats.IndexBytes`
    - `indexTime` ← parse `IndexMetadata.IndexTime` as Date, treat Go zero-value `0001-01-01` as undefined
    - `latestCommitDate` ← parse `Repository.LatestCommitDate` as Date, treat Go zero-value as undefined
  - Handle `List.Repos` being null (return empty array)
  - Apply client-side regex filter if `filter` parameter provided (preserve existing behavior)
  - Validate regex filter: wrap `new RegExp(filter)` in try/catch, throw `ZoektError` with `QUERY_ERROR` code on invalid pattern
  - Preserve existing error handling: `fetchWithTimeout()`, `ZoektError` codes (UNAVAILABLE, TIMEOUT, QUERY_ERROR)
  - Remove all `/api/search`-specific parsing (FileMatches, RepoURLs extraction)
  - Reference: `specs/005-zoekt-list-api/quickstart.md` Step 2
  - Reference: `specs/005-zoekt-list-api/contracts/zoekt-list-api.md` for response shape

**Checkpoint**: `list_repos` tool now returns complete repository list — core bug is fixed

---

## Phase 4: User Story 2 — Accurate Health Statistics (Priority: P1)

**Goal**: `get_health` reports correct aggregate statistics (repository count, document count, index bytes, content bytes) from Zoekt's authoritative `RepoList.Stats`, not from search I/O counters.

**Independent Test**: Invoke `get_health` and compare reported stats against directly querying Zoekt's `/api/list` endpoint.

### Implementation for User Story 2

- [X] T004 [US2] Rewrite `getStats()` method to use `POST /api/list` in `zoekt-mcp/src/zoekt/client.ts`
  - Replace the current `/api/search` call with `POST /api/list` using body `{ Q: "" }`
  - Parse response as `ZoektListResponse`
  - Extract aggregate stats from `List.Stats`:
    - `repositoryCount` ← `Stats.Repos`
    - `documentCount` ← `Stats.Documents`
    - `indexBytes` ← `Stats.IndexBytes`
    - `contentBytes` ← `Stats.ContentBytes`
    - `shardCount` ← `Stats.Shards`
  - Remove all `/api/search`-specific parsing (counting unique repos from FileMatches, using I/O counters as sizes)
  - Preserve existing error handling: `fetchWithTimeout()`, `ZoektError` codes
  - Note: `listRepos()` and `getStats()` both call `/api/list` but are kept as separate methods — `listRepos` returns per-repo data, `getStats` returns only aggregates. No shared helper needed per YAGNI.
  - Reference: `specs/005-zoekt-list-api/quickstart.md` Step 3

**Checkpoint**: Both core bugs (US1 + US2) are fixed — system reports accurate data

---

## Phase 5: User Story 3 — Enriched Repository Metadata (Priority: P2)

**Goal**: `list_repos` output includes per-repository metadata (branch SHAs, document counts, symbol availability, index freshness) so LLM consumers can make informed decisions about which repos to search.

**Independent Test**: Invoke `list_repos` and verify output includes branch commit SHAs, document counts, symbol availability flag, and index timestamps per repository.

### Implementation for User Story 3

- [X] T005 [P] [US3] Update `formatRepoList()` to display enriched per-repo metadata in `zoekt-mcp/src/server.ts`
  - Update the function to use enriched `Repository` type with `Branch[]` (not `string[]`)
  - New output format per repo (from research.md Task 6):
    ```
    1. **github.com/org/repo** (1,234 files, 10.5 MB)
       Branches: main@abc123f, develop@def456a
       Symbols: ✅ | Indexed: 2026-01-16
    ```
  - Show document count and human-readable content size (bytes → KB/MB/GB)
  - Show branch names with 7-char truncated commit SHAs (`branch@sha7`)
  - Show symbol availability indicator (✅ or ❌)
  - Show index date (formatted as YYYY-MM-DD), omit if undefined
  - Keep the "Found N repositories:" header
  - Handle edge cases: empty branches array, undefined dates, zero document count
  - Reference: `specs/005-zoekt-list-api/research.md` Task 6 for output format

**Checkpoint**: `list_repos` output is now informative and scannable with full metadata

---

## Phase 6: User Story 4 — Shard Count in Health Stats (Priority: P3)

**Goal**: `get_health` includes total shard count in its statistics output for operational monitoring.

**Independent Test**: Invoke `get_health` and verify the statistics section includes a "Shards" row with a value matching Zoekt's actual shard count.

### Implementation for User Story 4

- [X] T006 [P] [US4] Add shard count row to health statistics table in `zoekt-mcp/src/tools/get-health.ts`
  - In `formatHealthResults()` (or equivalent formatter), add a "Shards" row to the statistics table
  - Read `shardCount` from the `IndexStats` object returned by `getStats()`
  - Place the row logically near the other infrastructure metrics (after Documents or after Content Bytes)
  - Reference: `specs/005-zoekt-list-api/quickstart.md` Step 5

**Checkpoint**: All 4 user stories implemented — full feature is complete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Update unit tests to validate new behavior, run full validation suite

- [X] T007 [P] Update `listRepos` unit tests and add `getStats` tests in `zoekt-mcp/tests/unit/zoekt-client.test.ts`
  - Update 2 existing `listRepos` tests: change mock responses from `/api/search` response shape (`Result.Files[]`) to `/api/list` response shape (`List.Repos[]`)
  - Add test: `listRepos` with empty `Repos` array (no repos indexed) → returns empty array
  - Add test: `listRepos` with null `Branches` on a repo → returns repo with empty branches array
  - Add test: `listRepos` with Go zero-value date `0001-01-01T00:00:00Z` → `indexTime` is undefined
  - Add test: `listRepos` with invalid regex filter → throws ZoektError with QUERY_ERROR code
  - Add test: `getStats` returns correct aggregate stats from `List.Stats`
  - Add test: `getStats` includes `shardCount` from `Stats.Shards`
  - Use existing `vi.spyOn(global, 'fetch')` mocking pattern with `mockResolvedValueOnce`
  - Reference: `specs/005-zoekt-list-api/research.md` Task 5 for mock approach

- [X] T008 [P] Update get-health unit tests for `shardCount` in `zoekt-mcp/tests/unit/tools/get-health.test.ts`
  - Update `getStats` mock return values to include `shardCount` field
  - Verify the formatted health output includes the "Shards" row
  - Reference: `specs/005-zoekt-list-api/quickstart.md` Step 6

- [X] T009 Run full validation: typecheck, lint, and test suite in `zoekt-mcp/`
  - Run `npm run typecheck` — zero type errors
  - Run `npm run lint` — zero lint errors
  - Run `npm run test:unit` — all tests pass (including updated + new tests)
  - Verify success criteria SC-004: all existing unit tests continue to pass
  - Reference: `specs/005-zoekt-list-api/quickstart.md` "Verification" section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — existing project
- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 (types must exist)
- **User Story 2 (Phase 4)**: Depends on Phase 2. Independent of US1 (different method in same file, execute sequentially).
- **User Story 3 (Phase 5)**: Depends on Phase 2 (enriched Repository type). Independent of US2/US4. Different file from US1/US2.
- **User Story 4 (Phase 6)**: Depends on Phase 2 (IndexStats.shardCount). Independent of US1/US3. Different file from US3.
- **Polish (Phase 7)**: Depends on all user stories being complete (tests validate final behavior)

### User Story Dependencies

- **User Story 1 (P1)**: Depends ONLY on Phase 2 (foundational types)
- **User Story 2 (P1)**: Depends ONLY on Phase 2. Same file as US1 (client.ts) — execute sequentially after US1.
- **User Story 3 (P2)**: Depends on Phase 2. In different file (server.ts) — can run parallel with US1/US2 if needed, but logically after US1.
- **User Story 4 (P3)**: Depends on Phase 2. In different file (get-health.ts) — can run parallel with US3.

### Within Each User Story

- Types (Phase 2) before implementation
- Implementation before formatting/display updates
- All implementation before test updates (Phase 7)

### Parallel Opportunities

- **T005 [US3] ∥ T006 [US4]**: Different files (`server.ts` vs `get-health.ts`), no dependencies on each other
- **T007 ∥ T008**: Different test files (`zoekt-client.test.ts` vs `get-health.test.ts`), no dependencies on each other

---

## Parallel Example: Phase 5 + Phase 6

```
# These can run in parallel (different files, no cross-dependencies):
Task T005: Update formatRepoList() in zoekt-mcp/src/server.ts
Task T006: Add shardCount to health stats in zoekt-mcp/src/tools/get-health.ts
```

## Parallel Example: Phase 7 Tests

```
# These can run in parallel (different test files):
Task T007: Update zoekt-client tests in zoekt-mcp/tests/unit/zoekt-client.test.ts
Task T008: Update get-health tests in zoekt-mcp/tests/unit/tools/get-health.test.ts
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 2: Foundational types (T001, T002)
2. Complete Phase 3: User Story 1 — listRepos fix (T003)
3. Complete Phase 4: User Story 2 — getStats fix (T004)
4. **STOP and VALIDATE**: Both critical P1 bugs are fixed. Run typecheck + tests.
5. Deploy/demo if ready — system now returns accurate data.

### Incremental Delivery

1. Phase 2 → Foundation ready (types defined)
2. Phase 3 → US1 complete → `list_repos` returns all repos (MVP bug fix!)
3. Phase 4 → US2 complete → `get_health` reports accurate stats
4. Phase 5 → US3 complete → `list_repos` shows rich metadata per repo
5. Phase 6 → US4 complete → `get_health` includes shard count
6. Phase 7 → Tests updated → Full validation passes
7. Each story adds value without breaking previous stories

### Single Developer Strategy (recommended)

Execute sequentially: T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009

This follows the natural dependency chain and keeps the working set small (one file at a time).

---

## Notes

- All 6 affected source files are in `zoekt-mcp/` — no changes to `zoekt/` (Zoekt backend) or `docker/` (infrastructure)
- The `/api/list` endpoint has been part of Zoekt since initial implementation — no backend changes needed
- `Repository.branches` type change (`string[]` → `Branch[]`) causes temporary compile errors after Phase 2 until Phase 3+5 complete. This is expected.
- Go zero-value dates (`0001-01-01T00:00:00Z`) must be detected and treated as `undefined` — don't expose Go internals to MCP consumers
- `number` type is sufficient for int64 byte fields (JS safe integer limit is ~9 PB, realistic indexes are <1 TB)
