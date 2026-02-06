# Data Model: Zoekt List API Migration

**Feature**: 005-zoekt-list-api  
**Date**: 2026-02-06

## Entity Definitions

### Repository (enriched)

Represents an indexed code repository returned by the Zoekt `/api/list` endpoint.

| Field | Type | Source (Zoekt) | Description |
|-------|------|----------------|-------------|
| `name` | `string` | `Repository.Name` | Fully qualified repository name (e.g., `github.com/org/repo`) |
| `url` | `string` | `Repository.URL` | Repository web URL (may be empty) |
| `branches` | `Branch[]` | `Repository.Branches` | Indexed branches with commit SHAs |
| `hasSymbols` | `boolean` | `Repository.HasSymbols` | Whether ctags symbol indexing is available |
| `documentCount` | `number` | `RepoStats.Documents` | Number of indexed files in this repo |
| `contentBytes` | `number` | `RepoStats.ContentBytes` | Raw content size in bytes |
| `indexBytes` | `number` | `RepoStats.IndexBytes` | Index overhead size in bytes |
| `indexTime` | `Date \| undefined` | `IndexMetadata.IndexTime` | When the index was last built |
| `latestCommitDate` | `Date \| undefined` | `Repository.LatestCommitDate` | Date of newest commit across indexed branches |

**Validation rules**:
- `name` is always non-empty (primary identifier)
- `branches` may be empty array if Zoekt returns null
- `documentCount`, `contentBytes`, `indexBytes` are non-negative integers
- `indexTime` and `latestCommitDate` may be zero-value dates from Go (0001-01-01T00:00:00Z), treated as undefined

### Branch

A named reference within a repository including the indexed revision.

| Field | Type | Source (Zoekt) | Description |
|-------|------|----------------|-------------|
| `name` | `string` | `RepositoryBranch.Name` | Branch name (e.g., `main`, `HEAD`) |
| `version` | `string` | `RepositoryBranch.Version` | Commit SHA (40-char hex string) |

### IndexStats (enriched)

Aggregate statistics across all indexed repositories.

| Field | Type | Source (Zoekt) | Description |
|-------|------|----------------|-------------|
| `repositoryCount` | `number` | `RepoList.Stats.Repos` | Total number of indexed repositories |
| `documentCount` | `number` | `RepoList.Stats.Documents` | Total number of indexed files |
| `indexBytes` | `number` | `RepoList.Stats.IndexBytes` | Total index size in bytes |
| `contentBytes` | `number` | `RepoList.Stats.ContentBytes` | Total content size in bytes |
| `shardCount` | `number` | `RepoList.Stats.Shards` | Total number of search shards |

## Zoekt `/api/list` Response Types (wire format)

These types model the raw JSON response from Zoekt's `/api/list` endpoint. They are internal to the client and not exposed to MCP consumers.

### ZoektListResponse (top-level envelope)

```
{ List: ZoektRepoList }
```

### ZoektRepoList

| Field | Type | Description |
|-------|------|-------------|
| `Repos` | `ZoektRepoListEntry[] \| null` | Per-repo entries (null when using ReposMap mode) |
| `Stats` | `ZoektRepoStats` | Aggregate statistics |
| `Crashes` | `number` | Number of shards that crashed during listing |

### ZoektRepoListEntry

| Field | Type | Description |
|-------|------|-------------|
| `Repository` | `ZoektRepository` | Repository metadata |
| `IndexMetadata` | `ZoektIndexMetadata` | Index build information |
| `Stats` | `ZoektRepoStats` | Per-repo statistics (note: `Repos` field is 0 here) |

### ZoektRepository (subset consumed)

| Field | Type | Description |
|-------|------|-------------|
| `Name` | `string` | Repository name |
| `URL` | `string` | Repository web URL |
| `Branches` | `ZoektBranch[] \| null` | Indexed branches |
| `HasSymbols` | `boolean` | Whether ctags output was indexed |
| `LatestCommitDate` | `string` | ISO 8601 date string |

### ZoektBranch

| Field | Type | Description |
|-------|------|-------------|
| `Name` | `string` | Branch name |
| `Version` | `string` | Commit SHA |

### ZoektIndexMetadata (subset consumed)

| Field | Type | Description |
|-------|------|-------------|
| `IndexTime` | `string` | ISO 8601 date string of when index was built |

### ZoektRepoStats

| Field | Type | Description |
|-------|------|-------------|
| `Repos` | `number` | Repository count (only populated in aggregate, 0 in per-repo) |
| `Shards` | `number` | Shard count |
| `Documents` | `number` | Document (file) count |
| `IndexBytes` | `number` | Index size in bytes |
| `ContentBytes` | `number` | Content size in bytes |

## Relationships

```
IndexStats (aggregate)
  └── derived from ZoektRepoList.Stats

Repository (enriched)
  ├── has many Branch
  ├── stats from ZoektRepoListEntry.Stats
  └── metadata from ZoektRepoListEntry.IndexMetadata

ZoektListResponse
  └── ZoektRepoList
       ├── ZoektRepoListEntry[]
       │    ├── ZoektRepository
       │    │    └── ZoektBranch[]
       │    ├── ZoektIndexMetadata
       │    └── ZoektRepoStats (per-repo)
       └── ZoektRepoStats (aggregate)
```

## State Transitions

N/A — this is a stateless request/response model. No state machines or lifecycle management.

## Migration from Current Model

| Current Field | New Field | Change |
|---------------|-----------|--------|
| `Repository.name` | `Repository.name` | Unchanged |
| `Repository.branches: string[]` | `Repository.branches: Branch[]` | **Breaking**: array of strings → array of objects with `name` + `version` |
| `Repository.fileCount?: number` | `Repository.documentCount: number` | Renamed, now always populated |
| `Repository.indexTime?: Date` | `Repository.indexTime: Date \| undefined` | Unchanged semantics |
| *(not present)* | `Repository.url: string` | New field |
| *(not present)* | `Repository.hasSymbols: boolean` | New field |
| *(not present)* | `Repository.contentBytes: number` | New field |
| *(not present)* | `Repository.indexBytes: number` | New field |
| *(not present)* | `Repository.latestCommitDate: Date \| undefined` | New field |
| `IndexStats.repositoryCount` | `IndexStats.repositoryCount` | Same field, now correct value |
| `IndexStats.documentCount` | `IndexStats.documentCount` | Same field, now correct value |
| `IndexStats.indexBytes` | `IndexStats.indexBytes` | Same field, now correct value (was I/O counter) |
| `IndexStats.contentBytes` | `IndexStats.contentBytes` | Same field, now correct value (was I/O counter) |
| *(not present)* | `IndexStats.shardCount: number` | New field |

**Note on breaking change**: `Repository.branches` changes from `string[]` to `Branch[]`. This is an internal type — the only consumer is `formatRepoList()` in `server.ts`, which is updated in the same PR. No external API breakage since MCP tools return formatted markdown text, not structured data.
