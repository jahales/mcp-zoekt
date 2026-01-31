# Tasks: Zoekt MCP Tools Enhancement

**Input**: Design documents from `/specs/003-zoekt-mcp-tools/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests included for each user story per constitution's TDD mandate.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US6)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project structure and foundational modules

- [X] T001 Create directory structure: `zoekt-mcp/src/tools/`, `zoekt-mcp/src/pagination/`, `zoekt-mcp/src/errors/`
- [X] T002 [P] Add Symbol and HealthStatus types to `zoekt-mcp/src/zoekt/types.ts`
- [X] T003 [P] Create error codes enum and StructuredError type in `zoekt-mcp/src/errors/codes.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by ALL user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement `encodeCursor(query, offset, limit): string` in `zoekt-mcp/src/pagination/cursor.ts`
- [X] T005 Implement `decodeCursor(cursor): { queryHash, offset, limit }` in `zoekt-mcp/src/pagination/cursor.ts`
- [X] T006 [P] Add cursor validation (query hash match, offset bounds) in `zoekt-mcp/src/pagination/cursor.ts`
- [X] T007 [P] Unit tests for cursor encode/decode in `zoekt-mcp/tests/unit/pagination/cursor.test.ts`
- [X] T008 Implement `enhanceError(error): StructuredError` in `zoekt-mcp/src/errors/codes.ts`
- [X] T009 [P] Add error pattern matching for regex, unknown field, timeout errors in `zoekt-mcp/src/errors/codes.ts`
- [X] T010 [P] Unit tests for error enhancement in `zoekt-mcp/tests/unit/errors/codes.test.ts`
- [X] T011 Add `checkHealth()` method to ZoektClient in `zoekt-mcp/src/zoekt/client.ts`
- [X] T012 Add `getStats()` method (type:repo query) to ZoektClient in `zoekt-mcp/src/zoekt/client.ts`

**Checkpoint**: Foundation ready - pagination cursors, error handling, and client methods available ✅

---

## Phase 3: User Story 1 - Search for Symbols (Priority: P1) 🎯 MVP

**Goal**: Developers can search for symbol names (functions, classes, methods) across repositories

**Independent Test**: Call `search_symbols` with query "handleRequest", verify results contain only symbol matches with kind metadata

### Tests for User Story 1

- [X] T013 [P] [US1] Unit test for search_symbols tool in `zoekt-mcp/tests/unit/tools/search-symbols.test.ts`
- [X] T014 [P] [US1] Test sym: query prefix wrapping in `zoekt-mcp/tests/unit/tools/search-symbols.test.ts`
- [X] T015 [P] [US1] Test Symbol extraction from ChunkMatch.SymbolInfo in `zoekt-mcp/tests/unit/tools/search-symbols.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Create search_symbols tool skeleton in `zoekt-mcp/src/tools/search-symbols.ts`
- [X] T017 [US1] Implement query wrapping with `sym:` prefix in `zoekt-mcp/src/tools/search-symbols.ts`
- [X] T018 [US1] Implement Symbol extraction from Zoekt response in `zoekt-mcp/src/tools/search-symbols.ts`
- [X] T019 [US1] Add pagination cursor support (encode/decode) in `zoekt-mcp/src/tools/search-symbols.ts`
- [X] T020 [US1] Add Zod schema with query syntax examples in description in `zoekt-mcp/src/tools/search-symbols.ts`
- [X] T021 [US1] Register search_symbols tool in `zoekt-mcp/src/server.ts`
- [X] T022 [US1] Add logging for search_symbols operations in `zoekt-mcp/src/tools/search-symbols.ts`

**Checkpoint**: search_symbols tool functional and independently testable ✅

---

## Phase 4: User Story 2 - Search for Files (Priority: P1) 🎯 MVP

**Goal**: Developers can search for files by filename pattern without content matching

**Independent Test**: Call `search_files` with pattern "package.json", verify results list filenames without content

### Tests for User Story 2

- [X] T023 [P] [US2] Unit test for search_files tool in `zoekt-mcp/tests/unit/tools/search-files.test.ts`
- [X] T024 [P] [US2] Test type:filename query mode in `zoekt-mcp/tests/unit/tools/search-files.test.ts`
- [X] T025 [P] [US2] Test regex pattern handling in `zoekt-mcp/tests/unit/tools/search-files.test.ts`

### Implementation for User Story 2

- [X] T026 [US2] Create search_files tool skeleton in `zoekt-mcp/src/tools/search-files.ts`
- [X] T027 [US2] Implement query wrapping with `type:filename` in `zoekt-mcp/src/tools/search-files.ts`
- [X] T028 [US2] Implement FileMatch extraction (filename only, no content) in `zoekt-mcp/src/tools/search-files.ts`
- [X] T029 [US2] Add pagination cursor support in `zoekt-mcp/src/tools/search-files.ts`
- [X] T030 [US2] Add Zod schema with query syntax examples in description in `zoekt-mcp/src/tools/search-files.ts`
- [X] T031 [US2] Register search_files tool in `zoekt-mcp/src/server.ts`
- [X] T032 [US2] Add logging for search_files operations in `zoekt-mcp/src/tools/search-files.ts`

**Checkpoint**: search_files tool functional and independently testable ✅

---

## Phase 5: User Story 3 - Find References (Priority: P2)

**Goal**: Developers can find all definitions and usages of a symbol across repositories

**Independent Test**: Call `find_references` with a known function name, verify results include definitions AND usages with labels

### Tests for User Story 3

- [X] T033 [P] [US3] Unit test for find_references tool in `zoekt-mcp/tests/unit/tools/find-references.test.ts`
- [X] T034 [P] [US3] Test combined sym: + content search in `zoekt-mcp/tests/unit/tools/find-references.test.ts`
- [X] T035 [P] [US3] Test definition/usage deduplication and labeling in `zoekt-mcp/tests/unit/tools/find-references.test.ts`

### Implementation for User Story 3

- [X] T036 [US3] Create find_references tool skeleton in `zoekt-mcp/src/tools/find-references.ts`
- [X] T037 [US3] Implement definition search using `sym:` query in `zoekt-mcp/src/tools/find-references.ts`
- [X] T038 [US3] Implement usage search using content query in `zoekt-mcp/src/tools/find-references.ts`
- [X] T039 [US3] Implement deduplication (remove definitions from usages) in `zoekt-mcp/src/tools/find-references.ts`
- [X] T040 [US3] Add ReferenceResult labeling (definition/usage) in `zoekt-mcp/src/tools/find-references.ts`
- [X] T041 [US3] Add pagination cursor support in `zoekt-mcp/src/tools/find-references.ts`
- [X] T042 [US3] Add Zod schema with query syntax examples in description in `zoekt-mcp/src/tools/find-references.ts`
- [X] T043 [US3] Register find_references tool in `zoekt-mcp/src/server.ts`
- [X] T044 [US3] Add logging for find_references operations in `zoekt-mcp/src/tools/find-references.ts`

**Checkpoint**: find_references tool functional and independently testable ✅

---

## Phase 6: User Story 4 - Pagination Support (Priority: P2)

**Goal**: Developers can paginate through 500+ search results

**Independent Test**: Execute broad search returning 100+ results, verify nextCursor, fetch next page, verify different results

### Tests for User Story 4

- [X] T045 [P] [US4] Integration test for pagination across tools in `zoekt-mcp/tests/unit/pagination/cursor.test.ts`
- [X] T046 [P] [US4] Test nextCursor generation when more results available in `zoekt-mcp/tests/unit/pagination/cursor.test.ts`
- [X] T047 [P] [US4] Test cursor rejection for wrong query hash in `zoekt-mcp/tests/unit/pagination/cursor.test.ts`

### Implementation for User Story 4

- [X] T048 [US4] Add cursor parameter to existing search tool in `zoekt-mcp/src/server.ts`
- [X] T049 [US4] Implement offset-based result slicing in search tool in `zoekt-mcp/src/tools/search-symbols.ts`
- [X] T050 [US4] Add nextCursor generation logic to search tool in `zoekt-mcp/src/tools/search-symbols.ts`
- [X] T051 [US4] Update search tool Zod schema with cursor parameter in `zoekt-mcp/src/server.ts`
- [X] T052 [US4] Verify pagination works consistently across all search tools in `zoekt-mcp/tests/unit/tools/*.test.ts`

**Checkpoint**: All search tools support pagination with stateless cursors ✅

---

## Phase 7: User Story 5 - Health Check (Priority: P3)

**Goal**: Operators can check Zoekt MCP server and backend health status

**Independent Test**: Call `get_health` tool, verify response includes status, connectivity, and index stats

### Tests for User Story 5

- [X] T053 [P] [US5] Unit test for get_health tool in `zoekt-mcp/tests/unit/tools/get-health.test.ts`
- [X] T054 [P] [US5] Test healthy response with mock Zoekt in `zoekt-mcp/tests/unit/tools/get-health.test.ts`
- [X] T055 [P] [US5] Test unhealthy response when Zoekt unavailable in `zoekt-mcp/tests/unit/tools/get-health.test.ts`

### Implementation for User Story 5

- [X] T056 [US5] Create get_health tool skeleton in `zoekt-mcp/src/tools/get-health.ts`
- [X] T057 [US5] Implement /healthz endpoint call via ZoektClient in `zoekt-mcp/src/tools/get-health.ts`
- [X] T058 [US5] Implement index stats retrieval (type:repo query) in `zoekt-mcp/src/tools/get-health.ts`
- [X] T059 [US5] Build HealthStatus response with all required fields in `zoekt-mcp/src/tools/get-health.ts`
- [X] T060 [US5] Handle Zoekt unavailable scenario (unhealthy status) in `zoekt-mcp/src/tools/get-health.ts`
- [X] T061 [US5] Register get_health tool in `zoekt-mcp/src/server.ts`
- [X] T062 [US5] Add logging for get_health operations in `zoekt-mcp/src/tools/get-health.ts`

**Checkpoint**: get_health tool functional, responds within 500ms ✅

---

## Phase 8: User Story 6 - Helpful Error Messages (Priority: P2)

**Goal**: Developers get clear, actionable error messages when searches fail

**Independent Test**: Submit invalid query (malformed regex), verify error includes specific issue and correction hint

### Tests for User Story 6

- [X] T063 [P] [US6] Test regex syntax error detection in `zoekt-mcp/tests/unit/errors/codes.test.ts`
- [X] T064 [P] [US6] Test unknown field error with valid fields list in `zoekt-mcp/tests/unit/errors/codes.test.ts`
- [X] T065 [P] [US6] Test timeout error with query refinement hints in `zoekt-mcp/tests/unit/errors/codes.test.ts`

### Implementation for User Story 6

- [X] T066 [US6] Add regex error pattern detection in `zoekt-mcp/src/errors/codes.ts`
- [X] T067 [US6] Add unknown field detection with valid fields list in `zoekt-mcp/src/errors/codes.ts`
- [X] T068 [US6] Add timeout error hint generation in `zoekt-mcp/src/errors/codes.ts`
- [X] T069 [US6] Integrate enhanced errors into all tools' catch blocks in `zoekt-mcp/src/tools/*.ts`
- [X] T070 [US6] Ensure all errors include error code for programmatic handling in `zoekt-mcp/src/errors/codes.ts`

**Checkpoint**: 90% of common query mistakes return actionable hints ✅

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [X] T071 [P] Update README.md with new tools documentation in `zoekt-mcp/README.md`
- [X] T072 [P] Add query syntax examples (3+ per tool) to all tool descriptions in `zoekt-mcp/src/tools/*.ts`
- [X] T073 [P] Run quickstart.md validation scenarios in `specs/003-zoekt-mcp-tools/quickstart.md`
- [X] T074 Integration tests for all tools together in `zoekt-mcp/tests/integration/new-tools.integration.test.ts`
- [X] T075 Performance validation: search <2s, health <500ms in `zoekt-mcp/tests/integration/performance.integration.test.ts`
- [X] T076 Code cleanup and ensure strict TypeScript compliance across all new files

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──► Phase 2 (Foundational) ──┬──► Phase 3 (US1: search_symbols) ─┐
                                             ├──► Phase 4 (US2: search_files) ───┼──► Phase 9 (Polish)
                                             ├──► Phase 5 (US3: find_references) ┤
                                             ├──► Phase 6 (US4: pagination) ──────┤
                                             ├──► Phase 7 (US5: health) ──────────┤
                                             └──► Phase 8 (US6: errors) ──────────┘
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (search_symbols) | Phase 2 | US2, US5, US6 |
| US2 (search_files) | Phase 2 | US1, US5, US6 |
| US3 (find_references) | Phase 2 | US5, US6 |
| US4 (pagination) | Phase 2 + US1 (for testing) | US5, US6 |
| US5 (health) | Phase 2 | US1, US2, US3, US6 |
| US6 (errors) | Phase 2 | All stories |

### Within Each User Story

1. Tests written FIRST and must FAIL
2. Tool skeleton created
3. Core implementation
4. Pagination integration
5. Tool registration in server.ts
6. Logging added

---

## Parallel Execution Examples

### Phase 2: Foundational

```bash
# These can run in parallel (different files):
T006 [P] cursor validation
T007 [P] cursor unit tests
T009 [P] error pattern matching
T010 [P] error unit tests
```

### User Story 1: search_symbols

```bash
# Tests can run in parallel:
T013 [P] [US1] Unit test skeleton
T014 [P] [US1] sym: prefix test
T015 [P] [US1] Symbol extraction test
```

### Cross-Story Parallelism

```bash
# With 3 developers after Phase 2:
Dev A: US1 (search_symbols) → US4 (pagination)
Dev B: US2 (search_files) → US3 (find_references)
Dev C: US5 (health) → US6 (errors)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL GATE**)
3. Complete Phase 3: US1 (search_symbols)
4. Complete Phase 4: US2 (search_files)
5. **STOP AND VALIDATE**: Both tools work independently
6. Deploy/demo if ready - this is MVP!

### Incremental Delivery

| Increment | Stories Included | Value Delivered |
|-----------|------------------|-----------------|
| MVP | US1 + US2 | Symbol and file search |
| +1 | US3 | Find references |
| +2 | US4 | Pagination for large results |
| +3 | US5 | Health monitoring |
| +4 | US6 | Better error messages |
| Final | Polish | Documentation, performance |

---

## Summary

| Metric | Count |
|--------|-------|
| Total Tasks | 76 |
| Phase 1 (Setup) | 3 |
| Phase 2 (Foundational) | 9 |
| User Story Tasks | 54 |
| Polish Tasks | 6 |
| Parallelizable [P] | 31 |

**Suggested MVP Scope**: User Stories 1 + 2 (search_symbols, search_files)

**Format Validation**: ✅ All tasks follow `- [ ] [ID] [P?] [Story?] Description with file path`
