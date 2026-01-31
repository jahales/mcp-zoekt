# mcp-zoekt

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that enables AI coding assistants to search code across indexed repositories using [Zoekt](https://github.com/sourcegraph/zoekt).

## Overview

This repository provides:

- **`zoekt-mcp/`** - TypeScript MCP server that connects AI assistants (GitHub Copilot, Claude, etc.) to Zoekt
- **`docker/`** - Docker Compose infrastructure for self-hosting Zoekt with GitHub organization indexing
- **`zoekt/`** - Git submodule reference to [sourcegraph/zoekt](https://github.com/sourcegraph/zoekt)

## Quick Start

### 1. Start Zoekt Infrastructure

```bash
cd docker

# Create config directory and add your GitHub token
mkdir -p config
echo "ghp_your_token_here" > config/github-token.txt

# Configure organizations to index (edit docker-compose.yml)
# Then start services
docker-compose up -d
```

### 2. Configure Your AI Assistant

**VS Code with GitHub Copilot** - Add to `.vscode/settings.json`:

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

**Claude Desktop** - Add to your config file:

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

### 3. Search Your Code

Ask your AI assistant to search across your indexed repositories:

> "Search for authentication middleware in my codebase"
> "Find all usages of the UserService class"
> "Show me how error handling is implemented"

## MCP Tools

| Tool | Description |
|------|-------------|
| `search` | Search code using Zoekt query syntax (regex, file filters, language filters) |
| `list_repos` | List all indexed repositories with optional filtering |
| `file_content` | Retrieve full file contents from indexed repositories |

## Documentation

- [MCP Server Documentation](zoekt-mcp/README.md) - Detailed MCP server usage and configuration
- [Docker Setup](docker/README.md) - Infrastructure setup and configuration options

## Development

```bash
# Install dependencies
cd zoekt-mcp
npm install

# Run tests
npm test              # Unit tests
npm run test:all      # All tests (requires Docker infrastructure)

# Build
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

Zoekt is licensed under Apache 2.0 by Sourcegraph - see [zoekt/LICENSE](https://github.com/sourcegraph/zoekt/blob/main/LICENSE).
