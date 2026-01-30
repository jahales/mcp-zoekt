# Tasks: E2E & Integration Tests

**Input**: Design documents from `/specs/002-e2e-integration-tests/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Configure Vitest projects and test infrastructure

- [X] T001 Update zoekt-mcp/vitest.config.ts with multi-project configuration (unit + integration projects)
- [X] T002 [P] Update zoekt-mcp/package.json with new npm scripts: test (unit only), test:integration, test:all
- [X] T003 [P] Create zoekt-mcp/tests/integration/ directory structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Test utilities and fixtures that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create zoekt-mcp/tests/helpers/zoekt-health.ts with waitForZoekt() health check utility
- [X] T005 [P] Create zoekt-mcp/tests/helpers/mcp-test-client.ts with subprocess-based MCP client
- [X] T006 [P] Create zoekt-mcp/tests/fixtures/test-repo/README.md with test corpus content
- [X] T007 [P] Create zoekt-mcp/tests/fixtures/test-repo/index.ts with test corpus content
- [X] T008 [P] Create zoekt-mcp/tests/fixtures/test-repo/sample.ts with test corpus content
- [X] T009 [P] Create zoekt-mcp/tests/fixtures/test-repo/utils/helper.ts with test corpus content
- [X] T010 Create zoekt-mcp/tests/integration/setup.ts with beforeAll/afterAll hooks and health check
- [X] T011 [P] Create docker/docker-compose.test.yml for test infrastructure with embedded corpus

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Developer Validates MCP Tools Work End-to-End (Priority: P1) 🎯 MVP

**Goal**: Integration tests verify all 3 MCP tools work correctly against real Zoekt instance

**Independent Test**: Start Docker infrastructure, run `npm run test:integration`, verify all tools return expected data structures

### Implementation for User Story 1

- [X] T012 [US1] Create zoekt-mcp/tests/integration/search-tool.integration.test.ts with basic search tests
- [X] T013 [US1] Add search tests for: function search, async function, constant search, class search in search-tool.integration.test.ts
- [X] T014 [US1] Add search edge case tests: no results, special characters, file filter in search-tool.integration.test.ts
- [X] T015 [P] [US1] Create zoekt-mcp/tests/integration/list-repos-tool.integration.test.ts with repo listing tests
- [X] T016 [P] [US1] Create zoekt-mcp/tests/integration/file-content-tool.integration.test.ts with file content tests
- [X] T017 [US1] Add file content edge case tests: nested file, invalid path, invalid repo in file-content-tool.integration.test.ts

**Checkpoint**: User Story 1 complete - all 3 MCP tools validated against real Zoekt

---

## Phase 4: User Story 2 - Developer Catches Connection & Timeout Issues (Priority: P2)

**Goal**: Integration tests verify error handling when backend is unavailable or slow

**Independent Test**: Stop Zoekt, run error handling tests, verify appropriate error responses

### Implementation for User Story 2

- [X] T018 [US2] Create zoekt-mcp/tests/integration/error-handling.integration.test.ts with unavailable backend test
- [X] T019 [US2] Add timeout handling test in error-handling.integration.test.ts (use short timeout config)
- [X] T020 [US2] Add ZoektError code validation (UNAVAILABLE, TIMEOUT) in error-handling.integration.test.ts

**Checkpoint**: User Story 2 complete - error paths validated

---

## Phase 5: User Story 3 - Developer Validates MCP Protocol Compliance (Priority: P3)

**Goal**: Integration tests verify full MCP JSON-RPC protocol flow via subprocess

**Independent Test**: Spin up MCP server subprocess, send JSON-RPC messages, verify responses

### Implementation for User Story 3

- [X] T021 [US3] Create zoekt-mcp/tests/integration/mcp-protocol.integration.test.ts with tools/list test
- [X] T022 [US3] Add tools/call search test in mcp-protocol.integration.test.ts
- [X] T023 [US3] Add tools/call list_repos test in mcp-protocol.integration.test.ts
- [X] T024 [US3] Add tools/call file_content test in mcp-protocol.integration.test.ts
- [X] T025 [US3] Add invalid tool error test in mcp-protocol.integration.test.ts

**Checkpoint**: User Story 3 complete - full MCP protocol compliance validated

---

## Phase 6: CI & Polish

**Purpose**: CI workflow and documentation

- [X] T026 [P] Create .github/workflows/integration-tests.yml with Docker Compose provisioning
- [X] T027 [P] Update zoekt-mcp/README.md with integration test documentation
- [X] T028 Run quickstart.md validation - verify all commands work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **CI & Polish (Phase 6)**: Can start after Phase 3 (US1) is complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses mcp-test-client.ts from Foundational

### Parallel Opportunities

```text
# Phase 2 - All [P] tasks can run in parallel:
T005 mcp-test-client.ts  |  T006 README.md  |  T007 index.ts  |  T008 sample.ts  |  T009 helper.ts  |  T011 docker-compose.test.yml

# After Phase 2 - All user stories can start in parallel:
US1: T012-T017  |  US2: T018-T020  |  US3: T021-T025

# Within US1 - These can run in parallel:
T015 list-repos-tool.integration.test.ts  |  T016 file-content-tool.integration.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `npm run test:integration` - all 3 tool tests should pass
5. This alone delivers significant value (catches API format issues like Result→result)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Run tests → MVP complete!
3. Add User Story 2 → Adds error handling coverage
4. Add User Story 3 → Adds full protocol validation
5. Add CI workflow → Automated on every PR

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- All integration tests require running Zoekt infrastructure
- MCP protocol tests (US3) require built dist/ directory

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 28 |
| Phase 1 (Setup) | 3 |
| Phase 2 (Foundational) | 8 |
| Phase 3 (US1) | 6 |
| Phase 4 (US2) | 3 |
| Phase 5 (US3) | 5 |
| Phase 6 (CI & Polish) | 3 |
| Parallelizable tasks | 14 |
