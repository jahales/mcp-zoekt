# Zoekt Docker Infrastructure

Docker Compose configuration for running Zoekt code search indexing infrastructure.

## Overview

This directory contains:
- `docker-compose.yml` - Service definitions for Zoekt indexserver and webserver
- `config/mirror-config.json` - Configuration for which GitHub repositories to index
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

### 3. Configure Organizations

Edit `config/mirror-config.json`:

```json
[
  {
    "GithubOrg": "your-org-name",
    "CredentialPath": "/config/github-token.txt",
    "NoArchived": true,
    "Forks": false
  }
]
```

### 4. Start Services

```bash
docker-compose up -d
```

### 5. Monitor Indexing

```bash
docker-compose logs -f zoekt-indexserver
```

Initial indexing may take 10-60 minutes depending on the number and size of repositories.

### 6. Verify

```bash
curl -s -X POST -d '{"Q":"type:repo"}' http://localhost:6070/api/search | jq '.Result.Files[].Repository' | sort -u
```

## Configuration Reference

### mirror-config.json

| Property | Type | Description |
|----------|------|-------------|
| `GithubOrg` | string | GitHub organization to index |
| `GithubUser` | string | GitHub user to index (alternative to GithubOrg) |
| `GitHubURL` | string | GitHub Enterprise URL (optional) |
| `CredentialPath` | string | Path to token file inside container |
| `Name` | string | Regex to filter repository names |
| `Exclude` | string | Regex to exclude repositories |
| `Topics` | string[] | Filter by repository topics |
| `ExcludeTopics` | string[] | Exclude by repository topics |
| `NoArchived` | boolean | Skip archived repositories |
| `Forks` | boolean | Include forked repositories |
| `Visibility` | string[] | Filter by visibility: `public`, `private`, `internal` |

### Multi-Organization Example

```json
[
  {
    "GithubOrg": "my-company",
    "CredentialPath": "/config/github-token.txt",
    "NoArchived": true,
    "Forks": false,
    "Topics": ["production", "core"]
  },
  {
    "GithubOrg": "my-company-internal",
    "CredentialPath": "/config/github-token.txt",
    "NoArchived": true,
    "Exclude": "^(deprecated|archive)-"
  },
  {
    "GithubUser": "team-lead-username",
    "CredentialPath": "/config/github-token.txt"
  }
]
```

## Environment Variables

### zoekt-indexserver

| Variable | Default | Description |
|----------|---------|-------------|
| `INDEX_INTERVAL` | `1h` | How often to sync and re-index |

To change the sync interval:

```yaml
# In docker-compose.yml
zoekt-indexserver:
  environment:
    - INDEX_INTERVAL=30m
```

### zoekt-webserver

| Variable | Default | Description |
|----------|---------|-------------|
| `LISTEN_ADDR` | `:6070` | HTTP listen address |

## Operations

### Check Indexing Status

```bash
# View current indexing activity
docker-compose logs zoekt-indexserver | tail -50

# Count indexed repositories
curl -s -X POST -d '{"Q":"type:repo"}' http://localhost:6070/api/search | jq '[.Result.Files[].Repository] | unique | length'
```

### Force Re-index

```bash
# Restart indexserver to trigger immediate sync
docker-compose restart zoekt-indexserver
```

### Clear All Data

```bash
docker-compose down -v  # -v removes volumes
docker-compose up -d
```

### View Logs

```bash
# All services
docker-compose logs -f

# Just indexer
docker-compose logs -f zoekt-indexserver

# Just webserver
docker-compose logs -f zoekt-webserver
```

## Troubleshooting

### "unauthorized" errors

Your GitHub token may be expired or have insufficient permissions.
- Verify token has `repo` scope
- Generate a new token if needed

### Repositories not appearing

1. Check indexer logs for errors:
   ```bash
   docker-compose logs zoekt-indexserver | grep -i error
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
docker-compose logs zoekt-indexserver
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
