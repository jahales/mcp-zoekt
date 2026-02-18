# Logging Contract: Enhanced Logger & HTTP Request Logging

**Feature**: 007-enhance-logging  
**Date**: 2026-02-18

## 1. Logger Configuration Contract

### `createLogger(level: LogLevel): pino.Logger`

The root logger factory MUST produce a Pino logger with the following configuration:

```typescript
// Required Pino options
{
  level: LogLevel,                    // 'debug' | 'info' | 'warn' | 'error'
  serializers: {
    err: pino.stdSerializers.err,     // FR-001: Standard error serializer
  },
  redact: {                           // FR-003: Sensitive header redaction
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'req.headers["proxy-authorization"]',
      'headers.authorization',
      'headers.cookie',
      'headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  transport: {
    target: 'pino/file',
    options: { destination: 2 },      // stderr (existing)
  },
  formatters: {
    level: (label) => ({ level: label }),  // existing
  },
  timestamp: pino.stdTimeFunctions.isoTime, // existing
}
```

### Invariants

- The `err` serializer MUST be registered so that all `{ err: Error }` log entries produce `err.type`, `err.message`, and `err.stack` in the JSON output.
- Redact paths MUST be inherited by all child loggers without additional configuration.
- No new runtime dependencies MUST be added (FR-011).

---

## 2. Error Logging Call-Site Contract

### Before (current — broken)

```typescript
logger.error({ error }, 'some error');         // ❌ Serializer not invoked
logger.error({ query, duration, error }, '…');  // ❌ Stack trace lost
```

### After (required — FR-002)

```typescript
logger.error({ err: error }, 'some error');           // ✅ Serializer invoked
logger.error({ query, duration, err: error }, '…');    // ✅ Stack trace preserved
```

### Affected Call Sites

| File | Line (approx) | Current Key | Required Key |
|------|---------------|-------------|--------------|
| `server.ts` | search handler | `error` | `err` |
| `server.ts` | list_repos handler | `error` | `err` |
| `server.ts` | file_content handler | `error` | `err` |
| `server.ts` | HTTP message handler | `error` | `err` |
| `tools/search-files.ts` | catch block | `error` | `err` |
| `tools/search-symbols.ts` | catch block | `error` | `err` |
| `tools/find-references.ts` | catch block | `error` | `err` |
| `tools/get-health.ts` | catch block | `error` | `err` |

---

## 3. HTTP Request Logging Contract

### Per-Request Log Entry (FR-004, FR-005)

Every HTTP request MUST produce a log entry on `res.finish` with this shape:

```jsonc
{
  "level": "info",           // or "warn" for 4xx, "error" for 5xx
  "time": "2026-02-18T12:00:00.000Z",
  "module": "http",          // FR-010
  "requestId": "550e8400-e29b-41d4-a716-446655440000",  // FR-006
  "method": "GET",           // FR-004
  "path": "/health",         // FR-004
  "remoteAddress": "192.168.1.1",  // FR-009 (optional)
  "userAgent": "curl/7.68.0",      // (optional)
  "statusCode": 200,         // FR-004
  "durationMs": 1.23,        // FR-004
  "msg": "request completed"
}
```

### Log Level Rules (FR-005)

| Status Code Range | Log Level |
|-------------------|-----------|
| 100–399 | `info` |
| 400–499 | `warn` |
| 500+ | `error` |

### Request ID Rules (FR-006)

1. If `X-Request-Id` header is present and ≤128 characters, use it as `requestId`.
2. If `X-Request-Id` header is absent or >128 characters, generate a new UUID via `crypto.randomUUID()`.
3. Set `X-Request-Id` response header to the resolved `requestId`.

### Client IP Rules (FR-009)

1. If `X-Forwarded-For` header is present, extract the first (leftmost) comma-separated value, trimmed.
2. Otherwise, use `req.socket.remoteAddress`.
3. If neither is available, omit `remoteAddress` from the log entry.

---

## 4. SSE Session Logging Contract

### Session Lifecycle (FR-007)

Each SSE connection MUST generate a `sessionId` via `crypto.randomUUID()` and include it in all log entries for that session:

```jsonc
// Connection opened
{ "module": "http", "requestId": "…", "sessionId": "…", "msg": "sse connection opened" }

// Message received
{ "module": "http", "requestId": "…", "sessionId": "…", "msg": "message received" }

// Connection closed
{ "module": "http", "requestId": "…", "sessionId": "…", "msg": "sse connection closed" }
```

---

## 5. Child Logger Hierarchy Contract

```
createLogger(level)                    ← Root logger (redact + serializers configured)
  └── .child({ module: 'http' })       ← HTTP module logger (created once in startHttpServer)
      ├── .child({ requestId, method, path, remoteAddress, userAgent })
      │                                ← Per-request logger (created per request)
      └── .child({ sessionId })        ← Per-SSE-session logger (created per SSE connection)

  └── .child({ module: 'tools' })      ← Tools module logger (existing, unchanged)
```

All child loggers MUST inherit the root logger's `redact` config and `err` serializer automatically (Pino built-in behavior).

---

## 6. Response Header Contract

### `X-Request-Id`

| Header | Direction | Value |
|--------|-----------|-------|
| `X-Request-Id` | Response | The `requestId` assigned to the request (propagated or generated) |

This header MUST be set on **every** HTTP response, including 204 (CORS preflight), 404 (not found), and 400/500 error responses.
