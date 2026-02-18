# Tasks: Enhance Logging Strategy

**Input**: Design documents from `/specs/007-enhance-logging/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in every task description

## Path Conventions

- **Single project**: `zoekt-mcp/src/`, `zoekt-mcp/tests/` relative to repository root

---

## Phase 1: Setup

**Purpose**: Enhance the root logger configuration that all downstream changes depend on

- [ ] T001 Add Pino `err` standard serializer to logger config in `zoekt-mcp/src/logger.ts`
- [ ] T002 Add Pino `redact` configuration for sensitive headers in `zoekt-mcp/src/logger.ts`

**Checkpoint**: Root logger now serializes errors with stack traces and redacts sensitive headers. All child loggers inherit both automatically.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix all error-logging call sites — MUST be complete before HTTP request logging can reference the `err` pattern consistently

**⚠️ CRITICAL**: These are single-line fixes across 8 call sites. All are independent (different files or different functions in the same file).

- [ ] T003 [P] Fix error key `error` → `err` in search handler catch block in `zoekt-mcp/src/server.ts` (line ~104)
- [ ] T004 [P] Fix error key `error` → `err` in list_repos handler catch block in `zoekt-mcp/src/server.ts` (line ~153)
- [ ] T005 [P] Fix error key `error` → `err` in file_content handler catch block in `zoekt-mcp/src/server.ts` (line ~203)
- [ ] T006 [P] Fix error key `error` → `err` in HTTP message handler catch block in `zoekt-mcp/src/server.ts` (line ~584)
- [ ] T007 [P] Fix error key `error` → `err` in search_files handler catch block in `zoekt-mcp/src/tools/search-files.ts` (line ~199)
- [ ] T008 [P] Fix error key `error` → `err` in search_symbols handler catch block in `zoekt-mcp/src/tools/search-symbols.ts` (line ~300)
- [ ] T009 [P] Fix error key `error` → `err` in find_references handler catch block in `zoekt-mcp/src/tools/find-references.ts` (line ~372)
- [ ] T010 [P] Fix error key `error` → `err` in get_health handler catch block in `zoekt-mcp/src/tools/get-health.ts` (line ~166)

**Checkpoint**: All error logs now produce `err.type`, `err.message`, and `err.stack` via Pino's standard serializer. US2 (Consistent Error Serialization) is fully satisfied.

---

## Phase 3: User Story 1 — Structured HTTP Request Logging (Priority: P1) 🎯 MVP

**Goal**: Every HTTP request produces a structured log entry with method, path, status code, duration, and log-level based on status code.

**Independent Test**: Start server in HTTP mode, issue requests to `/health`, `/nonexistent`, `/sse`, and confirm each produces a structured log line with the required fields.

### Implementation for User Story 1

- [ ] T011 [US1] Add `import { randomUUID } from 'crypto'` to `zoekt-mcp/src/server.ts`
- [ ] T012 [US1] Create `getClientIp(req)` helper function at bottom of `zoekt-mcp/src/server.ts` — extract first IP from `X-Forwarded-For` or fall back to `req.socket.remoteAddress`
- [ ] T013 [US1] Create HTTP module child logger `httpLogger = logger.child({ module: 'http' })` in `startHttpServer()` in `zoekt-mcp/src/server.ts`
- [ ] T014 [US1] Add request-scoped child logger at top of HTTP request handler in `zoekt-mcp/src/server.ts` — extract/generate `requestId`, capture `startTime` via `process.hrtime.bigint()`, create `reqLogger = httpLogger.child({ requestId, method, path, remoteAddress, userAgent })`
- [ ] T015 [US1] Set `X-Request-Id` response header from resolved `requestId` in HTTP request handler in `zoekt-mcp/src/server.ts`
- [ ] T016 [US1] Register `res.on('finish')` handler to log request completion with `statusCode`, `durationMs`, and level-by-status-code (info/warn/error) in `zoekt-mcp/src/server.ts`
- [ ] T017 [US1] Replace existing ad-hoc SSE/message/404 log calls with `reqLogger` in `startHttpServer()` in `zoekt-mcp/src/server.ts`

**Checkpoint**: US1 complete. Every HTTP request to the server produces a structured log entry. `/health` → info, `/nonexistent` → warn (404), message handler errors → error (500). `X-Request-Id` header echoed on every response.

---

## Phase 4: User Story 2 — Consistent Error Serialization (Priority: P1)

**Goal**: All error log entries include full stack traces via Pino's `err` serializer.

**Independent Test**: Stop the Zoekt backend, invoke any tool, and confirm the log JSON contains `err.type`, `err.message`, and `err.stack`.

> **Already satisfied by Phase 1 (T001) + Phase 2 (T003–T010)**. No additional tasks required. This phase exists to document the checkpoint.

**Checkpoint**: US2 complete. Trigger any error path and confirm `err.stack` is present in the JSON log output.

---

## Phase 5: User Story 3 — Sensitive Header Redaction (Priority: P2)

**Goal**: Authorization tokens and cookies are never logged in cleartext at any log level.

**Independent Test**: Send a request with `Authorization: Bearer secret`, check that log output shows `[REDACTED]` instead of the token value.

> **Already satisfied by Phase 1 (T002)**. The `redact` option on the root logger covers all child loggers automatically. No additional tasks required.

**Checkpoint**: US3 complete. Confirm redaction at debug level with `curl -H "Authorization: Bearer secret" http://localhost:3001/health`.

---

## Phase 6: User Story 4 — Request-Scoped Child Loggers with Correlation IDs (Priority: P2)

**Goal**: Every log entry for a given HTTP request or SSE session carries a correlation ID that can be used to filter related entries.

**Independent Test**: Open an SSE session, send messages, close it. Filter logs by `sessionId` — all entries for that session should appear. Issue an HTTP request with `X-Request-Id: test-123` — the log and response header should carry `test-123`.

### Implementation for User Story 4

- [ ] T018 [US4] Refactor SSE connection handler to generate `sessionId` via `randomUUID()` and create session-scoped child logger `sseLogger = reqLogger.child({ sessionId })` in `zoekt-mcp/src/server.ts`
- [ ] T019 [US4] Use `sseLogger` for SSE connection opened, message received, and connection closed log entries in `zoekt-mcp/src/server.ts`
- [ ] T020 [US4] Add `X-Request-Id` header validation — truncate to 128 characters if incoming header exceeds limit in `zoekt-mcp/src/server.ts`

**Checkpoint**: US4 complete. SSE session logs share a `sessionId`. HTTP request logs share a `requestId`. `X-Request-Id` response header is always present.

---

## Phase 7: User Story 5 — Hierarchical Logger Modules (Priority: P3)

**Goal**: Log entries carry a `module` field identifying the subsystem (http, tools).

**Independent Test**: Start server with `--debug`, invoke a tool via SSE, and filter logs by `module=http` vs `module=tools`.

> **Already satisfied by Phase 3 (T013 creates `httpLogger` with `module: 'http'`) and existing code (tools already use `module: 'tools'`)**. No additional tasks required.

**Checkpoint**: US5 complete. `grep '"module":"http"'` returns HTTP entries; `grep '"module":"tools"'` returns tool entries.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification, cleanup, and documentation

- [ ] T021 [P] Add health check debug log using `reqLogger` in the `/health` endpoint handler in `zoekt-mcp/src/server.ts`
- [ ] T022 [P] Add 404 route-not-found `warn` log using `reqLogger` before writing 404 response in `zoekt-mcp/src/server.ts`
- [ ] T023 Verify `npm run typecheck` passes with no errors in `zoekt-mcp/`
- [ ] T024 Verify `npm run test:unit` passes with no errors in `zoekt-mcp/`
- [ ] T025 Run quickstart.md manual validation — start server in HTTP mode, execute all 5 verification scenarios from `specs/007-enhance-logging/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (logger config must have `err` serializer first)
- **Phase 3 (US1)**: Depends on Phase 2 (error key fixes establish the `err` pattern)
- **Phase 4 (US2)**: Already complete after Phase 1 + 2 — checkpoint only
- **Phase 5 (US3)**: Already complete after Phase 1 — checkpoint only
- **Phase 6 (US4)**: Depends on Phase 3 (needs `reqLogger` from request-scoped child loggers)
- **Phase 7 (US5)**: Already complete after Phase 3 — checkpoint only
- **Phase 8 (Polish)**: Depends on Phase 6

### User Story Dependencies

- **US1 (HTTP Request Logging)**: Depends on Foundational — independent of other stories
- **US2 (Error Serialization)**: Satisfied by Setup + Foundational — no story dependencies
- **US3 (Header Redaction)**: Satisfied by Setup — no story dependencies
- **US4 (Correlation IDs)**: Depends on US1 (builds on request-scoped loggers)
- **US5 (Module Tags)**: Satisfied by US1 — no additional work

### Within Phase 3 (US1) — Sequential Order

T011 → T012 → T013 → T014 → T015 → T016 → T017

These touch the same file (`server.ts`) and build on each other. T012 (helper function) can be done before T013 since it's at the bottom of the file.

### Parallel Opportunities

- **Phase 2**: ALL tasks T003–T010 are parallelizable (different files or different functions)
- **Phase 8**: T021 and T022 are parallelizable (different code locations in `server.ts`)

---

## Parallel Example: Phase 2 (Error Key Fixes)

```text
# All 8 error key fixes can run simultaneously:
T003: Fix error → err in server.ts search handler
T004: Fix error → err in server.ts list_repos handler
T005: Fix error → err in server.ts file_content handler
T006: Fix error → err in server.ts HTTP message handler
T007: Fix error → err in tools/search-files.ts
T008: Fix error → err in tools/search-symbols.ts
T009: Fix error → err in tools/find-references.ts
T010: Fix error → err in tools/get-health.ts
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001–T002) — ~5 min
2. Complete Phase 2: Foundational (T003–T010) — ~10 min, all parallel
3. Complete Phase 3: US1 HTTP Request Logging (T011–T017) — ~30 min
4. **STOP and VALIDATE**: US1 + US2 both work. Test per quickstart.md scenarios 1 + 2.
5. This is a deployable MVP that delivers the two P1 stories.

### Incremental Delivery

1. Setup + Foundational → Error serialization works (US2 ✅), redaction works (US3 ✅)
2. Add US1 → HTTP request logging works, module tags work (US1 ✅, US5 ✅)
3. Add US4 → Correlation IDs work (US4 ✅)
4. Polish → Verification complete
5. Each phase adds value without breaking previous phases.

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 25 |
| **US1 tasks** | 7 (T011–T017) |
| **US2 tasks** | 0 (satisfied by Setup + Foundational) |
| **US3 tasks** | 0 (satisfied by Setup) |
| **US4 tasks** | 3 (T018–T020) |
| **US5 tasks** | 0 (satisfied by US1) |
| **Setup tasks** | 2 (T001–T002) |
| **Foundational tasks** | 8 (T003–T010) |
| **Polish tasks** | 5 (T021–T025) |
| **Parallelizable tasks** | 12 (all [P] marked) |
| **Files modified** | 6 existing + 0 new source files |
| **New dependencies** | 0 |
