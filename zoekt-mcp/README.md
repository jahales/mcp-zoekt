# mcp-zoekt

[![GitHub Packages](https://img.shields.io/badge/GitHub%20Packages-@jahales/mcp--zoekt-blue)](https://github.com/jahales/mcp-zoekt/pkgs/npm/mcp-zoekt)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

An MCP (Model Context Protocol) server that enables AI coding assistants to search code across indexed repositories using [Zoekt](https://github.com/sourcegraph/zoekt).

## Features

- **`search`** - Search code across indexed repositories using Zoekt query syntax
- **`search_symbols`** - Search for symbol names (functions, classes, methods, variables)
- **`search_files`** - Search for files by filename pattern
- **`find_references`** - Find all definitions and usages of a symbol
- **`list_repos`** - List all indexed repositories with optional filtering
- **`file_content`** - Retrieve full file contents from indexed repositories
- **`get_health`** - Check health status of MCP server and Zoekt backend

## Quick Install

### VS Code with GitHub Copilot

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-NPM-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=zoekt&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40jahales%2Fmcp-zoekt%22%2C%22--url%22%2C%22http%3A%2F%2Flocalhost%3A6070%22%5D%7D) [![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-NPM-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=zoekt&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40jahales%2Fmcp-zoekt%22%2C%22--url%22%2C%22http%3A%2F%2Flocalhost%3A6070%22%5D%7D&quality=insiders)

[![Install with Docker in VS Code](https://img.shields.io/badge/VS_Code-Docker-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=zoekt&config=%7B%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22--network%22%2C%22host%22%2C%22-e%22%2C%22ZOEKT_URL%3Dhttp%3A%2F%2Flocalhost%3A6070%22%2C%22ghcr.io%2Fjahales%2Fmcp-zoekt%22%5D%7D) [![Install with Docker in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Docker-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=zoekt&config=%7B%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22--network%22%2C%22host%22%2C%22-e%22%2C%22ZOEKT_URL%3Dhttp%3A%2F%2Flocalhost%3A6070%22%2C%22ghcr.io%2Fjahales%2Fmcp-zoekt%22%5D%7D&quality=insiders)

## Installation

### Using npx (recommended)

First, configure GitHub Packages registry in your `~/.npmrc`:

```bash
@jahales:registry=https://npm.pkg.github.com
```

Then run:

```bash
npx @jahales/mcp-zoekt --url http://localhost:6070
```

### Using Docker

```bash
docker run -i --rm --network host \
  -e ZOEKT_URL=http://localhost:6070 \
  ghcr.io/jahales/mcp-zoekt
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
npx @jahales/mcp-zoekt --url http://localhost:6070
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
npx @jahales/mcp-zoekt --url http://localhost:6070

# With debug logging
npx @jahales/mcp-zoekt --url http://localhost:6070 --debug

# Using environment variable
ZOEKT_URL=http://localhost:6070 npx @jahales/mcp-zoekt

# Custom timeout
npx @jahales/mcp-zoekt --url http://localhost:6070 --timeout 60000
```

## MCP Client Configuration

### VS Code with GitHub Copilot

#### Using npx

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "zoekt": {
      "command": "npx",
      "args": ["-y", "@jahales/mcp-zoekt", "--url", "http://localhost:6070"]
    }
  }
}
```

#### Using Docker

```json
{
  "servers": {
    "zoekt": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--network", "host",
        "-e", "ZOEKT_URL=http://localhost:6070",
        "ghcr.io/jahales/mcp-zoekt"
      ]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

#### Using npx

```json
{
  "mcpServers": {
    "zoekt": {
      "command": "npx",
      "args": ["-y", "@jahales/mcp-zoekt", "--url", "http://localhost:6070"]
    }
  }
}
```

#### Using Docker

```json
{
  "mcpServers": {
    "zoekt": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--network", "host",
        "-e", "ZOEKT_URL=http://localhost:6070",
        "ghcr.io/jahales/mcp-zoekt"
      ]
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
          "args": ["-y", "@jahales/mcp-zoekt", "--url", "http://localhost:6070"]
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

### `search_symbols`

Search for symbol names (functions, classes, methods, variables) across repositories. Automatically uses Zoekt's `sym:` query prefix.

**Input:**
- `query` (required): Symbol search query
- `limit` (optional): Maximum results (1-100, default: 30)
- `contextLines` (optional): Context lines around matches (0-10, default: 3)
- `cursor` (optional): Pagination cursor from previous response

**Examples:**
```
# Find symbols named handleRequest
{"query": "handleRequest"}

# Symbols starting with "get" (regex)
{"query": "/^get.*/"}

# TypeScript symbols matching "handler"
{"query": "handler lang:typescript"}

# Symbol in specific repo
{"query": "UserService repo:myorg/myrepo"}
```

### `search_files`

Search for files by filename pattern. Returns file paths only, not content.

**Input:**
- `query` (required): File name search query
- `limit` (optional): Maximum results (1-100, default: 30)
- `cursor` (optional): Pagination cursor from previous response

**Examples:**
```
# Exact filename match
{"query": "package.json"}

# TypeScript test files (regex)
{"query": "/.*\\.test\\.ts$/"}

# README in specific repo
{"query": "README.md repo:myorg/myrepo"}

# YAML config files
{"query": "config lang:yaml"}
```

### `find_references`

Find all definitions and usages of a symbol across repositories. Returns both where the symbol is defined and where it is used.

**Input:**
- `symbol` (required): Symbol to find references for
- `filters` (optional): Additional query filters (lang:, repo:, etc.)
- `limit` (optional): Maximum results (1-100, default: 30)
- `contextLines` (optional): Context lines around matches (0-10, default: 3)
- `cursor` (optional): Pagination cursor from previous response

**Examples:**
```
# Find all references to handleRequest
{"symbol": "handleRequest"}

# TypeScript only
{"symbol": "UserService", "filters": "lang:typescript"}

# Within specific repo
{"symbol": "validateInput", "filters": "repo:backend"}
```

### `get_health`

Check health status of the MCP server and Zoekt backend. Returns connectivity status, server version, and index statistics.

**Input:** None required

**Output:**
- Health status: healthy, degraded, or unhealthy
- MCP server version
- Zoekt backend connectivity
- Index statistics (repository count, document count, index size)

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
