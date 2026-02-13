# Quickstart: Continuous Reindex Verification

**Feature**: `006-continuous-reindex`  
**Date**: 2026-02-13

## Prerequisites

- Docker and Docker Compose installed
- A GitHub Personal Access Token with `repo` scope saved at `docker/config/github-token.txt`
- A `.env` file (or exported env var) with `GITHUB_ORG=<your-org>`
- The `zoekt:local` Docker image built (`docker build -t zoekt:local -f docker/Dockerfile.zoekt zoekt/`)

## 1. Start the Stack

```bash
cd docker
GITHUB_ORG=your-org docker compose up -d
```

## 2. Verify First Sync Cycle

Watch the new `zoekt-sync` container logs:

```bash
docker compose logs -f zoekt-sync
```

You should see timestamped output like:

```
[2026-02-13T10:00:00Z] Sync cycle starting for your-org
[2026-02-13T10:00:00Z] Mirroring your-org...
  ... (mirror output)
[2026-02-13T10:01:30Z] Indexing repositories...
  Indexing /data/repos/github.com/your-org/repo1.git...
  Indexing /data/repos/github.com/your-org/repo2.git...
[2026-02-13T10:02:00Z] Sync cycle complete. Sleeping 3600s...
```

## 3. Verify Search Works

After the first cycle completes:

```bash
curl -s -X POST -d '{"Q":"type:repo"}' http://localhost:6070/api/search | jq '.Result.Files[].Repository' | sort -u
```

This should list all indexed repositories.

## 4. Verify Continuous Reindexing

To test with a short interval:

```bash
docker compose down
GITHUB_ORG=your-org SYNC_INTERVAL=120 docker compose up -d
docker compose logs -f zoekt-sync
```

You should see a new sync cycle start every ~2 minutes (plus cycle duration).

## 5. Verify Error Resilience

Temporarily break the token to simulate a transient failure:

```bash
# Rename the token file
mv config/github-token.txt config/github-token.txt.bak

# Watch logs — mirror should fail but container stays running
docker compose logs -f zoekt-sync
# Expected: error message, then "Sync cycle complete. Sleeping..."

# Restore the token
mv config/github-token.txt.bak config/github-token.txt
# Next cycle should succeed
```

## 6. Verify Graceful Shutdown

```bash
docker compose down
docker compose ps
```

No containers should be running. The volume persists — on next `up`, the index is already populated.

## Acceptance Checklist

- [ ] First sync cycle completes (mirror + index) without errors
- [ ] Search returns results after first cycle
- [ ] Second sync cycle starts automatically after the sleep interval
- [ ] Custom `SYNC_INTERVAL` is respected
- [ ] Default interval (3600s) is used when `SYNC_INTERVAL` is not set
- [ ] Transient mirror failure doesn't crash the container
- [ ] Single repo index failure doesn't prevent indexing other repos
- [ ] `docker compose down` stops the container cleanly
