# Quickstart: Zoekt List API Migration

**Feature**: 005-zoekt-list-api  
**Date**: 2026-02-06  
**Estimated effort**: ~170 lines changed across 6 files

## Overview

Replace `listRepos()` and `getStats()` in the Zoekt MCP client to use Zoekt's purpose-built `POST /api/list` endpoint instead of the content search endpoint. This fixes incorrect repository counts and health statistics at scale, and enables richer per-repository metadata.

## Prerequisites

- Node.js 18+
- Working Zoekt backend (for integration testing)
- `npm install` in `zoekt-mcp/`

## Implementation Order

### Step 1: Add `/api/list` response types to `types.ts`

Add TypeScript interfaces for the raw Zoekt `/api/list` JSON response. These are internal wire types — not exposed to MCP consumers.

**New types to add:**
- `ZoektListResponse` — top-level `{ List: ZoektRepoList }`
- `ZoektRepoList` — `{ Repos, Stats, Crashes }`
- `ZoektRepoListEntry` — `{ Repository, IndexMetadata, Stats }`
- `ZoektRepository` — subset: `{ Name, URL, Branches, HasSymbols, LatestCommitDate }`
- `ZoektBranch` — `{ Name, Version }`
- `ZoektIndexMetadata` — `{ IndexTime }`
- `ZoektRepoStats` — `{ Repos, Shards, Documents, IndexBytes, ContentBytes }`

**Modify existing types:**
- `Repository` — change `branches: string[]` to `branches: Branch[]`, add `url`, `hasSymbols`, `documentCount`, `contentBytes`, `indexBytes`, `latestCommitDate`
- `Branch` — new interface: `{ name: string; version: string }`
- `IndexStats` — add `shardCount: number`

### Step 2: Rewrite `listRepos()` in `client.ts`

Replace the current implementation that calls `/api/search` with `type:repo` query.

**Key changes:**
- Call `POST /api/list` with body `{ Q: "" }`
- Parse response as `ZoektListResponse`
- Map `Repos[].Repository` + `Repos[].Stats` + `Repos[].IndexMetadata` → `Repository[]`
- Handle null `Branches` (default to empty array)
- Handle Go zero-value dates (treat `0001-01-01T00:00:00Z` as undefined)
- Apply client-side regex filter if `filter` parameter provided
- Validate regex filter, return `QUERY_ERROR` if invalid
- Preserve existing error handling pattern (ZoektError codes, fetch timeout)

### Step 3: Rewrite `getStats()` in `client.ts`

Replace the current implementation that calls `/api/search` with `type:repo` query.

**Key changes:**
- Call `POST /api/list` with body `{ Q: "" }`
- Extract aggregate stats from `List.Stats`:
  - `repositoryCount` ← `Stats.Repos`
  - `documentCount` ← `Stats.Documents`
  - `indexBytes` ← `Stats.IndexBytes`
  - `contentBytes` ← `Stats.ContentBytes`
  - `shardCount` ← `Stats.Shards`
- Preserve existing error handling pattern

### Step 4: Update `formatRepoList()` in `server.ts`

Update the formatting function to use the enriched `Repository` type.

**Key changes:**
- Show document count and content size per repo
- Show branch names with truncated SHAs (7 chars)
- Show symbol availability indicator (✅/❌)
- Show index date
- Update the function signature to accept the new `Repository` type with `Branch[]`

### Step 5: Update `get-health.ts` for `shardCount`

**Key changes:**
- Add `shardCount` to the `IndexStats` display in `formatHealthResults()`
- Add "Shards" row to the health status table

### Step 6: Update unit tests

**`zoekt-client.test.ts`:**
- Update `listRepos` mocks from `/api/search` response shape to `/api/list` response shape
- Add test for empty repos array
- Add test for null branches handling
- Add `getStats` tests (currently 0 coverage)

**`get-health.test.ts`:**
- Update `getStats` mock return values to include `shardCount`

## Verification

```bash
# Run unit tests
npm run test:unit

# Type check
npm run typecheck

# Lint
npm run lint

# Integration test (requires running Zoekt)
npm run test:integration
```

## Key Design Decisions

1. **Client-side filtering** — Fetch all repos from `/api/list`, apply regex filter locally. Simpler than converting filter patterns to Zoekt `repo:` query atoms.
2. **No new dependencies** — Pure TypeScript types and `fetch` calls. No JSON schema validation library needed.
3. **`number` for int64 fields** — JS `number` is safe for integers up to 2^53 (~9 PB). Sufficient for realistic index sizes.
4. **Go zero-value date handling** — Dates matching `0001-01-01` are treated as undefined rather than exposing the Go zero value.
5. **Branch SHA truncation in output** — Display 7-char short SHAs in formatted output (standard git convention) while storing full SHA in the type.
