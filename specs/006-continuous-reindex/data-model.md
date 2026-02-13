# Data Model: Continuous Reindex for Docker Compose

**Feature**: `006-continuous-reindex`  
**Date**: 2026-02-13

## Overview

This feature has minimal data modeling — it modifies Docker Compose service definitions and shell logic, not application data structures. The "entities" below describe the configuration and runtime concepts involved.

## Entities

### SyncService (Container: `zoekt-sync`)

Replaces the previous `zoekt-mirror` + `zoekt-indexserver` containers with a single long-lived service.

| Attribute | Type | Description |
|-----------|------|-------------|
| image | string | `zoekt:local` — pre-built Zoekt image |
| restart | string | `unless-stopped` — recovers from crashes, stops on explicit `down` |
| GITHUB_ORG | env var (required) | GitHub organization to mirror and index |
| SYNC_INTERVAL | env var (optional) | Seconds between sync cycles. Default: `3600` |

**Lifecycle**: Container starts → runs mirror → runs index → sleeps → repeats indefinitely.

### SyncCycle (Runtime Concept)

A single pass through the mirror → index → sleep sequence.

| Phase | Tool | Error Handling |
|-------|------|----------------|
| Mirror | `zoekt-mirror-github` | `|| true` — log error, continue to index |
| Index | `zoekt-git-index` (per repo) | `|| echo "Failed..."` — log and continue to next repo |
| Sleep | `sleep $SYNC_INTERVAL` | N/A |

**State transitions**:
```
STARTING → MIRRORING → INDEXING → SLEEPING → MIRRORING → ...
```

### Configuration Variables

| Variable | Scope | Default | Description |
|----------|-------|---------|-------------|
| `GITHUB_ORG` | Required | — | GitHub organization to mirror |
| `SYNC_INTERVAL` | Optional | `3600` | Seconds between end of one cycle and start of next |

## Relationships

```
zoekt-sync ──writes──> zoekt-data volume (/data/repos, /data/index)
zoekt-webserver ──reads──> zoekt-data volume (/data/index)
```

The webserver reads the index files that `zoekt-sync` writes. Zoekt's index format supports concurrent read/write — the webserver picks up new index shards on the next search request without a restart.

## Validation Rules

- `GITHUB_ORG` must be a non-empty string (enforced by Compose `${GITHUB_ORG:?...}` syntax).
- `SYNC_INTERVAL` must be a positive integer (seconds). No validation in shell; invalid values cause `sleep` to error and the loop to retry immediately.

## Removed Entities

- **zoekt-mirror** (container): Replaced by `zoekt-sync`. No longer a separate service.
- **zoekt-indexserver** (container): Replaced by `zoekt-sync`. No longer a separate service.
