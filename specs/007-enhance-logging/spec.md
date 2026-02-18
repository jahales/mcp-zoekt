# Feature Specification: Enhance Logging Strategy

**Feature Branch**: `007-enhance-logging`  
**Created**: 2026-02-18  
**Status**: Draft  
**Input**: User description: "Enhance logging strategy and follow industry best practices. Logs seem sparse for the web server. Keep the implementation clean."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured HTTP Request Logging (Priority: P1)

An operator running the MCP server in HTTP/SSE mode needs every incoming HTTP request logged with enough context to diagnose issues, measure latency, and trace requests end-to-end. Today the HTTP server logs only SSE connection open/close and errors—individual HTTP requests (health checks, POST messages, CORS preflight, 404s) produce no log entry at all.

**Why this priority**: Without per-request logging, operators have no visibility into traffic patterns, error rates, or slow responses. This is the single highest-value gap and the baseline expectation for any production web service.

**Independent Test**: Start the server in HTTP mode, issue several requests to different endpoints (including an unknown path), and confirm that every request produces a structured log line with method, path, status code, and duration.

**Acceptance Scenarios**:

1. **Given** the server is running in HTTP mode, **When** any HTTP request completes, **Then** a structured JSON log entry is emitted containing at minimum: request method, URL path, response status code, and response time in milliseconds.
2. **Given** the server is running in HTTP mode, **When** a request results in a 4xx or 5xx response, **Then** the log entry is emitted at `warn` or `error` level respectively, while successful responses are logged at `info` level.
3. **Given** the server is running in HTTP mode, **When** a client sends a request with an `X-Request-Id` header, **Then** the log entry includes that request ID; if the header is absent, the server generates a unique ID and includes it in both the log entry and the response headers.

---

### User Story 2 - Consistent Error Serialization (Priority: P1)

A developer investigating a failure needs error log entries to contain full stack traces and structured error metadata. Currently, some error logs pass the raw `error` object under an arbitrary key, which means the logging library does not serialize the stack trace—the most valuable piece of diagnostic information is silently lost.

**Why this priority**: Errors without stack traces are the most common root cause of "we can't figure out what went wrong." This is a correctness fix with immediate diagnostic value.

**Independent Test**: Trigger a backend error (e.g., stop the Zoekt backend), invoke a tool, and verify the resulting log JSON contains error type, message, and stack fields.

**Acceptance Scenarios**:

1. **Given** any tool handler encounters an exception, **When** the error is logged, **Then** the log entry uses the logging library's standard error serializer so that type, message, and stack are present in the output.
2. **Given** an HTTP message handler throws, **When** the error is logged, **Then** the same structured error serialization is applied.

---

### User Story 3 - Sensitive Header Redaction (Priority: P2)

An operator deploying behind a reverse proxy needs assurance that authorization tokens and session cookies are never persisted in log files, even when debug logging is enabled. Currently the logger has no redaction configuration at all.

**Why this priority**: Credential leakage through logs is a well-known security risk. Even though the MCP server does not currently require authentication, operators may place it behind an authenticating proxy and log forwarding pipelines may aggregate logs from multiple services.

**Independent Test**: Enable debug-level logging, send a request with an `Authorization` header, and confirm the logged header value is replaced with a redaction sentinel.

**Acceptance Scenarios**:

1. **Given** the log level is `debug`, **When** request headers are logged, **Then** the values of `authorization`, `cookie`, and `set-cookie` headers are replaced with a redaction marker (e.g., `[REDACTED]`).
2. **Given** the log level is `info` or higher, **When** a request is processed, **Then** sensitive headers are never included in log output regardless of any code path.

---

### User Story 4 - Request-Scoped Child Loggers with Correlation IDs (Priority: P2)

An operator troubleshooting a specific user session needs to filter logs by a single request or SSE session. Today, SSE connection and message logs do not carry a consistent session identifier, and HTTP request logs do not exist at all—making it impossible to correlate entries that belong to the same logical interaction.

**Why this priority**: Correlation IDs are a fundamental observability primitive. Without them, log aggregation tools cannot group related entries, and operators must guess at causal relationships between log lines.

**Independent Test**: Open an SSE session, send multiple messages, close it, and confirm all resulting log entries share a common session ID. Issue an HTTP request and confirm it carries a unique request ID that appears in both the log and the response header.

**Acceptance Scenarios**:

1. **Given** a new SSE connection is established, **When** any subsequent log entry is emitted for that session (connection open, message received, connection closed), **Then** all entries include the same `sessionId` field.
2. **Given** an HTTP request arrives, **When** the request-scoped child logger is created, **Then** it inherits a `requestId` that is either extracted from the incoming `X-Request-Id` header or generated as a new UUID.
3. **Given** a `requestId` is generated or propagated, **When** the response is sent, **Then** the same `requestId` is included in the `X-Request-Id` response header.

---

### User Story 5 - Hierarchical Logger Modules (Priority: P3)

A developer enabling debug logging wants to quickly identify which subsystem produced a log line (HTTP layer, MCP tool, Zoekt client) without reading the message text. Today only one child logger is created (`module: 'tools'`), and the HTTP server path has no module tag at all.

**Why this priority**: Module tagging is low-effort and makes log filtering vastly easier, but is incremental rather than critical.

**Independent Test**: Start the server in HTTP mode with debug logging, invoke a tool via SSE, and confirm log entries carry distinct module values such as `http`, `tools`, or `sse`.

**Acceptance Scenarios**:

1. **Given** the server starts, **When** log entries are emitted from the HTTP request handler, **Then** they carry a `module` field set to `http`.
2. **Given** the server starts, **When** log entries are emitted from MCP tool handlers, **Then** they carry a `module` field set to `tools` (existing behavior preserved).
3. **Given** the server starts, **When** log entries are emitted from startup and lifecycle events, **Then** they carry a `module` field set to `server` or `lifecycle`.

---

### Edge Cases

- What happens when the `X-Request-Id` header contains an excessively long or malformed value? The server should truncate or sanitize it to prevent log injection.
- What happens when the client IP cannot be determined (e.g., Unix socket)? The `remoteAddress` field should be omitted rather than logged as `undefined`.
- What happens when `X-Forwarded-For` contains a spoofed or comma-separated list? The server should extract only the first (leftmost) IP address, consistent with standard proxy conventions.
- What happens when a response finishes before a request logger child is fully constructed (e.g., CORS preflight)? The response `finish` event handler must be safe to invoke even for the fastest code paths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The logger MUST use the logging library's built-in error serializer so that all error objects logged under the standard error key are automatically serialized with type, message, and stack fields.
- **FR-002**: All error logging call sites across tool handlers and HTTP handlers MUST pass the error object under the standard error serializer key to engage automatic serialization.
- **FR-003**: The logger MUST configure redaction to mask the values of `authorization`, `cookie`, and `set-cookie` headers in any logged object.
- **FR-004**: Every HTTP request MUST be logged upon response completion with at minimum: HTTP method, URL path, response status code, and duration in milliseconds.
- **FR-005**: HTTP response log entries with status codes 400–499 MUST be logged at `warn` level; status codes 500+ MUST be logged at `error` level; all others MUST be logged at `info` level.
- **FR-006**: Each HTTP request MUST be assigned a unique request ID—either propagated from the incoming `X-Request-Id` header or generated as a UUID—and included in the response `X-Request-Id` header and all associated log entries.
- **FR-007**: Each SSE session MUST be assigned a unique session ID that is included in all log entries for that session's lifecycle (open, messages, close).
- **FR-008**: HTTP request handlers MUST create a request-scoped child logger that inherits the request ID, client IP, HTTP method, and URL path for all downstream log calls.
- **FR-009**: The HTTP server MUST log the client IP address, preferring the first address in the `X-Forwarded-For` header when present, falling back to the socket remote address.
- **FR-010**: Log entries from the HTTP layer MUST carry a `module` field value of `http` to distinguish them from tool and lifecycle log entries.
- **FR-011**: The server MUST NOT introduce any new runtime dependencies; all logging enhancements MUST be achievable with the existing logging library already in use.

### Key Entities

- **Log Entry**: A structured JSON object emitted by the logger. Key attributes: timestamp (ISO 8601), level, module, message, requestId, sessionId, method, path, statusCode, durationMs, err.
- **Request Context**: The set of metadata extracted from each HTTP request—request ID, client IP, method, path, user agent—that is attached to a child logger and propagated through all log calls for that request.
- **Session Context**: The set of metadata for an SSE session—session ID, connection timestamps—attached to a child logger scoped to that session's lifetime.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of HTTP requests to the server produce at least one structured log entry upon response completion, verifiable by issuing 10 requests to different endpoints and confirming 10 corresponding log lines.
- **SC-002**: 100% of error log entries contain error message and stack trace fields, verifiable by triggering 3 distinct error scenarios and inspecting each log line's JSON.
- **SC-003**: Sensitive headers (`authorization`, `cookie`) never appear in cleartext in any log output at any log level, verifiable by sending requests with dummy credentials at `debug` level and confirming redaction.
- **SC-004**: Every HTTP response includes an `X-Request-Id` header, verifiable by issuing requests with and without the header and confirming the response always contains it.
- **SC-005**: All log entries for a single SSE session share a common `sessionId` value, verifiable by opening a session, sending messages, closing it, and filtering logs by that ID.
- **SC-006**: No new runtime dependencies are added to the project, verifiable by diffing the dependency list before and after implementation.
- **SC-007**: Operators can filter logs by subsystem (e.g., `module=http`) to isolate HTTP-layer entries from tool-layer entries, verifiable by grepping logs for the `module` field.

## Assumptions

- The existing logging library (Pino) supports all required features: child loggers, redaction, serializers, and structured JSON output. No version upgrade is needed.
- The HTTP transport (`http` mode) is the primary target for request-level logging improvements. The `stdio` transport does not serve HTTP requests and therefore does not require request-scoped logging.
- `X-Forwarded-For` handling follows the standard convention of trusting the first (leftmost) IP. Full proxy trust chain configuration is out of scope.
- `X-Request-Id` values are expected to be reasonable UUIDs; truncation to 128 characters is sufficient to prevent log injection without rejecting legitimate IDs.
- The `crypto.randomUUID()` function is available in the target Node.js runtime (≥ 18) for generating request and session IDs.
