# Research: Zoekt MCP Infrastructure

**Feature**: 001-zoekt-mcp-infra  
**Date**: 2026-01-30

## Research Tasks

### 1. Zoekt API Endpoints

**Question**: What HTTP endpoints does zoekt-webserver expose?

**Finding**: Based on analysis of the zoekt codebase:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/search` | GET | Search with query params: `q`, `num`, `ctx` (context lines), `format=json` |
| `/print` | GET | Get file contents: `r` (repo), `f` (file path), `b` (branch), `format=raw` |
| `/api/search` | POST | JSON API for structured search requests (supports streaming) |
| `/api/list` | POST | List repositories matching criteria |

**Decision**: Use `/search?format=json` for search and `/print?format=raw` for file content. These are simpler than the POST APIs and sufficient for MCP use cases.

**Rationale**: GET endpoints are easier to debug and test; the JSON format provides all needed metadata.

---

### 2. MCP SDK TypeScript Patterns

**Question**: How to properly structure an MCP server in TypeScript?

**Finding**: The `@modelcontextprotocol/sdk` provides:
- `McpServer` class for server setup
- `server.registerTool(name, schema, handler)` for tool registration
- Zod schemas for input validation
- Transport options: `StdioServerTransport`, HTTP handlers

**Decision**: Follow the pattern from itaymendel/zoekt-mcp with improvements:
1. Use `McpServer` from SDK
2. Define Zod schemas for each tool
3. Create a generic error handler wrapper
4. Support both stdio and HTTP transports

**Rationale**: The SDK handles protocol compliance; we focus on Zoekt integration.

---

### 3. Docker Compose for Zoekt Infrastructure

**Question**: How to configure zoekt-indexserver for GitHub?

**Finding**: The indexserver uses a JSON config file with entries like:
```json
[
  {
    "GithubOrg": "my-org",
    "CredentialPath": "/config/github-token.txt",
    "NoArchived": true,
    "Forks": false
  }
]
```

Key configuration options:
- `GithubOrg` or `GithubUser`: What to index
- `CredentialPath`: File containing GitHub PAT
- `GitHubURL`: For GitHub Enterprise (optional)
- `Topics`: Filter by repository topics
- `Exclude`: Regex pattern to exclude repos
- `NoArchived`: Skip archived repositories
- `Visibility`: Filter by `public`, `private`, `internal`

**Decision**: Use JSON config file mounted as volume; store token in separate file.

**Rationale**: Separating token from config allows config to be version-controlled while token remains secret.

---

### 4. Zoekt Search Response Structure

**Question**: What does the Zoekt search response look like?

**Finding**: JSON response structure:
```typescript
interface SearchResponse {
  result: {
    FileMatches?: FileMatch[];
    Stats?: {
      MatchCount: number;
      FileCount: number;
      Duration: number; // nanoseconds
      // ... other stats
    };
  };
}

interface FileMatch {
  Repository: string;
  FileName: string;
  Branches: string[];
  Language: string;
  Matches: Match[];
}

interface Match {
  LineNum: number;
  Line: string;      // The matching line (base64 encoded)
  LineStart: number;
  LineEnd: number;
  // Context lines included based on `ctx` param
}
```

**Decision**: Parse this structure and format results as readable text for MCP responses.

**Rationale**: AI agents work better with formatted text than raw JSON structures.

---

### 5. Error Handling Patterns

**Question**: What errors can occur and how should they be handled?

**Finding**: Error categories:
1. **Connection errors**: Zoekt webserver unreachable
2. **Query errors**: Invalid Zoekt query syntax
3. **Not found errors**: File or repo doesn't exist
4. **Timeout errors**: Search takes too long

**Decision**: Implement error handling per constitution:
- Wrap all tool handlers in try/catch
- Return structured MCP errors with `isError: true`
- Log errors with context (query, duration, error type)
- Include actionable guidance in error messages

**Rationale**: Constitution Principle IV requires explicit error handling with actionable feedback.

---

## Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | User preference; good MCP SDK support |
| MCP SDK | `@modelcontextprotocol/sdk` | Official SDK, protocol compliance |
| Schema Validation | Zod | Type-safe, MCP SDK integration |
| Logging | Pino | Fast JSON logging, structured output |
| HTTP Client | Native fetch | Node 18+ built-in, minimal deps |
| Package Manager | npm | Standard, widest compatibility |
| Docker Base | sourcegraph/zoekt | Official maintained images |

## Alternatives Considered

### Fork itaymendel/zoekt-mcp vs Build Fresh

**Considered**: Forking existing TypeScript implementation

**Rejected because**:
- Our project structure differs (Docker infrastructure included)
- We want tighter integration with spec-kit workflow
- Code is minimal enough to build fresh (~500 LOC)

**Chosen**: Build fresh, referencing itaymendel's patterns for Zoekt client

### Python vs TypeScript

**Considered**: Python with FastMCP (like najva-ai/zoekt-mcp)

**Rejected because**:
- User explicitly chose TypeScript
- Better `npx` distribution story
- Cleaner MCP SDK experience

**Chosen**: TypeScript with official MCP SDK
