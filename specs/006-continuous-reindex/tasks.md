# Tasks: Continuous Reindex for Docker Compose

**Input**: Design documents from `/specs/006-continuous-reindex/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/docker-compose-sync.md, quickstart.md

**Tests**: Not requested in the feature specification. No test tasks generated.

**Organization**: Tasks are grouped by user story. All user stories modify the same two files (`docker/docker-compose.yml` and `docker/README.md`) so parallelism across stories is limited — they are sequenced by priority.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Remove obsolete services and create the new `zoekt-sync` service skeleton

- [X] T001 Remove `zoekt-mirror` service definition from docker/docker-compose.yml
- [X] T002 Remove `zoekt-indexserver` service definition from docker/docker-compose.yml
- [X] T003 Update `zoekt-webserver` service to remove `depends_on: zoekt-indexserver` in docker/docker-compose.yml
- [X] T004 Add `zoekt-sync` service skeleton (image, container_name, restart, entrypoint, volumes, networks) to docker/docker-compose.yml

**Checkpoint**: docker-compose.yml has three services: zoekt-sync (skeleton), zoekt-webserver, and volume/network definitions. `docker compose config` validates without errors.

---

## Phase 2: User Story 1 — Repositories Stay Fresh Without Manual Intervention (Priority: P1) 🎯 MVP

**Goal**: Mirror + index runs in a continuous loop so search results stay current without manual restarts.

**Independent Test**: `docker compose up -d`, wait for first cycle to complete in logs, verify `curl` search returns indexed repos. Wait for second cycle; confirm it runs automatically.

### Implementation for User Story 1

- [X] T005 [US1] Implement git config and mirror command in zoekt-sync command block in docker/docker-compose.yml
- [X] T006 [US1] Implement per-repo indexing loop with error isolation (`|| echo "Failed..."`) in zoekt-sync command block in docker/docker-compose.yml
- [X] T007 [US1] Wrap mirror + index in `while true; do ... ; sleep 3600; done` loop in zoekt-sync command block in docker/docker-compose.yml
- [X] T008 [US1] Add ISO 8601 timestamped log messages for cycle start, mirror start, index start, and cycle complete in zoekt-sync command block in docker/docker-compose.yml
- [X] T009 [US1] Update file header comment in docker/docker-compose.yml to describe continuous sync behavior

**Checkpoint**: `docker compose up -d` starts zoekt-sync; logs show mirror → index → sleep → mirror cycle repeating with timestamps. Search API returns fresh results.

---

## Phase 3: User Story 2 — Configurable Sync Interval (Priority: P2)

**Goal**: Sync interval is controllable via `SYNC_INTERVAL` env var with a 3600s default.

**Independent Test**: Set `SYNC_INTERVAL=60`, `docker compose up -d`, observe logs showing cycles repeating every ~60s plus cycle duration.

### Implementation for User Story 2

- [X] T010 [US2] Add `SYNC_INTERVAL` environment variable with `${SYNC_INTERVAL:-3600}` default to zoekt-sync service in docker/docker-compose.yml
- [X] T011 [US2] Replace hard-coded `sleep 3600` with `sleep $$SYNC_INTERVAL` in zoekt-sync command block in docker/docker-compose.yml
- [X] T012 [US2] Include `$$SYNC_INTERVAL` value in the cycle-complete log message in docker/docker-compose.yml

**Checkpoint**: Starting with `SYNC_INTERVAL=120` produces cycles every ~2 minutes. Omitting the variable defaults to 3600s.

---

## Phase 4: User Story 3 — Resilient to Transient Failures (Priority: P3)

**Goal**: Mirror and index errors are logged but do not crash the container or stop the loop.

**Independent Test**: Rename `github-token.txt` → container logs error but continues looping. Restore token → next cycle succeeds.

### Implementation for User Story 3

- [X] T013 [US3] Ensure mirror command uses `|| true` to suppress non-zero exit in zoekt-sync command block in docker/docker-compose.yml
- [X] T014 [US3] Ensure per-repo index failure uses `|| echo "Failed to index $$repo"` and continues to next repo in docker/docker-compose.yml
- [X] T015 [US3] Verify `restart: unless-stopped` is set on zoekt-sync service in docker/docker-compose.yml

**Checkpoint**: Invalid token → mirror error logged, index still runs on existing clones, container stays running. Single repo failure → other repos still indexed.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and final validation

- [X] T016 [P] Update `zoekt-sync` service section in docker/README.md to document the new service name and behavior
- [X] T017 [P] Update environment variables table in docker/README.md to add `SYNC_INTERVAL` and remove `INDEX_INTERVAL` reference
- [X] T018 [P] Update Operations section (logs, force re-index, troubleshooting) in docker/README.md to reference `zoekt-sync` instead of `zoekt-indexserver`/`zoekt-mirror`
- [X] T019 Run quickstart.md acceptance checklist (manual validation) against running stack

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup completion (T001-T004)
- **User Story 2 (Phase 3)**: Depends on User Story 1 (T005-T009) — modifies the same command block
- **User Story 3 (Phase 4)**: Depends on User Story 1 (T005-T009) — verifies error handling in the same command block
- **Polish (Phase 5)**: README tasks (T016-T018) can start after Phase 1; quickstart validation (T019) depends on all phases

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Setup (Phase 1). Core loop must exist before interval or resilience can be configured.
- **User Story 2 (P2)**: Depends on US1 — replaces the hard-coded sleep value in the loop created by US1.
- **User Story 3 (P3)**: Depends on US1 — verifies error handling patterns in the loop created by US1. Can run in parallel with US2 in theory, but both modify the same command block so sequential is safer.

### Within Each User Story

- Tasks are ordered for sequential application to the same file
- No test tasks — testing is manual per quickstart.md

### Parallel Opportunities

- T016, T017, T018 can run in parallel (different sections of docker/README.md)
- US2 and US3 could theoretically run in parallel (different aspects of the command block), but since they touch the same YAML block, sequential is recommended

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004) — restructure docker-compose.yml
2. Complete Phase 2: User Story 1 (T005-T009) — continuous loop working
3. **STOP and VALIDATE**: `docker compose up -d`, confirm recurring cycles in logs
4. This alone resolves the core issue (#11)

### Incremental Delivery

1. Setup → zoekt-sync skeleton ready
2. User Story 1 → Continuous loop working → **MVP deployed, issue #11 resolved**
3. User Story 2 → Configurable interval → Flexible for different team needs
4. User Story 3 → Error resilience verified → Production-grade reliability
5. Polish → README updated → Documentation matches implementation

---

## Notes

- All user stories modify the same file (`docker/docker-compose.yml`) and largely the same YAML block, so cross-story parallelism is limited
- The `$$` escaping convention is critical — Compose resolves `${}` at parse time; `$$` passes a literal `$` to the shell at runtime
- `date -u '+%Y-%m-%dT%H:%M:%SZ'` must be used instead of `date -Iseconds` (BusyBox compatibility per research.md R5)
- The `docker-compose.prod.yml` and `docker-compose.test.yml` files are NOT modified by this feature
- Total: 19 tasks across 5 phases
