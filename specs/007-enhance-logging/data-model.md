# Data Model: Enhance Logging Strategy

**Feature**: 007-enhance-logging  
**Date**: 2026-02-18

## Overview

This feature does not introduce persistent entities or database models. It enhances the structure of **transient log entries** emitted by the Pino logger. The "data model" here describes the JSON schema of log output and the in-memory context objects used to construct it.

## Entity: Log Entry (JSON output)

A structured JSON object written to stderr by Pino on every log call.

### Base Fields (all log entries)

| Field | Type | Source | Required | Description |
|-------|------|--------|----------|-------------|
| `level` | string | Pino formatter | Yes | Log level label: `debug`, `info`, `warn`, `error` |
| `time` | string | Pino `isoTime` | Yes | ISO 8601 timestamp |
| `msg` | string | Log call argument | Yes | Human-readable log message |
| `module` | string | Child logger binding | No | Subsystem tag: `http`, `tools` |

### HTTP Request Fields (added by request-scoped child logger)

| Field | Type | Source | Required | Description |
|-------|------|--------|----------|-------------|
| `requestId` | string (UUID) | `X-Request-Id` header or `crypto.randomUUID()` | Yes | Correlation ID for the request |
| `method` | string | `req.method` | Yes | HTTP method: `GET`, `POST`, `OPTIONS` |
| `path` | string | Parsed `url.pathname` | Yes | URL path: `/sse`, `/messages`, `/health` |
| `remoteAddress` | string | `X-Forwarded-For` first entry or `req.socket.remoteAddress` | No | Client IP address (omitted if unavailable) |
| `userAgent` | string | `req.headers['user-agent']` | No | Client user agent string |

### HTTP Response Fields (added on `res.finish` event)

| Field | Type | Source | Required | Description |
|-------|------|--------|----------|-------------|
| `statusCode` | number | `res.statusCode` | Yes | HTTP response status code |
| `durationMs` | number | `process.hrtime.bigint()` delta | Yes | Response time in milliseconds (2 decimal places) |

### SSE Session Fields (added by session-scoped child logger)

| Field | Type | Source | Required | Description |
|-------|------|--------|----------|-------------|
| `sessionId` | string (UUID) | `crypto.randomUUID()` | Yes | Correlation ID for the SSE session lifetime |

### Error Fields (added by Pino `err` serializer)

| Field | Type | Source | Required | Description |
|-------|------|--------|----------|-------------|
| `err.type` | string | `error.constructor.name` | Yes | Error class name (e.g., `ZoektError`, `TypeError`) |
| `err.message` | string | `error.message` (with cause chain) | Yes | Error message with chained causes |
| `err.stack` | string | `error.stack` (with cause chain) | Yes | Full stack trace with chained causes |
| `err.code` | string | Custom property on `ZoektError` | No | Error code: `UNAVAILABLE`, `QUERY_ERROR`, `TIMEOUT`, `NOT_FOUND` |
| `err.statusCode` | number | Custom property on `ZoektError` | No | HTTP status code from Zoekt response |

## Entity: Request Context (in-memory)

An ephemeral context object created per HTTP request, used to construct a Pino child logger.

| Attribute | Lifetime | Description |
|-----------|----------|-------------|
| `requestId` | Single HTTP request | UUID from header or generated |
| `method` | Single HTTP request | HTTP method |
| `path` | Single HTTP request | URL pathname |
| `remoteAddress` | Single HTTP request | Client IP |
| `userAgent` | Single HTTP request | Client user-agent |
| `startTime` | Single HTTP request | `process.hrtime.bigint()` captured at request start |

**Not persisted** — exists only in closure scope of the HTTP request handler.

## Entity: Session Context (in-memory)

An ephemeral context object created per SSE connection, used to construct a Pino child logger.

| Attribute | Lifetime | Description |
|-----------|----------|-------------|
| `sessionId` | SSE session lifetime | UUID generated at connection open |

**Not persisted** — exists as child logger bindings for the session's lifetime.

## Relationships

```
Root Logger
  ├── child({ module: 'http' })           ← HTTP module logger (created once)
  │   └── child({ requestId, ... })       ← Request-scoped logger (per request)
  │       └── child({ sessionId })        ← SSE session logger (per connection)
  └── child({ module: 'tools' })          ← Tools module logger (existing)
```

## Validation Rules

- `requestId`: Must be a valid string ≤128 characters. If the incoming `X-Request-Id` header is empty or exceeds 128 chars, ignore it and generate a new UUID.
- `remoteAddress`: Omit from log entry if `undefined` or empty string (Unix socket, missing header).
- `durationMs`: Round to 2 decimal places. Must be non-negative.
- `module`: One of: `http`, `tools`. No freeform values.

## State Transitions

N/A — log entries are write-once, append-only. No state machine.
