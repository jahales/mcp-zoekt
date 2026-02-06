# Research: Zoekt List API Migration

**Feature**: 005-zoekt-list-api  
**Date**: 2026-02-06  
**Purpose**: Resolve all NEEDS CLARIFICATION items and document technology decisions

## Research Task 1: Zoekt `/api/list` vs `/api/search` design intent

### Decision: Use `POST /api/list` for repository listing and stats

### Rationale

Zoekt's HTTP JSON API (`zoekt/internal/json/json.go`) exposes two endpoints:

- **`POST /api/search`** — content search. Returns `FileMatch[]` (capped by `MaxDocDisplayCount`), plus `RepoURLs` (repo→URL template map). Designed for finding code, not enumerating repos.
- **`POST /api/list`** — repository metadata. Returns `RepoList` with full `Repository` structs, per-repo `RepoStats`, and aggregate `RepoStats`. Designed specifically for listing repos.

The current MCP client misuses `/api/search` with `type:repo` query, extracting repos from `FileMatches`. This fundamentally breaks at scale because `MaxDocDisplayCount` caps file results (not repo results), so large repos consume all slots and small repos are invisible.

### Alternatives considered

1. **Use `SearchResult.RepoURLs` from `/api/search`** — This is a `map[string]string` of repo name→FileURLTemplate. It's more complete than `FileMatches` but only carries URL template strings (no branches, no stats, no metadata). Also still depends on search scanning all shards (can miss repos eliminated by `ShardMaxMatchCount` early exits). Rejected: insufficient metadata and not guaranteed complete.

2. **Increase `MaxDocDisplayCount` to very large value** — Would get more file results but still fundamentally wrong: expensive (runs a full content search), O(files) not O(repos), and can't guarantee coverage without knowing total file count. Rejected: wrong tool for the job.

3. **Use `POST /api/list`** — Purpose-built, returns all repos with full metadata, O(repos) not O(files), no content search overhead. Selected.

## Research Task 2: `/api/list` request/response contract

### Decision: Send `{"Q": ""}` with no `Opts` field

### Rationale

- **Empty Q is valid**: Unlike `/api/search` which rejects `Q: ""` with 400, `/api/list` accepts it — `query.Parse("")` succeeds and matches all repos. Confirmed by Zoekt test suite.
- **`Opts` defaults to `RepoListFieldRepos`**: When `Opts` is nil or zero-value, `ListOptions.GetField()` returns `RepoListFieldRepos` (value 0), which populates `RepoList.Repos[]` with full `RepoListEntry` (Repository + IndexMetadata + Stats). No need to explicitly set `Opts`.
- **POST only**: Handler rejects non-POST with 405.

### Response shape

```json
{
  "List": {
    "Repos": [
      {
        "Repository": {
          "ID": 2,
          "Name": "github.com/org/repo",
          "URL": "https://github.com/org/repo",
          "Branches": [{"Name": "main", "Version": "abc123..."}],
          "HasSymbols": true,
          "LatestCommitDate": "2026-01-15T10:00:00Z",
          "Rank": 100,
          ...
        },
        "IndexMetadata": {
          "IndexTime": "2026-01-16T03:00:00Z",
          "ZoektVersion": "v1.x.y",
          "LanguageMap": {"Go": 150, "TypeScript": 80},
          ...
        },
        "Stats": {
          "Shards": 1,
          "Documents": 1234,
          "IndexBytes": 5242880,
          "ContentBytes": 10485760,
          ...
        }
      }
    ],
    "Crashes": 0,
    "Stats": {
      "Repos": 1104,
      "Shards": 1200,
      "Documents": 500000,
      "IndexBytes": 5368709120,
      "ContentBytes": 10737418240
    }
  }
}
```

### Error responses

| HTTP Status | Condition |
|-------------|-----------|
| 405 | Non-POST method |
| 400 | Malformed JSON body |
| 400 | Invalid query syntax |
| 500 | Internal Zoekt error (shard crash, etc.) |

### Alternatives considered

- **Use `RepoListFieldReposMap` (Opts.Field = 2)** — Returns lightweight `MinimalRepoListEntry` (HasSymbols, Branches, IndexTimeUnix) keyed by repo ID. Would be faster but lacks repo Name, URL, Stats. Rejected: we need name and per-repo stats.

## Research Task 3: TypeScript type modeling for `/api/list` response

### Decision: Add focused types mirroring the Zoekt response subset we consume

### Rationale

We don't need to model the entire Zoekt `Repository` struct (20+ fields). We should model only the fields we consume, keeping types minimal per YAGNI. Fields like `TenantID`, `Source`, `SubRepoMap`, `RawConfig`, `FileTombstones`, `Tombstone`, and `Metadata` are Sourcegraph-internal or not useful for MCP consumers.

### Fields to model per repo

From `Repository`:
- `Name` (string) — repo identifier, always populated
- `URL` (string) — web URL, may be empty
- `Branches` (array of {Name, Version}) — indexed branches with commit SHAs
- `HasSymbols` (boolean) — ctags indexing status
- `LatestCommitDate` (string/Date) — newest commit date

From `IndexMetadata`:
- `IndexTime` (string/Date) — when index was built

From `RepoStats` (per-repo):
- `Documents` (number) — file count
- `ContentBytes` (number) — raw content size
- `IndexBytes` (number) — index overhead size

### Aggregate `RepoStats` fields

- `Repos` (number) — total count
- `Documents` (number) — total files
- `IndexBytes` (number/bigint) — total index size, int64 in Go
- `ContentBytes` (number/bigint) — total content size, int64 in Go
- `Shards` (number) — total shard count

### Alternatives considered

- **Model full Zoekt `Repository` struct** — ~20 fields, most unused. Rejected: violates YAGNI and Minimal Dependencies principles.
- **Use `number` for int64 byte fields** — JavaScript `number` is 64-bit float, safe for integers up to 2^53 (~9 PB). For realistic index sizes (<1 TB), `number` is sufficient. Rejected `bigint` because it complicates JSON parsing and downstream usage for no practical benefit.

## Research Task 4: Client-side filtering approach

### Decision: Keep client-side regex filtering for backward compatibility

### Rationale

The current `list_repos` tool accepts a `filter` parameter that is applied as a regex against repo names client-side. Zoekt's `/api/list` accepts a query parameter that supports `repo:` atoms for server-side filtering.

Options:
1. **Server-side only**: Pass filter as `Q: "repo:<filter>"`. Pro: less data transfer. Con: Zoekt `repo:` syntax differs from raw regex (it's a query atom, may need escaping). Breaking change if users pass plain strings like "my-org".
2. **Client-side only**: Fetch all repos, filter locally. Pro: no behavior change, regex works exactly as before. Con: transfers all repo metadata even when filtering.
3. **Hybrid**: Try server-side first, fall back to client-side. Pro: optimization. Con: added complexity.

For <10,000 repos, the full repo list metadata is small (a few MB at most). Client-side filtering is simpler, preserves backward compatibility, and avoids edge cases with Zoekt query parsing. We choose option 2.

### Alternatives considered

- Server-side filtering (option 1) rejected due to breaking change risk and added complexity
- Hybrid (option 3) rejected per YAGNI

## Research Task 5: Test mocking approach

### Decision: Update existing `vi.spyOn(global, 'fetch')` mocks to return `/api/list` response shape

### Rationale

Current tests mock `fetch` at the global level using `vi.spyOn(global, 'fetch')` with `mockResolvedValueOnce`. The `listRepos` tests mock a `/api/search` response with `Result.Files[]`. These must be updated to mock `List.Repos[]` response shape instead.

Current test coverage for affected methods:
- `listRepos`: 2 tests (basic list, filter by pattern)
- `getStats`: 0 tests (no existing coverage)

New tests needed:
- `listRepos`: Update 2 existing tests, add tests for empty repos, null branches edge case
- `getStats`: Add test for correct aggregate stats extraction, add test for shard count

### Alternatives considered

- **Add a ZoektClient abstraction/interface** — Would allow injecting mock clients instead of mocking global fetch. Rejected: adds abstraction layer that doesn't exist yet, violates "no premature abstractions until 3+ use cases" rule.

## Research Task 6: Enriched `list_repos` output formatting

### Decision: Extend `formatRepoList()` to show per-repo metadata in a compact, scannable format

### Rationale

Current output:
```
## Indexed Repositories

Found 5 repositories:

1. github.com/org/repo1 (main)
2. github.com/org/repo2 (main, develop)
```

With enriched metadata, the output should remain scannable but include useful signals. Proposed format:
```
## Indexed Repositories

Found 1104 repositories:

1. **github.com/org/repo1** (1,234 files, 10.5 MB)
   Branches: main@abc123, develop@def456
   Symbols: ✅ | Indexed: 2026-01-16

2. **github.com/org/repo2** (567 files, 3.2 MB)
   Branches: main@789abc
   Symbols: ❌ | Indexed: 2026-01-15
```

Key design choices:
- Repo name bolded for scanning
- File count and content size on the first line (most useful at-a-glance)
- Branch SHAs truncated to 7 chars (standard git short SHA)
- Symbol availability as emoji indicator (quick visual scan)
- Index time as date only (time precision not useful for LLMs)
- No URL (rarely needed in LLM context, adds clutter)

### Alternatives considered

- **Table format** — More structured but wraps badly in narrow terminals/chat UIs. Rejected.
- **JSON output** — Machine-readable but not LLM-friendly. MCP convention is markdown text. Rejected.
- **Minimal format (name + branches only with SHA)** — Loses the most valuable new data (doc count, symbols). Rejected.
