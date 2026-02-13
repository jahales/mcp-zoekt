# Zoekt Docker Infrastructure

Docker Compose configuration for running Zoekt code search indexing infrastructure.

## Overview

This directory contains:
- `docker-compose.yml` - Service definitions for Zoekt sync and webserver
- `.env` (optional) - Environment variables such as `GITHUB_ORG` and `SYNC_INTERVAL`
- `config/github-token.txt` - Your GitHub Personal Access Token (not committed)

## Quick Start

### 1. Create GitHub Token

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

### 3. Configure Organization

Set `GITHUB_ORG` (source of truth for `docker-compose.yml`):

```bash
echo "GITHUB_ORG=your-org-name" > .env
```

Or export it in your shell before running compose:

```bash
export GITHUB_ORG=your-org-name
```

### 4. Start Services

```bash
docker compose up -d
```

### 5. Monitor Indexing

```bash
docker compose logs -f zoekt-sync
```

Initial indexing may take 10-60 minutes depending on the number and size of repositories.

### 6. Verify

```bash
curl -s -X POST -d '{"Q":"type:repo"}' http://localhost:6070/api/search | jq '.Result.Files[].Repository' | sort -u
```

## Configuration Reference

### Note on mirror-config.json

`docker-compose.yml` currently mirrors a single GitHub organization using `GITHUB_ORG`.

`config/mirror-config.json` is not consumed by this local compose stack. If you need
advanced multi-org scheduling/configuration, use the production workflow documented in
`docker-compose.prod.yml` with `update-index.sh`.

## Environment Variables

### zoekt-sync

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_INTERVAL` | `3600` | Seconds between sync cycles |

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
# Restart sync service to trigger immediate mirror+index cycle
docker compose restart zoekt-sync
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
