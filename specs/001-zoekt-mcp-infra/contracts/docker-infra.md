# Docker Infrastructure Contract

**Feature**: 001-zoekt-mcp-infra  
**Date**: 2026-01-30

## Docker Compose Services

### Service: `zoekt-webserver`

Serves the Zoekt search API.

| Property | Value |
|----------|-------|
| Image | `sourcegraph/zoekt:latest` |
| Command | `zoekt-webserver -index /data/index -rpc` |
| Ports | `6070:6070` (configurable) |
| Volumes | `zoekt-data:/data:ro` |
| Health Check | `GET /` returns 200 |
| Restart | `unless-stopped` |

### Service: `zoekt-indexserver`

Periodically mirrors GitHub repos and builds indexes.

| Property | Value |
|----------|-------|
| Image | `sourcegraph/zoekt:latest` |
| Command | `zoekt-indexserver -mirror_config /config/mirror-config.json -data_dir /data` |
| Volumes | `zoekt-data:/data`, `./config:/config:ro` |
| Restart | `unless-stopped` |
| Depends On | None |

### Volume: `zoekt-data`

Persistent storage for git clones and search indexes.

| Property | Value |
|----------|-------|
| Driver | `local` |
| Mount Points | `/data/repos/` (git clones), `/data/index/` (zoekt shards) |

---

## Configuration Files

### `config/mirror-config.json`

```json
[
  {
    "GithubOrg": "your-org",
    "CredentialPath": "/config/github-token.txt",
    "NoArchived": true,
    "Forks": false
  }
]
```

### `config/github-token.txt`

```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Security**: This file MUST be in `.gitignore` and MUST NOT be committed.

---

## Network

### Internal Communication

```
┌─────────────────────────────────────────────┐
│           Docker Network: zoekt             │
│                                             │
│  ┌─────────────┐      ┌─────────────────┐   │
│  │ indexserver │─────▶│  zoekt-data     │   │
│  │             │      │  volume         │   │
│  └─────────────┘      └────────┬────────┘   │
│                                │            │
│                       ┌────────▼────────┐   │
│                       │  webserver      │   │
│                       │  :6070          │   │
│                       └────────┬────────┘   │
│                                │            │
└────────────────────────────────┼────────────┘
                                 │
                          Host port 6070
                                 │
                    ┌────────────▼────────────┐
                    │    MCP Server           │
                    │    (host or container)  │
                    └─────────────────────────┘
```

### Exposed Ports

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| 6070 | webserver | HTTP | Search API |

---

## Environment Variables

### Indexserver

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `/data` | Base directory for repos and indexes |
| `MIRROR_CONFIG` | `/config/mirror-config.json` | Config file path |
| `INDEX_INTERVAL` | `1h` | Re-indexing interval |

### Webserver

| Variable | Default | Description |
|----------|---------|-------------|
| `INDEX_DIR` | `/data/index` | Index shard directory |
| `LISTEN_ADDR` | `:6070` | HTTP listen address |

---

## Operations

### Health Checks

```yaml
zoekt-webserver:
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:6070/"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Logging

Both services log to stdout/stderr. Use Docker logging drivers for aggregation.

### Graceful Shutdown

Both services handle SIGTERM for graceful shutdown:
- Webserver: Drains active requests
- Indexserver: Completes current indexing operation

---

## Resource Recommendations

| Resource | Minimum | Recommended (100 repos) |
|----------|---------|------------------------|
| CPU | 1 core | 2 cores |
| Memory | 1GB | 4GB |
| Disk | 10GB | 50GB+ (depends on repo sizes) |
