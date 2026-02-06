# API Contracts: Zoekt `/api/list` Endpoint

**Feature**: 005-zoekt-list-api  
**Date**: 2026-02-06  
**Type**: External API (Zoekt backend → MCP client)

## Endpoint: POST /api/list

### Request

```
POST /api/list HTTP/1.1
Content-Type: application/json

{
  "Q": ""
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `Q` | `string` | No | `""` | Zoekt query to filter repos. Empty string matches all. Supports `repo:` atoms. |
| `Opts` | `object \| null` | No | `null` | List options. When null/omitted, defaults to full repo metadata mode. |
| `Opts.Field` | `number` | No | `0` | `0` = full `RepoListEntry[]`, `2` = minimal `ReposMap`. We always use `0`. |

### Response (200 OK)

```json
{
  "List": {
    "Repos": [
      {
        "Repository": {
          "ID": 2,
          "Name": "github.com/org/repo",
          "URL": "https://github.com/org/repo",
          "Branches": [
            { "Name": "main", "Version": "abc123def456789..." }
          ],
          "HasSymbols": true,
          "LatestCommitDate": "2026-01-15T10:30:00Z"
        },
        "IndexMetadata": {
          "IndexTime": "2026-01-16T03:00:00Z",
          "ZoektVersion": "16.12.0-dev+1abcdef"
        },
        "Stats": {
          "Repos": 0,
          "Shards": 1,
          "Documents": 1234,
          "IndexBytes": 5242880,
          "ContentBytes": 10485760
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

### Error Responses

#### 405 Method Not Allowed
Non-POST request.
```json
{"Error": "Only POST is supported"}
```

#### 400 Bad Request — Malformed Body
```json
{"Error": "unexpected end of JSON input"}
```

#### 400 Bad Request — Invalid Query
```json
{"Error": "parse error: ..."}
```

#### 500 Internal Server Error
```json
{"Error": "shard error: ..."}
```

## Field Reference (consumed subset)

### `List.Repos[].Repository` fields consumed

| Field | JSON Type | Go Type | Notes |
|-------|-----------|---------|-------|
| `Name` | `string` | `string` | Always populated. Primary identifier. |
| `URL` | `string` | `string` | May be empty string. |
| `Branches` | `array \| null` | `[]RepositoryBranch` | Null when no branches indexed. Each entry has `Name` (string) and `Version` (40-char hex SHA). |
| `HasSymbols` | `boolean` | `bool` | `true` if ctags output was included in index. |
| `LatestCommitDate` | `string` | `time.Time` | ISO 8601. Go zero value = `"0001-01-01T00:00:00Z"`. |

### `List.Repos[].IndexMetadata` fields consumed

| Field | JSON Type | Go Type | Notes |
|-------|-----------|---------|-------|
| `IndexTime` | `string` | `time.Time` | ISO 8601. When the index shard was built. |

### `List.Repos[].Stats` fields consumed

| Field | JSON Type | Go Type | Notes |
|-------|-----------|---------|-------|
| `Documents` | `number` | `int` | File count for this repo. |
| `IndexBytes` | `number` | `int64` | Index overhead bytes. Safe as JS `number` for < 9 PB. |
| `ContentBytes` | `number` | `int64` | Raw content bytes. |

### `List.Stats` fields consumed (aggregate)

| Field | JSON Type | Go Type | Notes |
|-------|-----------|---------|-------|
| `Repos` | `number` | `int` | Total repository count. **This is the authoritative count.** |
| `Shards` | `number` | `int` | Total shard count. |
| `Documents` | `number` | `int` | Total file count across all repos. |
| `IndexBytes` | `number` | `int64` | Total index size. |
| `ContentBytes` | `number` | `int64` | Total content size. |

## Fields NOT consumed (deferred)

These fields exist in the response but are not modeled in this iteration:

- `Repository.TenantID`, `Repository.ID` — Sourcegraph-internal identifiers
- `Repository.Source` — physical path to index source (internal)
- `Repository.SubRepoMap` — submodule metadata
- `Repository.CommitURLTemplate`, `Repository.FileURLTemplate`, `Repository.LineFragmentTemplate` — URL templates (deferred to future "source links" feature)
- `Repository.RawConfig` — Zoekt configuration settings
- `Repository.Rank` — importance ranking
- `Repository.IndexOptions` — hash of build options
- `Repository.Tombstone`, `Repository.FileTombstones` — deletion markers
- `Repository.Metadata` — arbitrary key-value pairs
- `IndexMetadata.IndexFormatVersion`, `IndexMetadata.IndexFeatureVersion`, `IndexMetadata.IndexMinReaderVersion` — version compatibility
- `IndexMetadata.PlainASCII` — encoding flag
- `IndexMetadata.LanguageMap` — language→file count (deferred to future enhancement)
- `IndexMetadata.ZoektVersion`, `IndexMetadata.ID` — build info
- `RepoStats.NewLinesCount`, `RepoStats.DefaultBranchNewLinesCount`, `RepoStats.OtherBranchesNewLinesCount` — line counts
