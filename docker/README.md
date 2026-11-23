# Zoekt Docker Infrastructure

Docker Compose configuration for running Zoekt code search indexing infrastructure.

## Overview

This directory contains:
- `docker-compose.yml` - Service definitions for Zoekt webserver, GitHub sync, and working-tree indexing
- `.env` (optional) - Environment variables such as `COMPOSE_PROFILES`, `WORKSPACE_ROOT`, `GITHUB_ORGS`, `SYNC_INTERVAL`
- `.env.example` - Copy/paste template for `.env`
- `config/github-token.txt` - Your GitHub Personal Access Token (not committed; required only for GitHub mode)
- `config/ghe-token.txt` - Token for a GitHub Enterprise host (not committed; only if you set `GHE_URL`)

## Quick Start

This stack supports multiple modes using Docker Compose **profiles**:

- **workingtree**: index a local directory (no GitHub token required)
- **github**: mirror one or more GitHub orgs (token required)
- **dual-mode**: run both at the same time

### Option A: Working Tree Mode (local directory)

1. Create a `.env` file:

```bash
cp .env.example .env
```

2. Edit `.env` and set:

- `COMPOSE_PROFILES=workingtree`
- `WORKSPACE_ROOT=/absolute/path/to/your/project`

**Windows note**: `WORKSPACE_ROOT` must be a Docker-mountable absolute path. Depending on your Docker Desktop setup, either `C:\\path\\to\\project` or `/c/path/to/project` may work.

3. Start services:

```bash
docker compose up -d
```

4. Monitor indexing:

```bash
docker compose logs -f zoekt-indexer
```

---

### Option B: GitHub Mirror Mode (one or more orgs)

#### 1. Create GitHub Token

Create a GitHub Personal Access Token with `repo` scope:
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select `repo` scope for private repository access
4. Copy the token

### 2. Configure Token

```bash
echo "ghp_your_token_here" > config/github-token.txt
```

**Important**: Never commit this file. It's already in `.gitignore`.

#### 3. Configure Organization(s)

Set one of the following in `.env`:

- `GITHUB_ORGS=org-a,org-b` *(preferred; supports multiple orgs)*
- `GITHUB_ORG=your-org-name` *(legacy single-org; backward compatible)*

```bash
cp .env.example .env
```

Also set:

- `COMPOSE_PROFILES=github`

#### 4. Start Services

```bash
docker compose up -d
```

#### 5. Monitor Indexing

```bash
docker compose logs -f zoekt-sync
```

Initial indexing may take 10-60 minutes depending on the number and size of repositories.

#### 6. Verify

```bash
curl -s -X POST -d '{"Q":"type:repo"}' http://localhost:6070/api/search | jq '.Result.Files[].Repository' | sort -u
```

---

### Option C: Dual-Mode (workingtree + github)

Set both configurations in `.env` and enable both profiles:

```bash
# .env
COMPOSE_PROFILES=workingtree,github
WORKSPACE_ROOT=/absolute/path/to/your/project
GITHUB_ORGS=org-a,org-b
```

Then:

```bash
docker compose up -d
```

## Configuration Reference

### Note on mirror-config.json

`docker-compose.yml` mirrors one or more GitHub organizations using `GITHUB_ORGS` (or legacy `GITHUB_ORG`).

`config/mirror-config.json` is not consumed by this local compose stack. If you need
advanced multi-org scheduling/configuration, use the production workflow documented in
`docker-compose.prod.yml` with `update-index.sh`.

### Scheduled index updates (macOS: launchd)

`update-index.sh` re-mirrors and re-indexes the configured `GITHUB_ORGS` (and `GHE_ORGS`,
below), then reloads the webserver. Each repo is indexed on `HEAD` plus whichever of `main`,
`dev`, `develop`, `stage` and `staging` it has.

A mirror deletes a clone only when the API shows its repo archived or moved (renamed or
transferred), via `scripts/prune-mirror.sh`. A repo that merely drops out of the org listing
keeps its clone, because GitHub answers 404 both for a deleted repo and for one the token can
no longer see, and a narrower token must not cost clones. The log names each such repo
("not visible to the token"); if it was deleted, delete its clone by hand.

The indexer then deletes the shards of any repo in a configured org whose clone is gone. An
org with no clones at all keeps its shards, so a mirror that never populated can't empty the
index, and orgs no longer configured are left alone. The indexer also removes `*.tmp` shard
files more than an hour old, which interrupted runs leave behind. Org names match their clone
directories case-insensitively.

Each mirror attempt is stopped after `MIRROR_TIMEOUT` seconds (default 3 hours;
`GHE_MIRROR_TIMEOUT` overrides it for the GHE mirror), so a host that accepts connections
but never answers can't hold the run.

Schedule it with a **launchd agent** rather than cron — launchd runs the job on the next
wake if the Mac was asleep at the scheduled time, whereas cron skips it.

Copy `com.zoekt.index-update.plist.example` to
`~/Library/LaunchAgents/com.zoekt.index-update.plist`, replace the path placeholders, then:

```sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.zoekt.index-update.plist
launchctl print gui/$(id -u)/com.zoekt.index-update   # verify it's loaded
launchctl kickstart -k gui/$(id -u)/com.zoekt.index-update   # run once now (optional)
```

Requires Docker Desktop running; the script waits up to 5 min for the daemon and holds a
lock so overlapping runs are skipped. Output goes to `~/zoekt-update.log`.

### GitHub Enterprise orgs

`docker-compose.prod.yml` can also mirror orgs on a GitHub Enterprise host, through its own
`zoekt-mirror-ghe` service. Put a token from that host with `repo` scope in
`config/ghe-token.txt` (gitignored) and set in `.env`:

| Variable | Description |
|----------|-------------|
| `GHE_URL` | Host root, e.g. `https://github.example.com`. Unset skips the GHE mirror. |
| `GHE_ORGS` | Comma-separated orgs on that host |
| `GHE_EXCLUDE` | Regexp of repo names not to mirror, e.g. vendored copies of upstream projects |
| `GHE_NAME` | Regexp of the only repo names to mirror; useful for a first small test |

Repos land in `/data/repos/<host>/<org>/` and are indexed as `<host>/<org>/<repo>`, apart
from any github.com org of the same name.

A GHE mirror failure only warns. `update-index.sh` retries it like the github.com mirror,
then re-indexes everything anyway, GHE repos from their last successful fetch. So a night
when the host is unreachable (say, it needs a VPN that is down) still refreshes github.com.
A github.com mirror failure still skips the whole re-index.

`GHE_EXCLUDE` and `GHE_NAME` only decide what gets cloned. Repos that a new `GHE_EXCLUDE`
matches are not removed if already mirrored: delete their clones from
`/data/repos/<host>/<org>/` by hand, and the next run drops their shards.

### Upgrading Zoekt

`Dockerfile.zoekt` pins Zoekt (`ZOEKT_REF`) and universal-ctags (`CTAGS_REF`). To upgrade,
bump them, keep the current image for rollback, rebuild, and recreate the webserver:

```sh
docker tag zoekt:local zoekt:prev
docker build -t zoekt:local -f Dockerfile.zoekt .
docker compose -p docker -f docker-compose.prod.yml up -d --no-deps zoekt-webserver
```

`docker tag zoekt:prev zoekt:local` and the same `up` command roll it back. Existing shards
load unchanged as long as upstream hasn't raised `IndexFormatVersion` (in `index/toc.go`):
check that before bumping. The webserver answers before it has loaded all shards, so check
`/readyz` rather than `/`.

## Environment Variables

### zoekt-sync (profile: github)

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_ORGS` | *(none)* | Comma-separated org list (preferred) |
| `GITHUB_ORG` | *(none)* | Legacy single org (fallback if `GITHUB_ORGS` unset) |
| `SYNC_INTERVAL` | `3600` | Seconds between sync cycles |

### zoekt-indexer (profile: workingtree)

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE_ROOT` | *(none)* | Absolute host path to index (required) |
| `INDEX_INTERVAL` | `60` | Seconds between re-index cycles |

To change the sync interval:

```yaml
# In docker-compose.yml
zoekt-sync:
  environment:
    - SYNC_INTERVAL=120
```

### zoekt-webserver

| Variable | Default | Description |
|----------|---------|-------------|
| `LISTEN_ADDR` | `:6070` | HTTP listen address |

## Operations

### Check Indexing Status

```bash
# View current indexing activity
docker compose logs zoekt-sync | tail -50

# Count indexed repositories
curl -s -X POST -d '{"Q":"type:repo"}' http://localhost:6070/api/search | jq '[.Result.Files[].Repository] | unique | length'
```

### Force Re-index

```bash
# Restart the relevant service to trigger an immediate cycle
docker compose restart zoekt-sync       # github
docker compose restart zoekt-indexer    # workingtree
```

### Clear All Data

```bash
docker compose down -v  # -v removes volumes
docker compose up -d
```

### View Logs

```bash
# All services
docker compose logs -f

# Just sync service
docker compose logs -f zoekt-sync

# Just webserver
docker compose logs -f zoekt-webserver
```

## Troubleshooting

### "unauthorized" errors

Your GitHub token may be expired or have insufficient permissions.
- Verify token has `repo` scope
- Generate a new token if needed

### Repositories not appearing

1. Check sync logs for errors:
   ```bash
  docker compose logs zoekt-sync | grep -i error
   ```

2. Verify organization name is correct in config

3. Ensure token has access to the organization

### Search returning no results

1. Wait for initial indexing to complete (check logs)
2. Verify repos are indexed:
   ```bash
   curl -s -X POST -d '{"Q":"type:repo"}' http://localhost:6070/api/search | jq '.Result.Files[].Repository'
   ```

### Container keeps restarting

Check for configuration errors:
```bash
docker compose logs zoekt-sync
```

Common issues:
- Invalid JSON in mirror-config.json
- Missing or invalid token file

## Resource Requirements

| Resource | Minimum | Recommended (100 repos) |
|----------|---------|------------------------|
| CPU | 1 core | 2 cores |
| Memory | 1GB | 4GB |
| Disk | 10GB | 50GB+ |

Disk usage is approximately 2-3x the total size of indexed repositories.
