# Contract: Docker Infrastructure

**Feature**: 008-workingtree-multi-org  
**Date**: 2026-02-18

## docker-compose.yml Service Definitions

### zoekt-webserver (always runs)

```yaml
zoekt-webserver:
  # No profiles key - always starts
  image: zoekt:local
  container_name: zoekt-webserver
  command: zoekt-webserver -index /data/index -rpc
  ports:
    - "6070:6070"
  volumes:
    - zoekt-data:/data:ro
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:6070/"]
    interval: 30s
    timeout: 10s
    retries: 3
  networks:
    - zoekt
```

### zoekt-indexer (working-tree profile)

```yaml
zoekt-indexer:
  profiles: [workingtree]
  image: zoekt:local
  container_name: zoekt-indexer
  environment:
    - WORKSPACE_ROOT=${WORKSPACE_ROOT:?WORKSPACE_ROOT is required for workingtree profile}
    - INDEX_INTERVAL=${INDEX_INTERVAL:-60}
  entrypoint: ["/bin/sh", "-c"]
  command:
    - |
      while true; do
        echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Indexing working tree..."
        zoekt-index \
          -index /data/index \
          -ignore_dirs "node_modules,dist,build,vendor,.git,.hg,.svn,__pycache__,.venv,.tox,.mypy_cache,.pytest_cache,coverage,.nyc_output,.next,.nuxt" \
          /workspace || true
        echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Indexing complete. Sleeping ${INDEX_INTERVAL}s..."
        sleep ${INDEX_INTERVAL}
      done
  volumes:
    - zoekt-data:/data
    - ${WORKSPACE_ROOT}:/workspace:ro
  restart: unless-stopped
  networks:
    - zoekt
```

### zoekt-sync (github profile)

```yaml
zoekt-sync:
  profiles: [github]
  image: zoekt:local
  container_name: zoekt-sync
  environment:
    - GITHUB_ORGS=${GITHUB_ORGS:-${GITHUB_ORG:?Set GITHUB_ORGS or GITHUB_ORG for github profile}}
    - SYNC_INTERVAL=${SYNC_INTERVAL:-3600}
  entrypoint: ["/bin/sh", "-c"]
  command:
    - |
      TOKEN=$$(cat /config/github-token.txt)
      git config --global url."https://$$TOKEN@github.com/".insteadOf "https://github.com/"
      while true; do
        # Deduplicate and trim org names
        ORGS=$$(echo "$${GITHUB_ORGS}" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$$//' | sort -u | tr '\n' ',' | sed 's/,$$//')
        IFS=','
        for ORG in $${ORGS}; do
          echo "[$$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Sync cycle starting for $${ORG}"
          echo "[$$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Mirroring $${ORG}..."
          zoekt-mirror-github -dest /data/repos -org "$${ORG}" -token /config/github-token.txt -no_archived || echo "WARNING: Failed to mirror $${ORG}, continuing..."
          echo "[$$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Indexing $${ORG} repositories..."
          for repo in /data/repos/github.com/$${ORG}/*.git; do
            if [ -d "$$repo" ]; then
              echo "Indexing $$repo..."
              zoekt-git-index -index /data/index "$$repo" || echo "Failed to index $$repo"
            fi
          done
          echo "[$$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Sync complete for $${ORG}"
        done
        unset IFS
        echo "[$$(date -u '+%Y-%m-%dT%H:%M:%SZ')] All orgs synced. Sleeping $${SYNC_INTERVAL}s..."
        sleep $${SYNC_INTERVAL}
      done
  volumes:
    - zoekt-data:/data
    - ./config:/config:ro
  restart: unless-stopped
  networks:
    - zoekt
```

## Environment Variable Contract

### .env file template

```env
# ============================================================
# Zoekt MCP - Docker Configuration
# ============================================================
# Activate one or both profiles:
#   workingtree - Index a local directory
#   github      - Mirror GitHub organization repos
COMPOSE_PROFILES=workingtree

# ── Working Tree Mode ──
WORKSPACE_ROOT=/path/to/your/project
INDEX_INTERVAL=60

# ── GitHub Mirror Mode ──
# GITHUB_ORGS=my-company,my-oss-org
# SYNC_INTERVAL=3600
```

### Variable Precedence

| Condition | Behavior |
|-----------|----------|
| `GITHUB_ORGS` set | Use `GITHUB_ORGS` (comma-separated) |
| `GITHUB_ORGS` unset, `GITHUB_ORG` set | Use `GITHUB_ORG` (single value) |
| Both unset, github profile active | Error: "Set GITHUB_ORGS or GITHUB_ORG" |
| Neither profile active | Error from Docker Compose (no services to start) |

## Profile Activation Patterns

| Use Case | COMPOSE_PROFILES | Required Vars |
|----------|-----------------|---------------|
| Local working tree only | `workingtree` | `WORKSPACE_ROOT` |
| Single GitHub org | `github` | `GITHUB_ORG` + token file |
| Multiple GitHub orgs | `github` | `GITHUB_ORGS` + token file |
| Dual mode | `workingtree,github` | All of the above |
