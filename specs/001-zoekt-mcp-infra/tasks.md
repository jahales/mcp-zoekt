# Tasks: Zoekt MCP Infrastructure

**Input**: Design documents from `/specs/001-zoekt-mcp-infra/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: No tests explicitly requested in specification. Test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for both MCP server and Docker infrastructure

- [x] T001 Create MCP server project structure at zoekt-mcp/ per plan.md
- [x] T002 Initialize TypeScript project with package.json, tsconfig.json in zoekt-mcp/
- [x] T003 [P] Install dependencies: @modelcontextprotocol/sdk, zod, pino in zoekt-mcp/
- [x] T004 [P] Configure ESLint and TypeScript strict mode in zoekt-mcp/
- [x] T005 [P] Create Docker infrastructure directory structure at docker/
- [x] T006 [P] Create .gitignore entries for docker/config/github-token.txt

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Implement MCP server configuration handling in zoekt-mcp/src/config.ts
- [x] T008 [P] Implement Pino logger setup with debug flag support in zoekt-mcp/src/logger.ts
- [x] T009 [P] Define Zoekt API types matching data-model.md in zoekt-mcp/src/zoekt/types.ts
- [x] T010 Implement Zoekt HTTP client with error handling in zoekt-mcp/src/zoekt/client.ts
- [x] T011 Implement MCP server setup with tool registration framework in zoekt-mcp/src/server.ts
- [x] T012 Implement CLI entrypoint with argument parsing in zoekt-mcp/src/index.ts
- [x] T013 Create docker-compose.yml with zoekt-webserver, zoekt-indexserver, and zoekt-data volume in docker/docker-compose.yml
- [x] T014 [P] Create mirror-config.json template in docker/config/mirror-config.json
- [x] T015 [P] Create Docker infrastructure README with setup instructions in docker/README.md

**Checkpoint**: Foundation ready - MCP server can start, Docker infrastructure can run, Zoekt client can connect

---

## Phase 3: User Story 1 - Search Code Across Repositories (Priority: P1) 🎯 MVP

**Goal**: Enable AI agents to search code across indexed repositories using Zoekt query syntax

**Independent Test**: Start Docker infrastructure, wait for indexing, use MCP Inspector to call `search` tool with query, verify results returned

### Implementation for User Story 1

- [x] T016 [US1] Define search tool input schema (Zod) matching contracts/mcp-tools.md in zoekt-mcp/src/tools/search.ts
- [x] T017 [US1] Implement Zoekt search API call with query parameters in zoekt-mcp/src/zoekt/client.ts
- [x] T018 [US1] Implement search result formatting as readable text per contracts/mcp-tools.md in zoekt-mcp/src/tools/search.ts
- [x] T019 [US1] Register search tool with MCP server in zoekt-mcp/src/server.ts
- [x] T020 [US1] Add error handling for backend unavailable, query syntax errors, timeouts in zoekt-mcp/src/tools/search.ts
- [x] T021 [US1] Add request logging with query, duration, result count in zoekt-mcp/src/tools/search.ts

**Checkpoint**: Search tool is functional - can execute queries and receive formatted results

---

## Phase 4: User Story 2 - Index Private GitHub Repositories (Priority: P1) 🎯 MVP

**Goal**: Platform operators can configure GitHub organizations and have repositories automatically indexed

**Independent Test**: Configure GitHub token and org in docker/config/, start Docker infrastructure, verify repos are cloned and indexes created in zoekt-data volume

### Implementation for User Story 2

- [x] T022 [US2] Document mirror-config.json format with all options (GithubOrg, NoArchived, Forks, Topics, Exclude) in docker/README.md
- [x] T023 [US2] Add multi-organization configuration example in docker/config/mirror-config.json
- [x] T024 [US2] Document GitHub PAT requirements and scope in docker/README.md
- [x] T025 [US2] Add container health checks to docker-compose.yml in docker/docker-compose.yml
- [x] T026 [US2] Document index verification commands in docker/README.md

**Checkpoint**: Docker infrastructure indexes repositories from configured GitHub organizations

---

## Phase 5: User Story 3 - Periodic Index Updates (Priority: P2)

**Goal**: System automatically re-indexes repositories on a configurable schedule

**Independent Test**: Set short sync interval, make commit to monitored repo, wait for sync, verify new code is searchable

### Implementation for User Story 3

- [x] T027 [US3] Document INDEX_INTERVAL environment variable and sync behavior in docker/README.md
- [x] T028 [US3] Add configurable sync interval to docker-compose.yml in docker/docker-compose.yml
- [x] T029 [US3] Document how to monitor indexing progress with container logs in docker/README.md
- [x] T030 [US3] Document incremental update behavior vs full re-index in docker/README.md

**Checkpoint**: Indexes automatically update on schedule without manual intervention

---

## Phase 6: User Story 4 - List Indexed Repositories (Priority: P2)

**Goal**: Developers can see which repositories are indexed to verify scope and troubleshoot

**Independent Test**: Call `list_repos` MCP tool, verify response contains expected repository names

### Implementation for User Story 4

- [x] T031 [P] [US4] Define list_repos tool input schema (Zod) matching contracts/mcp-tools.md in zoekt-mcp/src/tools/list-repos.ts
- [x] T032 [US4] Implement Zoekt list repos API call in zoekt-mcp/src/zoekt/client.ts
- [x] T033 [US4] Implement repository list formatting with counts per contracts/mcp-tools.md in zoekt-mcp/src/tools/list-repos.ts
- [x] T034 [US4] Register list_repos tool with MCP server in zoekt-mcp/src/server.ts
- [x] T035 [US4] Add filter pattern support for repository name matching in zoekt-mcp/src/tools/list-repos.ts
- [x] T036 [US4] Add error handling for backend unavailable, no repositories in zoekt-mcp/src/tools/list-repos.ts

**Checkpoint**: list_repos tool returns indexed repository names with optional filtering

---

## Phase 7: User Story 5 - Retrieve File Contents (Priority: P3)

**Goal**: Developers can retrieve full file contents from indexed repositories for complete context

**Independent Test**: Call `file_content` MCP tool with repository and path, verify complete file contents returned

### Implementation for User Story 5

- [x] T037 [P] [US5] Define file_content tool input schema (Zod) matching contracts/mcp-tools.md in zoekt-mcp/src/tools/file-content.ts
- [x] T038 [US5] Implement Zoekt /print endpoint call in zoekt-mcp/src/zoekt/client.ts
- [x] T039 [US5] Implement file content formatting with language detection in zoekt-mcp/src/tools/file-content.ts
- [x] T040 [US5] Register file_content tool with MCP server in zoekt-mcp/src/server.ts
- [x] T041 [US5] Add error handling for file not found, repository not found in zoekt-mcp/src/tools/file-content.ts

**Checkpoint**: file_content tool retrieves and returns complete file contents

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T042 [P] Create MCP server README with usage and configuration in zoekt-mcp/README.md
- [x] T043 [P] Add npm build script and verify TypeScript compilation in zoekt-mcp/package.json
- [x] T044 Add graceful shutdown handling for SIGTERM in zoekt-mcp/src/index.ts
- [x] T045 [P] Run quickstart.md validation - verify 5-minute setup works end-to-end
- [x] T046 [P] Add example VS Code and Claude Desktop configurations to zoekt-mcp/README.md
- [x] T047 Verify all tools work with MCP Inspector

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Search) and US2 (Index) are both P1 and can proceed in parallel
  - US3 (Periodic Updates) depends on US2 being testable
  - US4 (List Repos) and US5 (File Content) can proceed independently
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Notes |
|-------|----------|------------|-------|
| US1 - Search | P1 | Foundational | Core MCP tool |
| US2 - Index | P1 | Foundational | Docker infrastructure only |
| US3 - Periodic Updates | P2 | US2 | Extends Docker config |
| US4 - List Repos | P2 | Foundational | Independent MCP tool |
| US5 - File Content | P3 | Foundational | Independent MCP tool |

### Within Each User Story

- Schema definition before implementation
- Zoekt client methods before tool handlers
- Core implementation before error handling
- Tool registration after implementation complete

### Parallel Opportunities

**Phase 1 - Setup**:
```
T003 + T004 + T005 + T006 (all [P] - different files)
```

**Phase 2 - Foundational**:
```
T008 + T009 + T014 + T015 (all [P] - different files)
```

**Phase 3+4 - User Stories 1 & 2** (both P1, can work in parallel):
```
Developer A: T016 → T017 → T018 → T019 → T020 → T021 (MCP search tool)
Developer B: T022 → T023 → T024 → T025 → T026 (Docker infrastructure)
```

**Phase 6+7 - User Stories 4 & 5** (independent, can work in parallel):
```
Developer A: T031 → T032 → T033 → T034 → T035 → T036 (list_repos)
Developer B: T037 → T038 → T039 → T040 → T041 (file_content)
```

**Phase 8 - Polish**:
```
T042 + T043 + T045 + T046 (all [P] - different files)
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 - Search
4. Complete Phase 4: User Story 2 - Index
5. **STOP and VALIDATE**: Test search against indexed repos
6. Deploy/demo if ready - this is the core product!

### Incremental Delivery

| Increment | User Stories | Value Delivered |
|-----------|--------------|-----------------|
| MVP | US1 + US2 | Search across indexed GitHub repos |
| +1 | US3 | Automatic index freshness |
| +2 | US4 | Visibility into indexed repos |
| +3 | US5 | Full file retrieval |

### Single Developer Strategy

1. Phase 1: Setup (~30 min)
2. Phase 2: Foundational (~2 hours)
3. Phase 3: US1 Search (~2 hours)
4. Phase 4: US2 Index (~1 hour)
5. **MVP CHECKPOINT** - Test end-to-end
6. Phase 5: US3 Updates (~30 min)
7. Phase 6: US4 List Repos (~1 hour)
8. Phase 7: US5 File Content (~1 hour)
9. Phase 8: Polish (~1 hour)

**Estimated Total**: ~9 hours for complete implementation

---

## Notes

- All MCP tools must follow contracts/mcp-tools.md schemas exactly
- Docker infrastructure must match contracts/docker-infra.md specifications
- Error handling must follow Constitution Principle IV (explicit, actionable feedback)
- Logging must follow Constitution Principle V (Pino JSON, request logging)
- Minimal dependencies per Constitution Principle III (only SDK, Zod, Pino)
