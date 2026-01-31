# mcp-zoekt

An MCP (Model Context Protocol) server that enables AI coding assistants to search code across indexed repositories using [Zoekt](https://github.com/sourcegraph/zoekt).

## Features

- **`search`** - Search code across indexed repositories using Zoekt query syntax
- **`list_repos`** - List all indexed repositories with optional filtering
- **`file_content`** - Retrieve full file contents from indexed repositories

## Installation

### Using npx (recommended)

```bash
npx mcp-zoekt --url http://localhost:6070
```

### From source

```bash
git clone https://github.com/jahales/mcp-zoekt.git
cd mcp-zoekt/zoekt-mcp
npm install
npm run build
npm start -- --url http://localhost:6070
```

## Prerequisites

This MCP server requires a running Zoekt infrastructure. See the `docker/` directory for Docker Compose configuration.

### Quick Start

1. Start Zoekt infrastructure:
   ```bash
   cd docker
   # Configure your GitHub token and organizations in config/
   docker-compose up -d
   ```

2. Wait for initial indexing (check logs):
   ```bash
   docker-compose logs -f zoekt-indexserver
   ```

3. Start the MCP server:
   ```bash
   npx mcp-zoekt --url http://localhost:6070
   ```

## Configuration

### CLI Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `--url` | `ZOEKT_URL` | (required) | Zoekt webserver URL |
| `--transport` | `MCP_TRANSPORT` | `stdio` | Transport: `stdio` or `http` |
| `--port` | `MCP_PORT` | `3000` | HTTP server port |
| `--host` | `MCP_HOST` | `0.0.0.0` | HTTP server host |
| `--log-level` | `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `--debug` | - | - | Shorthand for `--log-level debug` |
| `--timeout` | `ZOEKT_TIMEOUT_MS` | `30000` | Request timeout (ms) |

### Examples

```bash
# Basic usage
npx mcp-zoekt --url http://localhost:6070

# With debug logging
npx mcp-zoekt --url http://localhost:6070 --debug

# Using environment variable
ZOEKT_URL=http://localhost:6070 npx mcp-zoekt

# Custom timeout
npx mcp-zoekt --url http://localhost:6070 --timeout 60000
```

## MCP Client Configuration

### VS Code with GitHub Copilot

Add to `.vscode/settings.json`:

```json
{
  "github.copilot.chat.experimental.mcpServers": {
    "zoekt": {
      "command": "npx",
      "args": ["mcp-zoekt", "--url", "http://localhost:6070"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "zoekt": {
      "command": "npx",
      "args": ["mcp-zoekt", "--url", "http://localhost:6070"]
    }
  }
}
```

### Continue.dev

Add to your Continue configuration:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["mcp-zoekt", "--url", "http://localhost:6070"]
        }
      }
    ]
  }
}
```

## Tool Reference

### `search`

Search code across indexed repositories using Zoekt query syntax.

**Input:**
- `query` (required): Zoekt search query
- `limit` (optional): Maximum results (1-100, default: 30)
- `contextLines` (optional): Context lines around matches (0-10, default: 3)

**Query Syntax:**
```
# Simple text search
authentication

# Regex
func.*Handler

# File filter
file:\.ts$

# Language filter
lang:typescript

# Repository filter
repo:my-org/my-repo

# Combine filters
lang:go func.*Error file:handler

# Symbol search
sym:MyClass

# Boolean operators
(auth OR authentication) AND NOT test
```

### `list_repos`

List all indexed repositories.

**Input:**
- `filter` (optional): Regex pattern to filter repository names

**Examples:**
```
# List all repositories
{}

# Filter by organization
{"filter": "my-org"}

# Filter by pattern
{"filter": ".*-api$"}
```

### `file_content`

Retrieve full file contents from an indexed repository.

**Input:**
- `repository` (required): Full repository name (e.g., `github.com/org/repo`)
- `path` (required): File path within the repository
- `branch` (optional): Branch name (default: HEAD)

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test           # Unit tests (watch mode)
npm run test:run   # Unit tests (single run)
```

### Integration Tests

Integration tests require a running Zoekt instance. Use the test infrastructure:

```bash
# Start test infrastructure
cd docker
docker compose -f docker-compose.test.yml up -d

# Wait for Zoekt to be ready (check health)
curl http://localhost:6070/api/list

# Run integration tests
cd ../zoekt-mcp
npm run test:integration

# Run all tests (unit + integration)
npm run test:all

# Stop test infrastructure
cd ../docker
docker compose -f docker-compose.test.yml down
```

The test infrastructure includes:
- Zoekt webserver on port 6070
- Embedded test corpus in `tests/fixtures/test-repo/`
- Pre-configured indexer for deterministic test results

### Type Check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

## License

MIT
