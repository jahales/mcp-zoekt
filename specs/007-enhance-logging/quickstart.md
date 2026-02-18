# Quickstart: Enhance Logging Strategy

**Feature**: 007-enhance-logging  
**Branch**: `007-enhance-logging`

## What This Feature Does

Enhances the MCP server's logging from minimal output to industry-standard structured logging:
- Every HTTP request produces a structured log entry with method, path, status, and duration
- Errors include full stack traces via Pino's standard error serializer
- Sensitive headers (`authorization`, `cookie`) are redacted from all log output
- Request IDs and session IDs enable log correlation across entries
- Module tags (`http`, `tools`) enable filtering by subsystem

## Prerequisites

- Node.js 18+ (for `crypto.randomUUID()`)
- Existing dev environment set up (`npm install` already done)

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/logger.ts` | Modified | Add `serializers.err`, `redact` config |
| `src/server.ts` | Modified | Add HTTP request logging, child loggers, correlation IDs |
| `src/tools/search-files.ts` | Modified | Fix `error` → `err` key |
| `src/tools/search-symbols.ts` | Modified | Fix `error` → `err` key |
| `src/tools/find-references.ts` | Modified | Fix `error` → `err` key |
| `src/tools/get-health.ts` | Modified | Fix `error` → `err` key |
| `tests/unit/logger.test.ts` | New | Unit tests for logger config |

## How to Verify

### 1. Error serialization (stack traces)

Start the server pointing to a non-existent Zoekt URL, invoke a tool, and check that the error log contains `err.stack`:

```bash
# Start with debug logging
ZOEKT_URL=http://localhost:9999 node dist/index.js --transport http --debug

# In another terminal, connect and trigger an error
curl http://localhost:3001/health
```

Look for log entries containing `"err":{"type":"ZoektError","message":"...","stack":"..."}`.

### 2. HTTP request logging

```bash
# Start the server in HTTP mode
ZOEKT_URL=http://localhost:6070 node dist/index.js --transport http --debug

# Issue requests to various endpoints
curl -v http://localhost:3001/health
curl -v http://localhost:3001/nonexistent
curl -v -H "X-Request-Id: test-123" http://localhost:3001/health
```

Verify:
- Each request produces a `"msg":"request completed"` log entry
- The entry contains `method`, `path`, `statusCode`, `durationMs`
- `/nonexistent` logs at `warn` level (404)
- The `X-Request-Id` header is echoed in the response
- When you provide `X-Request-Id: test-123`, the log shows `"requestId":"test-123"`

### 3. Header redaction

```bash
curl -H "Authorization: Bearer secret-token" http://localhost:3001/health
```

Check that no log entry at any level contains `secret-token`. If headers are logged at debug level, the value should show `[REDACTED]`.

### 4. SSE session correlation

```bash
# Open an SSE connection
curl -N http://localhost:3001/sse
```

Check that the connection-opened and connection-closed logs share the same `sessionId` value.

### 5. Module tags

With debug logging, verify log entries contain:
- `"module":"http"` for HTTP request handling
- `"module":"tools"` for MCP tool invocations

## Running Tests

```bash
cd zoekt-mcp
npm run test:unit
```

## Key Design Decisions

1. **No `pino-http` dependency** — Manual child logger pattern avoids a new dependency and gives full control for the SSE/JSON-RPC protocol.
2. **`err` not `error`** — Pino's standard serializer key is `err`. Using `error` silently drops stack traces.
3. **`process.hrtime.bigint()`** — Nanosecond monotonic timing, more precise than `Date.now()`.
4. **Redact at root logger** — Child loggers inherit redaction automatically.
