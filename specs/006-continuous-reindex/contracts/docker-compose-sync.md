# Docker Compose Service Contract: zoekt-sync

**Feature**: `006-continuous-reindex`  
**Date**: 2026-02-13

## Service Definition

This contract defines the expected `zoekt-sync` service in `docker/docker-compose.yml`, replacing the previous `zoekt-mirror` and `zoekt-indexserver` services.

### Service: `zoekt-sync`

**Purpose**: Continuously mirror repositories from GitHub and index them for Zoekt search.

**Image**: `zoekt:local`

**Restart Policy**: `unless-stopped`

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_ORG` | Yes | — | GitHub organization to mirror. Fails fast if unset. |
| `SYNC_INTERVAL` | No | `3600` | Seconds to sleep between sync cycles. |

### Volumes

| Mount | Container Path | Mode | Purpose |
|-------|---------------|------|---------|
| `zoekt-data` | `/data` | read-write | Shared volume for repos (`/data/repos`) and index (`/data/index`) |
| `./config` | `/config` | read-only | GitHub token and mirror config |

### Network

- Member of `zoekt` bridge network.

### Entrypoint & Command

```yaml
entrypoint: ["/bin/sh", "-c"]
command:
  - |
    TOKEN=$(cat /config/github-token.txt)
    git config --global url."https://${TOKEN}@github.com/".insteadOf "https://github.com/"
    while true; do
      echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Sync cycle starting for ${GITHUB_ORG}"
      
      echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Mirroring ${GITHUB_ORG}..."
      zoekt-mirror-github -dest /data/repos -org ${GITHUB_ORG} -token /config/github-token.txt -no_archived || true
      
      echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Indexing repositories..."
      for repo in /data/repos/github.com/${GITHUB_ORG}/*.git; do
        if [ -d "${repo}" ]; then
          echo "  Indexing ${repo}..."
          zoekt-git-index -index /data/index "${repo}" || echo "  Failed to index ${repo}"
        fi
      done
      
      echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Sync cycle complete. Sleeping ${SYNC_INTERVAL}s..."
      sleep ${SYNC_INTERVAL}
    done
```

**Note**: In the actual `docker-compose.yml`, `$` must be escaped as `$$` for shell variables that should be resolved at container runtime rather than Compose parse time.

### Dependencies

- **None** (previously `zoekt-indexserver` depended on `zoekt-mirror`; merging eliminates this).

### Downstream Dependents

- `zoekt-webserver` depends on data written to the `zoekt-data` volume but does NOT have a `depends_on` for `zoekt-sync` (the webserver can start independently and will serve whatever index exists).

## Removed Services

### zoekt-mirror (REMOVED)

Previously ran as a one-shot mirror task. Its functionality is now part of `zoekt-sync`.

### zoekt-indexserver (REMOVED)

Previously ran index once then slept forever. Its functionality is now part of `zoekt-sync`.

## Behavioral Contract

1. **Cycle ordering**: Mirror always completes before indexing starts within a cycle.
2. **Non-overlapping**: The sleep timer starts only after the index phase completes.
3. **Error isolation**: A mirror failure does not prevent indexing (previous clones are still on disk). An index failure for one repo does not prevent indexing of others.
4. **Graceful shutdown**: On SIGTERM (`docker compose down`), the shell loop exits. No cleanup is needed — the volume persists.
5. **Cold start**: On first run with an empty volume, the mirror phase clones all repos; the index phase indexes them. The webserver may return empty results until the first cycle completes.
