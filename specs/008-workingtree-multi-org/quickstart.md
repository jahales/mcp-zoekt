# Quickstart: Working Tree Indexing & Multi-Org Support

**Feature**: 008-workingtree-multi-org  
**Purpose**: Validate the implementation end-to-end

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- A local directory with source code files (for working-tree mode)
- A GitHub personal access token (for GitHub mirror mode, optional)

## Scenario 1: Working Tree Mode (US1 + US2)

### Setup

```bash
cd docker/

# Create .env file for working-tree mode
cat > .env << 'EOF'
COMPOSE_PROFILES=workingtree
WORKSPACE_ROOT=/path/to/your/project
INDEX_INTERVAL=30
EOF

# Build and start
docker compose build
docker compose up -d
```

### Validate Indexing

```bash
# Wait for first index cycle (~30s)
sleep 35

# Check webserver is healthy
curl -s http://localhost:6070/ | head -5

# Search for a known string in your project
curl -s -X POST http://localhost:6070/api/search \
  -d '{"Q": "function", "Opts": {"MaxMatchDisplayCount": 5}}' | jq '.Result.FileMatches | length'
# Expected: > 0
```

### Validate MCP Tools

```bash
cd ../zoekt-mcp
npm run build

# First, discover the repository name Zoekt assigned to the working tree
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_repos","arguments":{}}}' | node dist/index.js --url http://localhost:6070 2>/dev/null

# Then, use that repository name for file_content (branch omitted)
# (Replace REPO_NAME with the repo shown by list_repos)
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"file_content","arguments":{"repository":"REPO_NAME","path":"README.md"}}}' | node dist/index.js --url http://localhost:6070 2>/dev/null

# Test list_repos (should show working-tree repo without crashing)
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_repos","arguments":{}}}' | node dist/index.js --url http://localhost:6070 2>/dev/null

# Test search (should return results without branch crash)
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search","arguments":{"query":"import"}}}' | node dist/index.js --url http://localhost:6070 2>/dev/null
```

### Expected Results

- [ ] Indexer container runs and logs "Indexing working tree..." every 30s
- [ ] Webserver returns search results for files in the working tree
- [ ] `list_repos` succeeds without error (null-safe branch handling)
- [ ] `search` results display "HEAD" for branch when no branch data exists
- [ ] `file_content` works without specifying a branch parameter

## Scenario 2: Multi-Org GitHub Mode (US3)

### Setup

```bash
cd docker/

# Create config
mkdir -p config
echo "ghp_your_token_here" > config/github-token.txt

# Create .env for multi-org mode
cat > .env << 'EOF'
COMPOSE_PROFILES=github
GITHUB_ORGS=org-a,org-b
SYNC_INTERVAL=300
EOF

# Build and start
docker compose build
docker compose up -d
```

### Validate Multi-Org Mirroring

```bash
# Watch sync logs
docker logs -f zoekt-sync

# Expected log output:
# [2026-...] Sync cycle starting for org-a
# [2026-...] Mirroring org-a...
# [2026-...] Indexing org-a repositories...
# [2026-...] Sync complete for org-a
# [2026-...] Sync cycle starting for org-b
# ...
```

### Edge Case: Invalid Org

```bash
# Set one valid, one invalid org
cat > .env << 'EOF'
COMPOSE_PROFILES=github
GITHUB_ORGS=valid-org,nonexistent-org-12345
SYNC_INTERVAL=60
EOF

docker compose up -d
docker logs -f zoekt-sync

# Expected: WARNING for nonexistent org, continues to next org
```

### Expected Results

- [ ] Sync container mirrors repos from all configured orgs
- [ ] Repos from both orgs appear in search results
- [ ] Invalid org logs a warning but doesn't stop the sync cycle
- [ ] Whitespace in org names is trimmed correctly

## Scenario 3: Dual Mode (US4)

### Setup

```bash
cd docker/

cat > .env << 'EOF'
COMPOSE_PROFILES=workingtree,github
WORKSPACE_ROOT=/path/to/your/project
INDEX_INTERVAL=60
GITHUB_ORGS=my-org
SYNC_INTERVAL=3600
EOF

docker compose build
docker compose up -d
```

### Validate

```bash
# All three containers should be running
docker ps --format "table {{.Names}}\t{{.Status}}"
# Expected:
# zoekt-webserver   Up ...
# zoekt-indexer     Up ...
# zoekt-sync        Up ...

# Search should return results from both local files and GitHub repos
curl -s -X POST http://localhost:6070/api/search \
  -d '{"Q": "import", "Opts": {"MaxMatchDisplayCount": 10}}' | jq '.Result.FileMatches[].Repository'
```

### Expected Results

- [ ] Three containers running simultaneously
- [ ] Search results include both working-tree files and mirrored GitHub repos
- [ ] Each index source is distinguishable by repository name

## Scenario 4: Backward Compatibility (US3-AC3)

### Setup

```bash
cd docker/

# Use the OLD single-org env var
cat > .env << 'EOF'
COMPOSE_PROFILES=github
GITHUB_ORG=my-single-org
SYNC_INTERVAL=60
EOF

docker compose up -d
docker logs zoekt-sync
```

### Expected Results

- [ ] Sync service starts and mirrors the single org
- [ ] No errors about GITHUB_ORGS being missing

## Cleanup

```bash
docker compose down -v
rm -f .env config/github-token.txt
```
