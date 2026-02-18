# Tasks: Working Tree Indexing & Multi-Org Support

**Input**: Design documents from `/specs/008-workingtree-multi-org/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/docker-infra.md, contracts/mcp-null-safety.md, quickstart.md

**Tests**: Not explicitly requested in specification — test tasks omitted. Existing 172 Vitest tests provide regression coverage.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create .env template and verify Docker image builds zoekt-index binary

- [x] T001 Create environment configuration template in docker/.env.example per contracts/docker-infra.md
- [ ] T002 Verify docker/Dockerfile.zoekt builds zoekt-index binary (already present — confirm with `docker build` and `zoekt-index --help`)

---

## Phase 2: Foundational — Null-Safety Type Changes (Blocking Prerequisites)

**Purpose**: TypeScript type updates that MUST be complete before any user story can be implemented. These changes make the type system honest about optional fields, which all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — the type changes in T003 are imported throughout the codebase.

- [x] T003 Update FileMatch.Branches to optional in zoekt-mcp/src/zoekt/types.ts per contracts/mcp-null-safety.md (change `Branches: string[]` → `Branches?: string[]`)
- [x] T004 [P] Run `npm run build` in zoekt-mcp/ to identify all downstream compilation errors from T003

**Checkpoint**: TypeScript compiles with new optional types — downstream fixes proceed in user story phases

---

## Phase 3: User Story 2 — Null-Safe Branch Handling (Priority: P1) 🎯 MVP

**Goal**: Fix all runtime crashes when branch/range data is missing, so every MCP tool works against any Zoekt backend (working-tree or otherwise).

**Independent Test**: Send search/list/file_content requests to the MCP server against an index with files lacking branch metadata — verify no errors occur.

### Implementation for User Story 2

- [x] T005 [P] [US2] Add null-guard on branches in zoekt-mcp/src/formatting/repoList.ts — change `repo.branches.length > 0` to `repo.branches && repo.branches.length > 0` per contracts/mcp-null-safety.md
- [x] T006 [P] [US2] Add optional chaining on Branches in formatSearchResults in zoekt-mcp/src/server.ts — change `match.Branches[0]` to `match.Branches?.[0]` per contracts/mcp-null-safety.md
- [x] T007 [P] [US2] Make branch parameter optional in file_content tool schema in zoekt-mcp/src/server.ts — change `z.string().default('HEAD')` to `z.string().optional()` per contracts/mcp-null-safety.md
- [x] T008 [P] [US2] Update formatFileContent signature in zoekt-mcp/src/server.ts — change `branch: string` to `branch: string | undefined` and display `branch || 'HEAD'` per contracts/mcp-null-safety.md
- [x] T009 [P] [US2] Make branch parameter optional in getFileContent in zoekt-mcp/src/zoekt/client.ts — change `branch: string = 'HEAD'` to `branch?: string`, conditionally append `b` param per contracts/mcp-null-safety.md
- [x] T010 [P] [US2] Add optional chaining on Ranges in zoekt-mcp/src/tools/find-references.ts — change `chunk.Ranges[0]?.Start?.Column` to `chunk.Ranges?.[0]?.Start?.Column` per contracts/mcp-null-safety.md
- [x] T011 [US2] Run `npm run build` and `npm test` in zoekt-mcp/ to verify all null-safety changes compile and existing tests pass
- [x] T027 [US2] Harden ChunkMatch Ranges handling across symbol/reference extraction: make `ChunkMatch.Ranges` optional in zoekt-mcp/src/zoekt/types.ts and guard `chunk.Ranges?.[i]` in zoekt-mcp/src/tools/find-references.ts and zoekt-mcp/src/tools/search-symbols.ts

**Checkpoint**: All 172 existing tests pass. MCP server handles missing branch/range data without crashes. US2 is independently complete.

---

## Phase 4: User Story 1 — Search Local Working Tree (Priority: P1)

**Goal**: Enable a developer to index a local directory on disk and search it through the MCP server, without configuring GitHub mirroring.

**Independent Test**: Start Docker infrastructure with `COMPOSE_PROFILES=workingtree` and `WORKSPACE_ROOT` pointing to a local directory, then run search/file_content/list_repos queries and verify results from local files.

### Implementation for User Story 1

- [x] T012 [US1] Rewrite docker/docker-compose.yml to add zoekt-webserver (always runs), zoekt-indexer (workingtree profile), and zoekt-sync (github profile, preserving current single-org behavior) per contracts/docker-infra.md — retain existing volumes/networks
- [x] T013 [US1] Update docker/deploy.sh to support profile-based deployment — detect COMPOSE_PROFILES from .env, replace hardcoded GITHUB_ORG requirement with profile-aware startup
- [x] T014 [US1] Update docker/README.md with working-tree mode setup instructions, including COMPOSE_PROFILES usage and .env configuration
- [ ] T015 [US1] Build and test working-tree mode end-to-end: `docker compose build`, set `COMPOSE_PROFILES=workingtree` and `WORKSPACE_ROOT` to a test directory, verify zoekt-indexer runs and files are searchable via `curl` against the Zoekt API per quickstart.md Scenario 1

**Checkpoint**: A user can set `WORKSPACE_ROOT`, start Docker in workingtree mode, and search local files. US1 is independently testable combined with US2 null-safety fixes.

---

## Phase 5: User Story 3 — Mirror Multiple GitHub Organizations (Priority: P2)

**Goal**: Support configuring multiple GitHub organizations for mirroring in a single Zoekt deployment, with backward compatibility for the existing single `GITHUB_ORG` variable.

**Independent Test**: Configure `GITHUB_ORGS=org-a,org-b`, run the sync service, and verify repos from both organizations appear in search results.

### Implementation for User Story 3

- [x] T016 [US3] Update zoekt-sync service command in docker/docker-compose.yml to iterate over comma-separated GITHUB_ORGS with deduplication and whitespace trimming per contracts/docker-infra.md — add `${GITHUB_ORGS:-${GITHUB_ORG:?...}}` fallback for backward compatibility
- [x] T017 [US3] Update docker/deploy.sh to accept GITHUB_ORGS (plural) in addition to GITHUB_ORG (singular) — update prerequisite validation and usage messages
- [x] T018 [US3] Update docker/README.md with multi-org configuration examples and backward-compatibility notes
- [ ] T019 [US3] Validate multi-org sync: configure two org names in .env, run `docker compose --profile github up`, verify sync logs show iteration over both orgs per quickstart.md Scenario 2

**Checkpoint**: Multi-org mirroring works. Existing single-org deployments unchanged. US3 is independently testable.

---

## Phase 6: User Story 4 — Dual-Mode Deployment (Priority: P3)

**Goal**: Enable running both working-tree indexing and GitHub mirroring simultaneously in a single Docker Compose stack.

**Independent Test**: Set `COMPOSE_PROFILES=workingtree,github` with both `WORKSPACE_ROOT` and `GITHUB_ORGS` configured, start all services, verify search returns results from both sources.

### Implementation for User Story 4

- [ ] T020 [US4] Verify docker-compose.yml supports dual-mode activation — start with `COMPOSE_PROFILES=workingtree,github` and confirm all three containers (zoekt-webserver, zoekt-indexer, zoekt-sync) start without conflicts per quickstart.md Scenario 3
- [ ] T021 [US4] Test shared volume concurrency — verify zoekt-indexer and zoekt-sync can write to the same `/data/index` volume simultaneously without corrupting the index
- [x] T022 [US4] Update docker/README.md with dual-mode deployment section and profile activation table per contracts/docker-infra.md Profile Activation Patterns

**Checkpoint**: Both modes run simultaneously. Search results include local files and GitHub repos. US4 is independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and cleanup across all user stories

- [x] T023 [P] Update root README.md with feature summary for working-tree mode and multi-org support
- [x] T024 [P] Update docker/.env.example with complete inline documentation for all environment variables per contracts/docker-infra.md
- [ ] T025 Run full quickstart.md validation — execute all 4 scenarios end-to-end and verify all acceptance checklist items pass
- [x] T026 Run existing test suite (`npm test` in zoekt-mcp/) to confirm no regressions across all 172 tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — types.ts change BLOCKS all user stories
- **US2 Null-Safety (Phase 3)**: Depends on Phase 2 — must complete before US1 can be tested
- **US1 Working Tree (Phase 4)**: Depends on Phase 2 (types) + Phase 3 (null-safety to avoid crashes)
- **US3 Multi-Org (Phase 5)**: Depends on Phase 2 only — can run in parallel with US1/US2
- **US4 Dual-Mode (Phase 6)**: Depends on Phase 4 (US1) + Phase 5 (US3) — both modes must exist
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US2 (P1 Null-Safety)**: Depends on Phase 2 foundational types. No dependencies on other stories. **Start first.**
- **US1 (P1 Working Tree)**: Depends on US2 (null-safety needed for working-tree indices). Docker infrastructure changes are independent of TypeScript changes.
- **US3 (P2 Multi-Org)**: Depends only on Phase 2. Independent of US1 and US2 at the code level (Docker-only changes). **Can run in parallel with US2.**
- **US4 (P3 Dual-Mode)**: Depends on US1 + US3 both being complete. Primarily a validation/integration phase.

### Within Each User Story

- Models/types before services
- Services before tool schemas
- Build verification after each code change
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 2**: T003 and T004 are sequential (change type → verify build)
- **Phase 3 (US2)**: T005–T010 are ALL parallelizable (different files, independent null-safety fixes)
- **Phase 4 (US1) + Phase 5 (US3)**: Can run in parallel — US1 modifies docker-compose.yml structure, US3 modifies sync command logic. Note: if both touch docker-compose.yml, coordinate the edits.
- **Phase 7**: T023 and T024 can run in parallel

---

## Parallel Example: User Story 2 (Null-Safety)

```
# All six null-safety fixes can be applied simultaneously (different files):
T005: zoekt-mcp/src/formatting/repoList.ts     (branches null guard)
T006: zoekt-mcp/src/server.ts                   (Branches optional chaining)
T007: zoekt-mcp/src/server.ts                   (tool schema optional)
T008: zoekt-mcp/src/server.ts                   (formatFileContent signature)
T009: zoekt-mcp/src/zoekt/client.ts             (getFileContent branch optional)
T010: zoekt-mcp/src/tools/find-references.ts    (Ranges optional chaining)

# Note: T006, T007, T008 all modify server.ts — apply together as one edit session
# Then verify: T011 (build + test)
```

## Parallel Example: User Story 1 + User Story 3

```
# After Phase 2 (foundational types) is complete:

# Developer A (US1 - Working Tree):
T012: Rewrite docker-compose.yml with profiles
T013: Update deploy.sh
T014: Update README
T015: End-to-end test

# Developer B (US3 - Multi-Org, can start in parallel):
T016: Update zoekt-sync for multi-org (inside docker-compose.yml)
T017: Update deploy.sh for GITHUB_ORGS
T018: Update README
T019: Validate multi-org

# ⚠️ Coordination needed: T012 and T016 both modify docker-compose.yml
# Recommend: T012 does full rewrite first, T016 refines the zoekt-sync command
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Complete Phase 1: Setup (.env.example)
2. Complete Phase 2: Foundational (types.ts Branches optional)
3. Complete Phase 3: US2 Null-Safety (all 6 fixes)
4. **STOP and VALIDATE**: Build passes, all 172 tests pass, no crash on missing branches
5. Complete Phase 4: US1 Working Tree (Docker infrastructure)
6. **STOP and VALIDATE**: Working-tree mode searchable end-to-end
7. Deploy/demo if ready — this is the MVP

### Incremental Delivery

1. Setup + Foundational → Type system honest about optional fields
2. Add US2 (Null-Safety) → Server hardened against any Zoekt backend → **First safe checkpoint**
3. Add US1 (Working Tree) → Local directory search works → **MVP deliverable**
4. Add US3 (Multi-Org) → Enterprise multi-org support → **Extended release**
5. Add US4 (Dual Mode) → Both modes simultaneously → **Full feature**
6. Polish → Documentation, validation, cleanup

### Suggested MVP Scope

**US2 (Null-Safety) + US1 (Working Tree)** = Tasks T001–T015 (15 tasks)

This delivers the highest-value capability (local directory search) with the safety fixes that make it work. Multi-org (US3) and dual-mode (US4) are natural follow-ups.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- T006, T007, T008 all modify server.ts — apply as one edit session to avoid merge conflicts
- T012 and T016 both modify docker-compose.yml — coordinate or sequence (T012 first)
