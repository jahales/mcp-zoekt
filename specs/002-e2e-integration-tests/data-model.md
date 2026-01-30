# Data Model: Test Fixtures & Expected Results

**Feature**: 002-e2e-integration-tests  
**Date**: 2026-01-31

## Test Corpus Structure

The embedded test corpus provides deterministic, reproducible test data.

### Directory Layout

```text
tests/fixtures/test-repo/
├── README.md
├── index.ts
├── sample.ts
└── utils/
    └── helper.ts
```

### File Contents

#### README.md
```markdown
# Test Repository

This is a test repository for Zoekt MCP integration testing.
It contains TypeScript files with known patterns for search validation.
```

#### index.ts
```typescript
/**
 * Entry point for test repository
 */
export { greet } from './sample.js';
export { VERSION, formatMessage } from './utils/helper.js';
```

#### sample.ts
```typescript
/**
 * Sample module with searchable functions
 */

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export async function processData(items: string[]): Promise<number> {
  const results = items.map(item => item.length);
  return results.reduce((a, b) => a + b, 0);
}

export class DataProcessor {
  private data: string[] = [];

  add(item: string): void {
    this.data.push(item);
  }

  get count(): number {
    return this.data.length;
  }
}
```

#### utils/helper.ts
```typescript
/**
 * Helper utilities
 */

export const VERSION = '1.0.0';

export function formatMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export const SPECIAL_CHARS = 'Test with "quotes" and \'apostrophes\'';
```

---

## Expected Test Results

### Search Tool Tests

| Test Case | Query | Expected Results |
|-----------|-------|------------------|
| Basic function search | `function greet` | 1 match in sample.ts, line 6 |
| Async function search | `async function processData` | 1 match in sample.ts, line 10 |
| Constant search | `VERSION` | 2 matches: helper.ts (definition) + index.ts (export) |
| Class search | `class DataProcessor` | 1 match in sample.ts, line 15 |
| No results | `nonexistent_xyz_pattern_12345` | 0 matches, empty FileMatches array |
| Special characters | `"quotes"` | 1 match in helper.ts (SPECIAL_CHARS) |
| File filter | `file:helper.ts formatMessage` | 1 match in helper.ts only |

### List Repos Tool Tests

| Test Case | Expected Results |
|-----------|------------------|
| List all repos | Returns array containing "test-repo" |
| Repo has branches | At least "main" or "master" branch |

### File Content Tool Tests

| Test Case | Repository | Path | Expected Results |
|-----------|------------|------|------------------|
| Valid file | test-repo | sample.ts | Contains "export function greet" |
| Nested file | test-repo | utils/helper.ts | Contains "VERSION = '1.0.0'" |
| Root file | test-repo | README.md | Contains "Test Repository" |
| Invalid path | test-repo | nonexistent.ts | Error: file not found |
| Invalid repo | fake-repo | sample.ts | Error: repository not found |

### Error Handling Tests

| Test Case | Setup | Expected Results |
|-----------|-------|------------------|
| Unavailable backend | Stop Zoekt webserver | ZoektError with code "UNAVAILABLE" |
| Timeout | Set 1ms timeout, normal query | ZoektError with code "TIMEOUT" |

### MCP Protocol Tests

| Test Case | Request | Expected Response |
|-----------|---------|-------------------|
| tools/list | `{ method: "tools/list" }` | Array with 3 tools: search, list_repos, file_content |
| tools/call search | `{ method: "tools/call", params: { name: "search", arguments: { query: "greet" } } }` | Content array with text containing matches |
| Invalid tool | `{ method: "tools/call", params: { name: "invalid" } }` | Error response with code -32602 |

---

## Test Timeouts

| Category | Timeout |
|----------|---------|
| Individual test | 30 seconds |
| Setup hook (health check) | 60 seconds |
| Full suite | 120 seconds |

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ZOEKT_URL` | Zoekt webserver URL | `http://localhost:6070` |
| `ZOEKT_TIMEOUT` | Request timeout (ms) | `5000` |
| `TEST_REPO_PATH` | Path to test corpus | `tests/fixtures/test-repo` |
