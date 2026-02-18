# Implementation Plan: Enhance Logging Strategy

**Branch**: `007-enhance-logging` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-enhance-logging/spec.md`

## Summary

The MCP HTTP server currently has minimal logging — no per-request entries, no request/session correlation IDs, no sensitive-header redaction, and all 8 error-logging call sites use a non-standard key (`error`) that prevents Pino's error serializer from emitting stack traces. This plan adds structured HTTP request logging, fixes error serialization, configures header redaction, introduces request-scoped child loggers with correlation IDs, and applies consistent module tagging — all using existing Pino features with zero new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, ES2022 target  
**Primary Dependencies**: `@modelcontextprotocol/sdk` ^1.25.2, `pino` ^9.0.0, `zod` ^3.23.0  
**Storage**: N/A — this feature is purely about log output, not persistence  
**Testing**: Vitest 2.x — unit tests in `tests/unit/`, integration tests in `tests/integration/`  
**Target Platform**: Node.js 18+ (LTS), Docker container  
**Project Type**: Single TypeScript project (`zoekt-mcp/`)  
**Performance Goals**: Logging overhead must be negligible; `process.hrtime.bigint()` for high-resolution timing  
**Constraints**: Zero new runtime dependencies (FR-011); Pino ^9 already in `package.json`  
**Scale/Scope**: 2 source files changed significantly (`logger.ts`, `server.ts`), 4 tool files with single-line fixes, 1 new test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MCP Protocol Compliance | ✅ PASS | Logging changes do not affect MCP protocol behavior or tool schemas |
| II. Zoekt Integration Fidelity | ✅ PASS | No changes to Zoekt client or query handling |
| III. Minimal Dependencies | ✅ PASS | Zero new dependencies; all features use existing Pino ^9 |
| IV. Query-First API Design | ✅ PASS | N/A — no tool parameter changes |
| V. Explicit Error Handling | ✅ PASS | Improves error visibility by enabling proper stack trace serialization |
| VI. Observability & Debugging | ✅ PASS | Core purpose of this feature — per-request logging, correlation IDs, module tags |
| VII. Simplicity First (YAGNI) | ✅ PASS | Each change is minimal and uses built-in Pino APIs; no custom middleware abstractions |
| Technology Stack | ✅ PASS | TypeScript 5.x, Node.js 18+, Vitest — no changes |
| Security | ✅ PASS | Adds header redaction to prevent credential leakage in logs |
| TDD Workflow | ✅ PASS | Unit tests will cover logger config, error serializer key, and redaction |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/007-enhance-logging/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── logging-contract.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (files touched)

```text
zoekt-mcp/
├── src/
│   ├── logger.ts              # Enhanced: add serializers, redact config
│   ├── server.ts              # Enhanced: HTTP request logging, child loggers, correlation IDs
│   ├── index.ts               # Minor: module tag on startup logs
│   └── tools/
│       ├── search-files.ts    # Fix: error → err key
│       ├── search-symbols.ts  # Fix: error → err key
│       ├── find-references.ts # Fix: error → err key
│       └── get-health.ts      # Fix: error → err key
└── tests/
    └── unit/
        └── logger.test.ts     # New: unit tests for enhanced logger config
```

**Structure Decision**: Single project — all changes are within the existing `zoekt-mcp/` directory. No new directories needed except the spec contracts folder.

## Complexity Tracking

No constitution violations. All changes use built-in Pino features and follow the Simplicity First principle.

## Constitution Re-Check (Post Phase 1 Design)

| Principle | Status | Design Verification |
|-----------|--------|---------------------|
| I. MCP Protocol Compliance | ✅ PASS | No tool schemas, descriptions, or MCP protocol behavior changed |
| II. Zoekt Integration Fidelity | ✅ PASS | No changes to `zoekt/client.ts` or query handling |
| III. Minimal Dependencies | ✅ PASS | Zero new dependencies confirmed — `pino-http` explicitly rejected in research |
| IV. Query-First API Design | ✅ PASS | N/A — no tool parameters changed |
| V. Explicit Error Handling | ✅ PASS | Error serializer contract ensures `type`, `message`, `stack` are always present |
| VI. Observability & Debugging | ✅ PASS | Per-request logging, correlation IDs, module tags, and header redaction all directly serve this principle |
| VII. Simplicity First (YAGNI) | ✅ PASS | Manual child logger pattern (~15 LOC) preferred over `pino-http` middleware abstraction; no AsyncLocalStorage |
| Security | ✅ PASS | Redact contract covers `authorization`, `cookie`, `set-cookie`, `proxy-authorization` |
| TDD Workflow | ✅ PASS | Unit tests specified for logger config (serializer, redaction) |

**Post-design gate result**: ALL PASS — proceed to Phase 2 (tasks).
