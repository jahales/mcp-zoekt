# Tasks: Pagination Logic Evaluation & Fix

**Input**: Design documents from `/specs/004-pagination-logic/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Yes - spec.md requires comprehensive test coverage (SC-006: ≥90% line coverage)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- All paths relative to `zoekt-mcp/`

---

## Phase 1: Setup

**Purpose**: Verify baseline and prepare workspace

- [X] T001 Checkout `004-pagination-logic` branch and run `npm test` to verify baseline (144 tests passing)
- [X] T002 Review current cursor implementation in src/pagination/cursor.ts

---

## Phase 2: Foundational (Core Cursor Refactor)

**Purpose**: Refactor cursor structure - MUST complete before user story implementation

**⚠️ CRITICAL**: All user story implementations depend on new cursor structure

### Core Implementation

- [X] T003 Update `DecodedCursor` interface to remove `limit` field in src/pagination/cursor.ts
- [X] T004 Simplify `encodeCursor()` function to accept only `(query, offset)` in src/pagination/cursor.ts
- [X] T005 Update `decodeCursor()` to ignore legacy `l` field for backward compatibility in src/pagination/cursor.ts
- [X] T006 Simplify `validateCursor()` to remove `maxLimit` parameter in src/pagination/cursor.ts
- [X] T007 Update `generateNextCursor()` to call simplified `encodeCursor()` in src/pagination/cursor.ts

### Tool Handler Updates (Parallel)

- [X] T008 [P] Update `validateCursor` call in src/tools/search-symbols.ts (remove third argument)
- [X] T009 [P] Update `validateCursor` call in src/tools/search-files.ts (remove third argument)
- [X] T010 [P] Update `validateCursor` call in src/tools/find-references.ts (remove third argument)

### Verify Compilation

- [X] T011 Run `npm run build` to verify no TypeScript errors

**Checkpoint**: Cursor refactor complete - user story test work can now begin

---

## Phase 3: User Story 1 - Consistent Pagination (Priority: P1) 🎯 MVP

**Goal**: Pagination works consistently across all three tools with no missing/duplicate results

**Independent Test**: Multi-page search returns exact expected count with no duplicates or gaps

### Tests for User Story 1

- [X] T012 [P] [US1] Update existing cursor encode/decode tests for new signature in tests/unit/pagination/cursor.test.ts
- [X] T013 [P] [US1] Add test: multi-page navigation returns all unique results in tests/unit/pagination/cursor.test.ts
- [X] T014 [P] [US1] Add test: cursor/query mismatch returns clear error in tests/unit/pagination/cursor.test.ts
- [X] T015 [P] [US1] Add test: final page returns no nextCursor in tests/unit/pagination/cursor.test.ts

### Edge Case Tests for User Story 1

- [X] T016 [P] [US1] Add test: empty cursor string returns null in tests/unit/pagination/cursor.test.ts
- [X] T017 [P] [US1] Add test: non-base64 cursor returns null in tests/unit/pagination/cursor.test.ts
- [X] T018 [P] [US1] Add test: non-JSON payload returns null in tests/unit/pagination/cursor.test.ts
- [X] T019 [P] [US1] Add test: missing required fields returns null in tests/unit/pagination/cursor.test.ts
- [X] T020 [P] [US1] Add test: negative offset returns validation error in tests/unit/pagination/cursor.test.ts

### Verification

- [X] T021 [US1] Run `npm test -- cursor` and verify all cursor tests pass

**Checkpoint**: User Story 1 complete - pagination consistency verified with tests

---

## Phase 4: User Story 2 - Robust Limit Handling (Priority: P1)

**Goal**: Limit parameter correctly controls result count regardless of file distribution

**Independent Test**: Specify limit=N, receive exactly N items (or fewer if exhausted)

### Tests for User Story 2

- [X] T022 [P] [US2] Add test: limit=5 returns exactly 5 symbols in tests/unit/tools/search-symbols.test.ts
- [X] T023 [P] [US2] Add test: limit=10 across multi-symbol files returns 10 symbols (not 10 files) in tests/unit/tools/search-symbols.test.ts
- [X] T024 [P] [US2] Add test: limit correctly applies to search_files in tests/unit/tools/search-files.test.ts
- [X] T025 [P] [US2] Add test: limit correctly applies to find_references in tests/unit/tools/find-references.test.ts

### Verification

- [X] T026 [US2] Verify Zoekt client passes limit as MaxDocDisplayCount in src/zoekt/client.ts (read-only verification)
- [X] T027 [US2] Run `npm test -- tools` and verify all tool tests pass

**Checkpoint**: User Story 2 complete - limit handling verified

---

## Phase 5: User Story 3 - Limit Flexibility Between Pages (Priority: P2)

**Goal**: Users can change limit parameter between pages without cursor invalidation

**Independent Test**: Start with limit=30, continue with limit=50, no errors

### Tests for User Story 3

- [X] T028 [P] [US3] Add test: cursor created with limit=30 works with next request limit=50 in tests/unit/pagination/cursor.test.ts
- [X] T029 [P] [US3] Add test: cursor created with limit=100 works with next request limit=10 in tests/unit/pagination/cursor.test.ts
- [X] T030 [P] [US3] Add test: old cursor format with `l` field still decodes successfully in tests/unit/pagination/cursor.test.ts

### Verification

- [X] T031 [US3] Run full test suite `npm test` to verify no regressions

**Checkpoint**: User Story 3 complete - flexible page sizes verified

---

## Phase 6: User Story 4 - Deep Pagination Efficiency (Priority: P3)

**Goal**: Reasonable performance for page 10+ (within 2x of page 1)

**Independent Test**: Measure response time page 1 vs page 10

### Tests for User Story 4

- [X] T032 [P] [US4] Add test: large offset (270) returns correct results in tests/unit/pagination/cursor.test.ts
- [X] T033 [P] [US4] Add test: offset exceeding total results returns empty with no cursor in tests/unit/pagination/cursor.test.ts
- [X] T034 [P] [US4] Add test: zero offset (first page) works correctly in tests/unit/pagination/cursor.test.ts

### Verification

- [X] T035 [US4] Run `npm test` and verify all tests pass

**Checkpoint**: User Story 4 complete - deep pagination handled correctly

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T036 Run `npm test -- --coverage` and verify cursor.ts has ≥90% line coverage (SKIPPED: coverage package not installed)
- [X] T037 Verify total test count increased by ~15 new tests (from 144 baseline) → 163 tests (added 19)
- [X] T038 Run quickstart.md validation steps to confirm implementation matches design
- [ ] T039 Update README.md if pagination behavior documentation exists

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ─── BLOCKS ALL ───┐
    │                                     │
    ▼                                     ▼
Phase 3 (US1)    Phase 4 (US2)    Phase 5 (US3)    Phase 6 (US4)
    │                 │                 │                 │
    └─────────────────┴─────────────────┴─────────────────┘
                              │
                              ▼
                    Phase 7 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (P1) | Phase 2 | US2, US3, US4 |
| US2 (P1) | Phase 2 | US1, US3, US4 |
| US3 (P2) | Phase 2 | US1, US2, US4 |
| US4 (P3) | Phase 2 | US1, US2, US3 |

### Within Each Phase

- Tasks marked [P] can run in parallel
- Tests should be written before implementation verification
- Run test commands after test additions

---

## Parallel Execution Examples

### Phase 2: Foundational (After T007)

```bash
# These can run in parallel (different files):
T008: Update search-symbols.ts
T009: Update search-files.ts
T010: Update find-references.ts
```

### Phase 3: User Story 1 Tests

```bash
# All test additions can run in parallel:
T012-T020: All cursor test additions (same file, but appending)
```

### All User Stories After Phase 2

```bash
# If multiple developers available:
Developer A: Phase 3 (US1 tests)
Developer B: Phase 4 (US2 tests)
Developer C: Phase 5 (US3 tests)
Developer D: Phase 6 (US4 tests)
```

---

## Implementation Strategy

### MVP First (Recommended)

1. Complete Phase 1: Setup (verify baseline)
2. Complete Phase 2: Foundational (core refactor)
3. Complete Phase 3: User Story 1 (consistent pagination)
4. **STOP and VALIDATE**: Run `npm test`, verify core functionality
5. Continue with remaining user stories

### Estimated Time

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 2 | 10 min |
| Phase 2 | 9 | 45 min |
| Phase 3 | 10 | 30 min |
| Phase 4 | 6 | 20 min |
| Phase 5 | 4 | 15 min |
| Phase 6 | 4 | 15 min |
| Phase 7 | 4 | 15 min |
| **Total** | **39** | **~2.5 hours** |

---

## Notes

- All tests in this feature are UNIT tests (no integration/contract tests needed)
- Cursor format change is backward compatible (old cursors still decode)
- No new dependencies required
- Focus on test additions - implementation changes are minimal
- Verify coverage target: ≥90% for src/pagination/cursor.ts
