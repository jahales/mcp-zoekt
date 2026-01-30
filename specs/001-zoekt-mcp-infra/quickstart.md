# Quickstart: Zoekt MCP Infrastructure

Get code search across your private GitHub repositories in 5 minutes.

## Prerequisites

- Docker & Docker Compose
- GitHub Personal Access Token with `repo` scope
- Node.js 18+ (for MCP server)

## Step 1: Start the Indexing Infrastructure

1. **Create configuration directory:**
   ```bash
   mkdir -p docker/config
   ```

2. **Create GitHub token file:**
   ```bash
   echo "ghp_your_token_here" > docker/config/github-token.txt
   ```

3. **Create mirror configuration:**
   ```bash
   cat > docker/config/mirror-config.json << 'EOF'
   [
     {
       "GithubOrg": "your-org-name",
       "CredentialPath": "/config/github-token.txt",
       "NoArchived": true,
       "Forks": false
     }
   ]
   EOF
   ```

4. **Start Docker services:**
   ```bash
   cd docker
   docker-compose up -d
   ```

5. **Monitor indexing progress:**
   ```bash
   docker-compose logs -f zoekt-indexserver
   ```
   
   Wait until you see repositories being indexed. Initial sync may take 10-30 minutes depending on the number and size of repositories.

## Step 2: Verify Indexing

Check that repositories are indexed:

```bash
curl "http://localhost:6070/search?q=type:repo&format=json" | jq '.result.FileMatches[].Repository'
```

You should see your repository names listed.

## Step 3: Run the MCP Server

**Option A: Using npx (recommended)**
```bash
npx zoekt-mcp --url http://localhost:6070
```

**Option B: From source**
```bash
cd zoekt-mcp
npm install
npm run build
npm start -- --url http://localhost:6070
```

## Step 4: Configure Your AI Assistant

### VS Code with GitHub Copilot

Add to `.vscode/settings.json`:
```json
{
  "github.copilot.chat.experimental.mcpServers": {
    "zoekt": {
      "command": "npx",
      "args": ["zoekt-mcp", "--url", "http://localhost:6070"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "zoekt": {
      "command": "npx",
      "args": ["zoekt-mcp", "--url", "http://localhost:6070", "--transport", "stdio"]
    }
  }
}
```

## Step 5: Search Your Code

Example queries to try:

```
# Find authentication handlers
search: "auth" lang:typescript func.*Handler

# Find all TODO comments
search: TODO -file:test

# Find React components using a specific hook
search: useAuth file:\.tsx$

# Find error handling patterns
search: catch.*error lang:go
```

## Troubleshooting

### No search results?

1. Check if indexing is complete:
   ```bash
   docker-compose logs zoekt-indexserver | tail -20
   ```

2. Verify webserver is running:
   ```bash
   curl http://localhost:6070/
   ```

3. Check if any repos are indexed:
   ```bash
   curl "http://localhost:6070/search?q=type:repo&format=json"
   ```

### MCP connection issues?

1. Test the MCP server directly:
   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npx zoekt-mcp --url http://localhost:6070 --transport stdio
   ```

2. Check logs:
   ```bash
   npx zoekt-mcp --url http://localhost:6070 --log-level debug
   ```

### Rate limiting?

If GitHub API rate limits are hit:
- Wait 1 hour for limits to reset
- Use a token with higher rate limits (GitHub Enterprise)
- Reduce the number of organizations in config

## Next Steps

- **Add more organizations**: Edit `docker/config/mirror-config.json`
- **Filter by topic**: Add `"Topics": ["backend", "api"]` to config
- **Exclude repos**: Add `"Exclude": "^legacy-.*"` regex pattern
- **Adjust sync frequency**: Modify `INDEX_INTERVAL` environment variable
