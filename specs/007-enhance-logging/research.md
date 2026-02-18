# Research: Enhance Logging Strategy

**Feature**: 007-enhance-logging  
**Date**: 2026-02-18  
**Status**: Complete — all items resolved

## Research Topic 1: Error Serialization Key

**Context**: All 8 `logger.error()` call sites in the codebase use `{ error: ... }` which bypasses Pino's standard error serializer.

**Decision**: Use `err` as the error object key in all logging call sites.

**Rationale**: Pino's `errorKey` defaults to `'err'`, and the built-in default serializer `pino.stdSerializers.err` only fires for properties logged under that key. When an Error is logged under the key `error`, the serializer is never invoked — stack traces, cause chains, and custom properties like `code` and `statusCode` are silently dropped. The `stdSerializers.err` serializer extracts: `type` (constructor name), `message` (with chained causes), `stack` (with chained causes), `aggregateErrors` (for AggregateError), and all enumerable custom properties.

**Alternatives considered**:
- Change `errorKey` to `'error'` — Rejected: breaks ecosystem conventions; log aggregation tools and Pino transports expect `err`.
- Add a custom serializer for the `error` key — Rejected: more config surface; fixing the call sites is simpler and conventional.

## Research Topic 2: Sensitive Header Redaction

**Context**: The logger has no redaction configuration. Operators behind reverse proxies may have `authorization` and `cookie` headers flowing through.

**Decision**: Use Pino's built-in `redact` option (powered by `fast-redact`) with an array of dot-notation paths and a `[REDACTED]` censor string.

**Rationale**: Pino's `redact` compiles path functions at logger creation time, adding ~2% overhead to serialization for non-wildcard paths (negligible). Paths follow JavaScript dot/bracket notation. Child loggers inherit the parent's redact configuration automatically, so configuring it once on the root logger covers all downstream child loggers.

**Recommended redact paths**:
- `req.headers.authorization`
- `req.headers.cookie`
- `req.headers["set-cookie"]`
- `req.headers["proxy-authorization"]`
- `headers.authorization` (for direct header object logging)
- `headers.cookie`
- `headers["set-cookie"]`

**Alternatives considered**:
- `remove: true` (delete key entirely) — Rejected: operators may want to know the header was present; `[REDACTED]` is more informative.
- Custom `req` serializer that strips headers — Rejected: declarative `redact` is simpler and handles new paths without code changes.
- Transport-level redaction — Rejected: data already serialized; redaction must happen at the source.

## Research Topic 3: HTTP Request Logging Pattern

**Context**: The MCP HTTP server is a lightweight `http.createServer()` handler — not Express or Koa. It serves SSE and JSON-RPC, not standard REST routes.

**Decision**: Use a manual child-logger pattern with `res.on('finish')` for response logging and `process.hrtime.bigint()` for high-resolution timing. Do not add `pino-http` as a dependency.

**Rationale**: `pino-http` is designed for Connect/Express middleware chains and adds a runtime dependency. The MCP server's HTTP layer is a simple request handler with 4 routes — `pino-http`'s auto-decoration of `req.log`/`res.log`, automatic response logging, and genReqId are features that can be achieved in ~15 lines of manual code. Manual child loggers give full control over what gets logged per route.

**Timing approach**: `process.hrtime.bigint()` returns nanosecond-precision monotonic time (immune to wall-clock drift). Convert to milliseconds: `Number(end - start) / 1_000_000`. This is more precise than `Date.now()` (ms resolution only).

**Log-level by status code**: Log the response entry at `error` for 5xx, `warn` for 4xx, `info` for everything else. This aligns with the standard severity model and enables alerting on `error`-level entries.

**Alternatives considered**:
- `pino-http` middleware — Rejected: adds a dependency (violates FR-011); overkill for 4 routes on a non-Express server.
- `Date.now()` for timing — Acceptable but inferior: wall-clock, millisecond-only resolution.
- `performance.now()` — Acceptable: sub-ms fractions, but `hrtime.bigint()` is more idiomatic in Node.js server contexts.

## Research Topic 4: Correlation IDs and Child Loggers

**Context**: SSE sessions and HTTP requests currently have no shared identifier across log entries.

**Decision**: Use `crypto.randomUUID()` for ID generation. Propagate request IDs via the `X-Request-Id` header. Create request-scoped child loggers via `logger.child({ requestId })`.

**Rationale**: `crypto.randomUUID()` is built-in since Node.js 14.17, synchronous, and fast (~0.5µs). Child logger creation is fast (~26µs per Pino benchmarks). Child loggers share the parent's output stream and inherit serializers and redact config. Bindings are serialized once at creation time and prepended to every log line.

**Request ID propagation**: Accept `X-Request-Id` from the incoming request; if absent, generate a new UUID. Include the ID in the response `X-Request-Id` header and in all log entries for that request.

**What to put in child bindings** (stable per-request): `requestId`, `module`. What to put in individual log lines (varies per entry): `statusCode`, `responseTimeMs`, `err`.

**Alternatives considered**:
- `uuid` npm package — Rejected: `crypto.randomUUID()` is built-in.
- `nanoid` — Rejected: extra dependency; UUID is the industry standard for request IDs.
- `AsyncLocalStorage` — Deferred: adds complexity; manual child logger passing is sufficient for this codebase's depth of nesting.

## Research Topic 5: Module Tagging Convention

**Context**: Only one child logger in the codebase uses a module tag (`module: 'tools'`). The HTTP layer has none.

**Decision**: Use the field name `module` in child logger bindings to tag entries by subsystem.

**Rationale**: `module` is Pino's own documented convention (used in their child-logger documentation examples). Module-level child loggers should be created once at server setup time (not per-request). Request-scoped children are created from these module-level loggers, inheriting both the module tag and the per-request bindings.

**Module naming**:
| Module | Scope |
|--------|-------|
| `http` | HTTP request handler and response lifecycle |
| `tools` | MCP tool handlers (existing) |
| (none) | Root logger for startup/shutdown in `index.ts` |

**Alternatives considered**:
- `component` field — Acceptable, but `module` aligns with Pino's own docs.
- Pino's `name` option — Rejected: `name` is a top-level identity for the root logger (e.g., service name), not per-component tagging.
- `mixin` function — Rejected: called on every log line; child bindings are serialized once (more efficient).
