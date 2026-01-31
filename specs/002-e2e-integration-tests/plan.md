# Implementation Plan: E2E & Integration Tests

**Branch**: `002-e2e-integration-tests` | **Date**: 2026-01-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-e2e-integration-tests/spec.md`

## Summary

Add a comprehensive integration test suite for the Zoekt MCP server using Vitest's project feature to separate unit and integration tests. Tests run against a real Zoekt instance via embedded fixture corpus, with full MCP protocol validation via subprocess stdio communication. CI workflow provisions Docker infrastructure automatically.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: Vitest 2.x (projects feature), @modelcontextprotocol/sdk (test client), node:child_process (subprocess spawning)  
**Storage**: N/A (tests use embedded fixture files)  
**Testing**: Vitest with separate project configurations for unit vs integration  
**Target Platform**: Linux (CI), Windows/macOS (local dev)
**Project Type**: Single project with multi-project test configuration  
**Performance Goals**: Integration tests complete in <30 seconds  
**Constraints**: CI must provision Docker Compose infrastructure; unit tests must remain isolated  
**Scale/Scope**: 3 MCP tools to test, ~15-20 integration test cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| **I. MCP Protocol Compliance** | ✅ PASS | P3 story validates full JSON-RPC message flow via subprocess |
| **II. Zoekt Integration Fidelity** | ✅ PASS | Tests verify real Zoekt responses, not mocks |
| **III. Minimal Dependencies** | ✅ PASS | No new prod dependencies; only test utilities |
| **IV. Explicit Error Handling** | ✅ PASS | P2 story validates error paths (unavailable, timeout) |
| **V. Observability & Debugging** | ✅ PASS | NFR-002 requires clear diagnostic output |

**Code Quality Gates (Constitution)**:
| Gate | Compliance | Notes |
|------|------------|-------|
| ESLint + TypeScript strict | ✅ PASS | Test files follow same linting rules |
| JSDoc for public functions | ✅ PASS | Test helpers will have JSDoc |
| Integration tests for MCP tools | ✅ PASS | This feature implements this requirement |

## Project Structure

### Documentation (this feature)

```text
specs/002-e2e-integration-tests/
├── plan.md              # This file
├── research.md          # Phase 0: Vitest projects, MCP testing patterns
├── data-model.md        # Phase 1: Test fixtures and expected results
├── quickstart.md        # Phase 1: Running integration tests locally
├── contracts/           # Phase 1: N/A for test feature
└── tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
zoekt-mcp/
├── src/                          # Existing source (unchanged)
├── vitest.config.ts              # Updated: multi-project configuration
├── vitest.config.unit.ts         # New: unit test project config
├── vitest.config.integration.ts  # New: integration test project config
├── tests/
│   ├── unit/                     # Existing unit tests (unchanged)
│   ├── integration/              # New: integration tests
│   │   ├── setup.ts              # Test setup/teardown, health checks
│   │   ├── search-tool.integration.test.ts
│   │   ├── list-repos-tool.integration.test.ts
│   │   ├── file-content-tool.integration.test.ts
│   │   ├── error-handling.integration.test.ts
│   │   └── mcp-protocol.integration.test.ts
│   ├── fixtures/                 # New: embedded test corpus
│   │   └── test-repo/
│   │       ├── sample.ts
│   │       ├── utils/
│   │       │   └── helper.ts
│   │       └── README.md
│   └── helpers/                  # New: test utilities
│       ├── mcp-test-client.ts    # Subprocess MCP client
│       └── zoekt-health.ts       # Health check utilities

docker/
├── docker-compose.yml            # Existing (may need test mode adjustments)
└── docker-compose.test.yml       # New: test-specific compose file

.github/
└── workflows/
    └── integration-tests.yml     # New: CI workflow for integration tests
```

**Structure Decision**: Single project with Vitest's `projects` configuration for test separation. Tests in `tests/integration/` run only when explicitly requested via `--project integration` or `npm run test:integration`.

## Complexity Tracking

> No constitution violations. All requirements align with existing principles.
