# Data Model: Working Tree Indexing & Multi-Org Support

**Feature**: 008-workingtree-multi-org  
**Date**: 2026-02-18

## Entities

### 1. FileMatch (updated)

Represents a single file result from a Zoekt search query.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Repository | string | no | Alt: `Repo`. Repository name or path |
| Repo | string | no | Alt: `Repository`. Newer API field |
| FileName | string | yes | Path within the repository |
| Branches | string[] | **no** (was: yes) | **CHANGED**: Now optional. Null/empty for working-tree indices |
| Language | string | yes | Detected file language |
| ChunkMatches | ChunkMatch[] | no | Newer match format |
| LineMatches | LineMatch[] | no | Legacy match format |

**Migration**: `Branches: string[]` → `Branches?: string[]` in `zoekt/types.ts`

### 2. ChunkMatch (unchanged, but access patterns updated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Content | string | yes | Base64-encoded |
| ContentStart | ContentPosition | yes | Line/column/byte offset |
| Ranges | MatchRange[] | yes | But may be empty array |
| FileName | boolean | yes | True if filename match |
| SymbolInfo | (SymbolInfo \| null)[] | no | Aligned with Ranges |

**Access pattern change**: `chunk.Ranges[0]` → `chunk.Ranges?.[0]` for defensive access when array might be empty or when outer types are loose.

### 3. Repository (unchanged, but branch display updated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | yes | Full repo name or working-tree path |
| branches | Branch[] | yes | May be empty array for working-tree repos |
| documentCount | number | yes | |
| contentBytes | number | yes | |
| hasSymbols | boolean | yes | |
| indexTime | Date \| undefined | no | |

**Display rule**: If `branches` is empty or undefined, omit the "Branches:" line in formatted output (don't crash).

### 4. Index Source (conceptual, not a TypeScript type)

Represents the origin of indexed content. Exists at the Docker infrastructure layer, not in the MCP server code.

| Attribute | Working Tree | GitHub Mirror |
|-----------|-------------|---------------|
| Source type | Local filesystem path | GitHub organization |
| Branch concept | None | Git branches |
| Sync tool | `zoekt-index` | `zoekt-mirror-github` + `zoekt-git-index` |
| Sync interval | 60s (default) | 3600s (default) |
| File serving | From index (re-indexed periodically) | From index |
| Config var | `WORKSPACE_ROOT` | `GITHUB_ORGS` / `GITHUB_ORG` |

### 5. Docker Environment Configuration

| Variable | Scope | Format | Default | Required |
|----------|-------|--------|---------|----------|
| COMPOSE_PROFILES | Docker Compose | Comma-separated: `workingtree`, `github` | *(none)* | Yes (at least one) |
| WORKSPACE_ROOT | workingtree profile | Absolute path | *(none)* | If profile active |
| INDEX_INTERVAL | workingtree profile | Seconds (integer) | 60 | No |
| GITHUB_ORGS | github profile | Comma-separated org names | *(none)* | If profile active |
| GITHUB_ORG | github profile (legacy) | Single org name | *(none)* | Fallback if GITHUB_ORGS unset |
| SYNC_INTERVAL | github profile | Seconds (integer) | 3600 | No |

## State Transitions

### Sync Cycle State Machine

```
IDLE → RUNNING → COMPLETE → SLEEPING → IDLE
                    ↓
                  ERROR → SLEEPING → IDLE
```

- **IDLE**: Waiting for first cycle or after sleep completes
- **RUNNING**: Actively mirroring/indexing
- **COMPLETE**: Cycle finished successfully, logging summary
- **ERROR**: Cycle failed for one org (logged as warning), continues to next org
- **SLEEPING**: Waiting for next cycle (`sleep $INTERVAL`)

### Multi-Org Iteration (within RUNNING state)

```
For each ORG in GITHUB_ORGS:
  MIRROR_ORG → INDEX_ORG_REPOS → (next org or COMPLETE)
       ↓              ↓
    WARN_SKIP      WARN_SKIP
```

Each org failure is logged but does not stop the cycle.

## Validation Rules

| Rule | Entity | Constraint |
|------|--------|-----------|
| WORKSPACE_ROOT must be an absolute path | Config | Enforced by Docker volume mount |
| WORKSPACE_ROOT must exist | Config | Docker fails if host path doesn't exist |
| GITHUB_ORGS entries trimmed of whitespace | Config | `echo "$ORG" \| xargs` in shell script |
| GITHUB_ORGS deduplicated | Config | `sort -u` or equivalent in shell script |
| Branch display fallback | FileMatch | Display "HEAD" if `Branches` is null/undefined/empty |
| branch parameter optional | file_content tool | Omit `b` query param if branch is undefined |
