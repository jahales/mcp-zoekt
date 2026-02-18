# Zoekt Docker Infrastructure

Docker Compose configuration for running Zoekt code search indexing infrastructure.

## Overview

This directory contains:
- `docker-compose.yml` - Service definitions for Zoekt webserver, GitHub sync, and working-tree indexing
- `.env` (optional) - Environment variables such as `COMPOSE_PROFILES`, `WORKSPACE_ROOT`, `GITHUB_ORGS`, `SYNC_INTERVAL`
- `.env.example` - Copy/paste template for `.env`
- `config/github-token.txt` - Your GitHub Personal Access Token (not committed; required only for GitHub mode)

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
