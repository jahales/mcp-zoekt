# Research: E2E & Integration Tests

**Feature**: 002-e2e-integration-tests  
**Date**: 2026-01-31  
**Status**: Complete

## Research Tasks

### 1. Vitest Projects Configuration

**Question**: How to configure Vitest to run unit and integration tests as separate projects?

**Decision**: Use Vitest's `projects` configuration in root `vitest.config.ts`

**Rationale**: 
- Native Vitest feature since v2.0
- Supports `--project` CLI flag for selective execution
- Each project can have different include patterns, setup files, and timeouts
- Single `vitest` command with project selection vs multiple config files

**Implementation Pattern**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30000,
          hookTimeout: 60000,
          setupFiles: ['tests/integration/setup.ts'],
        },
      },
    ],
  },
});
```

**Alternatives Considered**:
- Separate `vitest.config.unit.ts` and `vitest.config.integration.ts` files → Rejected: More complex npm scripts, duplicated config
- Environment variable to skip tests → Rejected: Confusing "skipped" output, not explicit

---

### 2. MCP Subprocess Testing Pattern

**Question**: How to test MCP server protocol compliance via subprocess?

**Decision**: Spawn MCP server as child process, communicate via stdio, validate JSON-RPC messages

**Rationale**:
- Tests the actual transport layer (stdio buffering, line-delimiting)
- Catches protocol-level issues that handler unit tests miss
- MCP SDK doesn't provide a test client, so we build a lightweight one

**Implementation Pattern**:
```typescript
// tests/helpers/mcp-test-client.ts
import { spawn, ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

export class McpTestClient {
  private process: ChildProcess;
  private requestId = 0;
  private responseQueue: Map<number, (response: unknown) => void>;

  async start(): Promise<void> {
    this.process = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ZOEKT_URL: 'http://localhost:6070' },
    });
    // Set up JSON-RPC response handling via readline
  }

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.requestId;
    const request = { jsonrpc: '2.0', id, method, params };
    this.process.stdin!.write(JSON.stringify(request) + '\n');
    return this.waitForResponse(id);
  }

  async close(): Promise<void> {
    this.process.kill();
  }
}
```

**Alternatives Considered**:
- Mock the MCP SDK internals → Rejected: Doesn't test actual protocol flow
- Use MCP inspector tool → Rejected: Not easily automatable in CI

---

### 3. Docker Compose Health Check Strategy

**Question**: How to reliably wait for Zoekt infrastructure before running tests?

**Decision**: Use Docker healthcheck + curl-based wait script

**Rationale**:
- Docker Compose v2 supports `healthcheck` with `condition: service_healthy`
- Additional pre-test health check ensures Zoekt has indexed the test corpus
- Simple HTTP request to `/` endpoint confirms webserver is ready

**Implementation Pattern**:
```yaml
# docker-compose.test.yml
services:
  zoekt-webserver:
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:6070/"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 30s
```

```typescript
// tests/integration/setup.ts
export async function waitForZoekt(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Zoekt not available at ${url} after ${timeoutMs}ms`);
}
```

**Alternatives Considered**:
- Fixed sleep delay → Rejected: Slow and unreliable
- docker-compose `wait` command → Rejected: Not available in all versions

---

### 4. Test Corpus Design

**Question**: What should the embedded test corpus contain for deterministic testing?

**Decision**: Small TypeScript/JavaScript repo with predictable patterns

**Rationale**:
- Known file paths and content for exact match assertions
- Includes edge cases: nested folders, special characters, multiple file types
- Small enough to index quickly (<5 seconds)

**Corpus Structure**:
```text
tests/fixtures/test-repo/
├── README.md           # Markdown file for content type testing
├── sample.ts           # Main TypeScript file with searchable patterns
│   - Contains: `export function greet(name: string)`
│   - Contains: `async function processData()`
├── utils/
│   └── helper.ts       # Nested file for path testing
│       - Contains: `export const VERSION = "1.0.0"`
└── index.ts            # Entry point with imports
```

**Known Queries for Testing**:
| Query | Expected Matches |
|-------|------------------|
| `function greet` | sample.ts line ~3 |
| `async function` | sample.ts line ~7 |
| `VERSION` | utils/helper.ts line ~1 |
| `nonexistent_xyz` | 0 matches |

---

### 5. CI Workflow Design

**Question**: How to provision Docker infrastructure in GitHub Actions?

**Decision**: Use `docker/setup-buildx-action` + `docker compose up -d` with health wait

**Rationale**:
- GitHub Actions runners have Docker pre-installed
- Docker Compose v2 is available via `docker compose` command
- Health check loop ensures tests don't start before infrastructure is ready

**Implementation Pattern**:
```yaml
# .github/workflows/integration-tests.yml
jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Start Zoekt infrastructure
        run: |
          docker compose -f docker/docker-compose.test.yml up -d
          # Wait for health
          timeout 120 bash -c 'until curl -sf http://localhost:6070/; do sleep 2; done'
      
      - name: Install and build
        run: |
          cd zoekt-mcp
          npm ci
          npm run build
      
      - name: Run integration tests
        run: |
          cd zoekt-mcp
          npm run test:integration
      
      - name: Cleanup
        if: always()
        run: docker compose -f docker/docker-compose.test.yml down -v
```

**Alternatives Considered**:
- GitHub Actions services → Rejected: Less control over custom Zoekt image
- Skip integration tests in CI → Rejected: Defeats purpose of automated testing

---

## Summary

All research tasks resolved. Key decisions:
1. **Vitest projects** for test separation (not conditional skipping)
2. **Subprocess MCP client** for protocol testing
3. **Docker healthcheck + curl wait** for infrastructure readiness
4. **Embedded fixture corpus** with known content for deterministic assertions
5. **GitHub Actions + Docker Compose** for CI automation
