# MCP Tool Contracts

**Feature**: 001-zoekt-mcp-infra  
**Date**: 2026-01-30

## Tool: `search`

Search code across indexed repositories using Zoekt query syntax.

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Zoekt search query. Supports regex, file filters (file:, lang:), repo filters (repo:), symbol search (sym:), and boolean operators (and, or, not)."
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 30,
      "description": "Maximum number of file matches to return"
    },
    "contextLines": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10,
      "default": 3,
      "description": "Number of context lines to include around each match"
    }
  },
  "required": ["query"]
}
```

### Response Format

```text
## Results for: `{query}`

### {Repository} - {FileName}
Language: {Language} | Branch: {Branch}

```{Language}
{Line with match highlighted}
{Context lines}
```

Line {LineNum}: {matched text}

---

Stats: {MatchCount} matches in {FileCount} files ({Duration}ms)
```

### Error Responses

| Error | Message |
|-------|---------|
| Backend unavailable | "Search backend unavailable at {url}. Ensure zoekt-webserver is running." |
| Query syntax error | "Query syntax error: {zoekt error message}" |
| Timeout | "Search timed out after {timeout}ms. Try a more specific query." |

---

## Tool: `list_repos`

List all indexed repositories or filter by name pattern.

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "filter": {
      "type": "string",
      "description": "Optional filter pattern to match repository names (regex supported)"
    }
  },
  "required": []
}
```

### Response Format

```text
## Indexed Repositories

Found {count} repositories{filter ? ` matching '${filter}'` : ''}:

1. github.com/org/repo-a (main, develop) - 1,234 files
2. github.com/org/repo-b (main) - 567 files
...

Total: {count} repositories
```

### Error Responses

| Error | Message |
|-------|---------|
| Backend unavailable | "Search backend unavailable at {url}. Ensure zoekt-webserver is running." |
| No repositories | "No repositories are currently indexed." |

---

## Tool: `file_content`

Retrieve the full contents of a file from an indexed repository.

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "Full repository name (e.g., 'github.com/org/repo')"
    },
    "path": {
      "type": "string",
      "description": "Path to the file within the repository"
    },
    "branch": {
      "type": "string",
      "description": "Branch name (default: HEAD)",
      "default": "HEAD"
    }
  },
  "required": ["repository", "path"]
}
```

### Response Format

```text
## {repository}/{path}

Branch: {branch}

```{detected language}
{file contents}
```
```

### Error Responses

| Error | Message |
|-------|---------|
| File not found | "File not found: {repository}/{path}" |
| Repository not found | "Repository not indexed: {repository}" |
| Backend unavailable | "Search backend unavailable at {url}. Ensure zoekt-webserver is running." |

---

## Server Info

### Capabilities

```json
{
  "name": "zoekt-mcp",
  "version": "1.0.0",
  "capabilities": {
    "tools": {}
  }
}
```

### Configuration

| Environment Variable | CLI Flag | Default | Description |
|---------------------|----------|---------|-------------|
| `ZOEKT_URL` | `--url` | (required) | Zoekt webserver URL |
| `MCP_TRANSPORT` | `--transport` | auto | `stdio` or `http` |
| `MCP_PORT` | `--port` | 3000 | HTTP server port |
| `MCP_HOST` | `--host` | 0.0.0.0 | HTTP server host |
| `LOG_LEVEL` | `--log-level` | info | Logging verbosity |
| `ZOEKT_TIMEOUT_MS` | `--timeout` | 30000 | Request timeout |
