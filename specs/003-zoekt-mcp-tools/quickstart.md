# Quickstart: Zoekt MCP Tools Enhancement

**Date**: 2026-01-31  
**Spec**: [spec.md](./spec.md)  
**Branch**: `003-zoekt-mcp-tools`

## Prerequisites

- Node.js 18+ LTS
- pnpm or npm
- Docker (for running Zoekt backend)
- Indexed repositories in Zoekt (with ctags for symbol search)

## Quick Setup

```bash
# 1. Clone and checkout feature branch
cd zoekt-mcp
git checkout 003-zoekt-mcp-tools

# 2. Install dependencies
npm install

# 3. Start Zoekt backend (in separate terminal)
cd ../docker
docker-compose up -d

# 4. Run tests
npm test

# 5. Start MCP server (stdio mode)
npm start
```

## Implementation Order

Follow this order to implement features with minimal dependencies:

### Phase 1: Foundation (Week 1)

1. **Pagination Module** (`src/pagination/cursor.ts`)
   - Implement `encodeCursor(query, offset, limit): string`
   - Implement `decodeCursor(cursor): { queryHash, offset, limit }`
   - Add unit tests for encoding/decoding
   - Tests: `tests/unit/pagination/cursor.test.ts`

2. **Error Enhancement** (`src/errors/codes.ts`)
   - Define `ErrorCode` enum
   - Implement `enhanceError(error): StructuredError`
   - Add pattern matching for common Zoekt errors
   - Tests: `tests/unit/errors/codes.test.ts`

### Phase 2: New Tools (Week 2)

3. **search_symbols Tool** (`src/tools/search-symbols.ts`)
   - Wrap query with `sym:` prefix
   - Extract Symbol info from ChunkMatch.SymbolInfo
   - Integrate pagination cursor
   - Tests: `tests/unit/tools/search-symbols.test.ts`

4. **search_files Tool** (`src/tools/search-files.ts`)
   - Use `type:filename` query mode
   - Return FileMatch without content
   - Integrate pagination cursor
   - Tests: `tests/unit/tools/search-files.test.ts`

5. **find_references Tool** (`src/tools/find-references.ts`)
   - Execute combined sym: + content search
   - Deduplicate and label results
   - Integrate pagination cursor
   - Tests: `tests/unit/tools/find-references.test.ts`

### Phase 3: Health & Polish (Week 3)

6. **get_health Tool** (`src/tools/get-health.ts`)
   - Call Zoekt `/healthz` endpoint
   - Query `type:repo` for index stats
   - Return HealthStatus structure
   - Tests: `tests/unit/tools/get-health.test.ts`

7. **Integration Tests** (`tests/integration/tools.test.ts`)
   - Test all tools against mock Zoekt responses
   - Verify pagination across multiple pages
   - Test error scenarios

8. **Documentation Updates**
   - Update README with new tools
   - Add query syntax examples

## Key Files to Create/Modify

### New Files

```
src/
├── pagination/
│   └── cursor.ts           # Stateless cursor encode/decode
├── errors/
│   └── codes.ts            # Error code constants and enhancement
└── tools/
    ├── search-symbols.ts   # Symbol search tool
    ├── search-files.ts     # File search tool
    ├── find-references.ts  # References tool
    └── get-health.ts       # Health check tool
```

### Modified Files

```
src/
├── server.ts               # Register new tools
└── zoekt/
    ├── client.ts           # Add healthCheck(), symbolSearch() methods
    └── types.ts            # Add Symbol, HealthStatus types
```

## Tool Descriptions (Copy-Paste Ready)

### search_symbols

```typescript
server.tool(
  'search_symbols',
  `Search for code symbols (functions, classes, methods) across indexed repositories.

Uses Zoekt sym: query syntax. Results include symbol name, kind, and location.

**Query Examples:**
- \`handleRequest\` - Find symbols named handleRequest
- \`handler lang:typescript\` - TypeScript symbols matching "handler"  
- \`/^get.*/\` - Symbols starting with "get" (regex)
- \`UserService repo:myorg/myrepo\` - Symbol in specific repo
- \`Config case:yes\` - Case-sensitive symbol search

**Filters (append to query):**
- \`lang:NAME\` - Filter by language (typescript, go, python, etc.)
- \`repo:PATTERN\` - Filter by repository name
- \`case:yes|no\` - Case sensitivity
- \`branch:NAME\` - Specific branch`,
  { query, limit, contextLines, cursor },
  async (input) => { /* implementation */ }
);
```

### search_files

```typescript
server.tool(
  'search_files',
  `Search for files by name pattern across indexed repositories.

Returns matching filenames without content. Use for locating config files, tests, etc.

**Query Examples:**
- \`package.json\` - Files named package.json
- \`.*\\.test\\.ts$\` - TypeScript test files (regex)
- \`README.md repo:myorg/myrepo\` - README in specific repo
- \`config lang:yaml\` - YAML config files

**Filters (append to query):**
- \`repo:PATTERN\` - Filter by repository name
- \`lang:NAME\` - Filter by file language
- \`branch:NAME\` - Specific branch`,
  { query, limit, cursor },
  async (input) => { /* implementation */ }
);
```

### find_references

```typescript
server.tool(
  'find_references',
  `Find all definitions and usages of a symbol across indexed repositories.

Returns two sections: definitions (where symbol is declared) and usages (where symbol is called/referenced).

**Examples:**
- \`validateInput\` - Find all references to validateInput
- \`UserService lang:typescript\` - TypeScript references only
- \`handleRequest repo:backend\` - Within specific repo

**Filters (in filters parameter):**
- \`lang:NAME\` - Filter by language
- \`repo:PATTERN\` - Filter by repository
- \`branch:NAME\` - Specific branch`,
  { symbol, filters, limit, contextLines, cursor },
  async (input) => { /* implementation */ }
);
```

### get_health

```typescript
server.tool(
  'get_health',
  `Check the health status of the Zoekt MCP server and its backend.

Returns:
- Server status (healthy/degraded/unhealthy)
- Zoekt backend connectivity
- Index statistics (repository count, document count)
- Error details if unhealthy`,
  {},
  async () => { /* implementation */ }
);
```

## Testing Strategy

### Unit Tests

Each tool has dedicated unit tests with mocked Zoekt responses:

```typescript
// tests/unit/tools/search-symbols.test.ts
describe('search_symbols', () => {
  it('wraps query with sym: prefix', async () => {
    // Mock Zoekt response
    mockClient.search.mockResolvedValue({ result: { FileMatches: [...] } });
    
    const result = await searchSymbols({ query: 'handleRequest' });
    
    expect(mockClient.search).toHaveBeenCalledWith(
      'sym:handleRequest',
      expect.any(Object)
    );
  });
  
  it('extracts symbol info from response', async () => { /* ... */ });
  it('returns pagination cursor when more results', async () => { /* ... */ });
  it('rejects stale cursors', async () => { /* ... */ });
});
```

### Integration Tests

Test against real Zoekt with pre-indexed test repositories:

```typescript
// tests/integration/tools.test.ts
describe('integration', () => {
  beforeAll(async () => {
    // Ensure Zoekt is running with test index
  });
  
  it('search_symbols returns real symbols', async () => {
    const result = await callTool('search_symbols', { query: 'main' });
    expect(result.symbols).toContainEqual(
      expect.objectContaining({ kind: 'function' })
    );
  });
});
```

## Performance Benchmarks

Run after implementation to verify requirements:

```bash
# Search response time (target: <2s for 100 repos)
npm run bench:search

# Health check response time (target: <500ms)
npm run bench:health

# Pagination throughput (target: 500+ results)
npm run bench:pagination
```

## Common Issues

### Symbol search returns no results
- Verify ctags indexing is enabled in Zoekt
- Check with `zoekt 'sym:main'` directly

### Pagination cursor rejected
- Ensure cursor is from same query (hash validation)
- Cursors are stateless; index changes may shift results

### Health check shows unhealthy
- Verify Zoekt webserver is running: `curl http://localhost:6070/healthz`
- Check docker logs: `docker logs zoekt-webserver`

## Next Steps

After implementation:

1. Run `/speckit.tasks` to generate task breakdown
2. Create PR with implementation
3. Update CHANGELOG.md
4. Deploy to staging for testing
