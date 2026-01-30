# Feature Specification: Zoekt MCP Infrastructure

**Feature Branch**: `001-zoekt-mcp-infra`  
**Created**: 2026-01-30  
**Status**: Draft  
**Input**: User description: "Create a Zoekt MCP server in TypeScript that wraps the Zoekt search API, plus Docker infrastructure for running Zoekt indexserver and webserver to index hundreds of private GitHub repositories"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Code Across Repositories (Priority: P1)

As a developer using an AI coding assistant (VS Code Copilot, Claude Desktop, etc.), I want to search across all my organization's private GitHub repositories using natural language or Zoekt query syntax, so that I can find relevant code patterns, implementations, and examples without manually browsing each repository.

**Why this priority**: This is the core value proposition—without search capability, the entire system has no purpose. Everything else depends on having searchable indexes.

**Independent Test**: Can be tested by running `docker-compose up`, waiting for initial indexing to complete, then using an MCP client to execute a search query and verify results are returned from indexed repositories.

**Acceptance Scenarios**:

1. **Given** the Zoekt infrastructure is running and repositories are indexed, **When** a user sends a search query via MCP (e.g., "find authentication middleware"), **Then** the system returns matching code snippets with file paths, line numbers, and repository names.

2. **Given** the Zoekt infrastructure is running, **When** a user searches using Zoekt syntax (e.g., `lang:typescript func.*Handler`), **Then** the system returns results matching the regex pattern filtered by language.

3. **Given** a repository is not yet indexed, **When** a user searches for code in that repository, **Then** the system returns no results for that repository (graceful empty response, not an error).

---

### User Story 2 - Index Private GitHub Repositories (Priority: P1)

As a platform operator, I want to configure which GitHub organizations and repositories to index, so that the search system contains all relevant private codebases without manual intervention.

**Why this priority**: Equal to P1 because search is useless without indexes. The indexing infrastructure must work before search can deliver value.

**Independent Test**: Can be tested by configuring a GitHub token and organization in the config file, starting the Docker infrastructure, and verifying that repositories are cloned and indexes are created in the data volume.

**Acceptance Scenarios**:

1. **Given** a valid GitHub personal access token with repo scope, **When** I configure an organization name in the config file and start the indexer, **Then** all accessible repositories from that organization are cloned and indexed.

2. **Given** multiple GitHub organizations are configured, **When** the indexer runs, **Then** all organizations are processed and their repositories are indexed.

3. **Given** a repository is archived or deleted on GitHub, **When** the indexer runs, **Then** the repository is optionally removed from the index based on configuration.

---

### User Story 3 - Periodic Index Updates (Priority: P2)

As a platform operator, I want the system to automatically re-index repositories on a configurable schedule, so that the search index stays current with code changes without manual intervention.

**Why this priority**: After initial indexing works, keeping indexes fresh is the next critical capability for production use.

**Independent Test**: Can be tested by modifying the sync interval to a short duration, making a commit to a monitored repository, waiting for the next sync cycle, and verifying the new code is searchable.

**Acceptance Scenarios**:

1. **Given** the indexer is running with a 1-hour sync interval, **When** 1 hour elapses, **Then** the indexer fetches new commits and updates affected indexes.

2. **Given** a new repository is added to a monitored organization, **When** the next sync cycle runs, **Then** the new repository is discovered, cloned, and indexed.

---

### User Story 4 - List Indexed Repositories (Priority: P2)

As a developer, I want to see which repositories are currently indexed, so that I know the scope of my search and can verify my repositories are included.

**Why this priority**: Provides visibility and troubleshooting capability, but not blocking for core search functionality.

**Independent Test**: Can be tested by calling the `list_repos` MCP tool and verifying the response contains expected repository names.

**Acceptance Scenarios**:

1. **Given** 50 repositories are indexed, **When** a user calls the `list_repos` tool, **Then** the system returns a list of all 50 repository names.

2. **Given** a filter pattern is provided, **When** a user calls `list_repos` with a filter, **Then** only matching repositories are returned.

---

### User Story 5 - Retrieve File Contents (Priority: P3)

As a developer, I want to retrieve the full contents of a file from an indexed repository, so that I can examine the complete context around a search match.

**Why this priority**: Enhances the search experience but search results already include snippets, so this is a convenience feature.

**Independent Test**: Can be tested by calling the `file_content` MCP tool with a repository name and file path, verifying the complete file contents are returned.

**Acceptance Scenarios**:

1. **Given** a repository is indexed, **When** a user requests file contents for a valid path, **Then** the complete file contents are returned as text.

2. **Given** a file path does not exist, **When** a user requests its contents, **Then** the system returns a clear "file not found" error message.

---

### Edge Cases

- What happens when GitHub API rate limits are exceeded during mirroring?
  → The system logs the error and retries on the next sync cycle; partial progress is preserved.

- What happens when the Zoekt webserver is unavailable but the MCP server receives a request?
  → The MCP server returns a clear error message indicating the search backend is unavailable.

- What happens when a repository is too large to index within resource limits?
  → The system logs a warning and continues with other repositories; operators can exclude large repos via config.

- What happens when the GitHub token is revoked or expired?
  → The indexer fails with a clear authentication error; search continues to work on existing indexes.

## Requirements *(mandatory)*

### Functional Requirements

#### MCP Server

- **FR-001**: MCP server MUST expose a `search` tool that accepts Zoekt query syntax and returns matching code snippets
- **FR-002**: MCP server MUST expose a `list_repos` tool that returns all indexed repository names
- **FR-003**: MCP server MUST expose a `file_content` tool that retrieves full file contents from a repository
- **FR-004**: MCP server MUST support both stdio and HTTP transport modes for client compatibility
- **FR-005**: MCP server MUST return structured error messages when Zoekt backend is unavailable
- **FR-006**: MCP server MUST log all requests with query, duration, and result count

#### Docker Infrastructure

- **FR-007**: Docker Compose MUST define services for zoekt-indexserver, zoekt-webserver, and shared data volume
- **FR-008**: Configuration MUST support multiple GitHub organizations via a JSON config file
- **FR-009**: GitHub authentication MUST use personal access tokens stored in files (not environment variables for security)
- **FR-010**: Index data MUST persist in a named volume to survive container restarts
- **FR-011**: Webserver MUST expose the search API on a configurable port (default: 6070)
- **FR-012**: Indexer MUST support configurable sync intervals (minimum: 15 minutes)
- **FR-013**: Indexer MUST support filtering repositories by topic, visibility, and exclusion patterns

#### Operational

- **FR-014**: System MUST provide health check endpoints for both indexer and webserver
- **FR-015**: System MUST log all indexing operations with repository name, duration, and outcome
- **FR-016**: System MUST gracefully shut down when receiving SIGTERM

### Key Entities

- **Repository**: A GitHub repository to be indexed; identified by owner/name, has branches, contains files
- **Index**: A Zoekt search index built from repository files; stored on disk, queryable via API
- **Search Result**: A match returned by Zoekt; includes file path, line numbers, match context, repository name
- **Configuration**: Settings for which organizations to index, authentication, sync schedule, exclusion rules

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can execute a search query and receive results within 2 seconds for indexes up to 100 repositories
- **SC-002**: Initial indexing of 100 repositories completes within 2 hours (depending on repository sizes)
- **SC-003**: Incremental index updates (no new repos, only git pulls) complete within 30 minutes for 100 repositories
- **SC-004**: MCP server responds to 100 concurrent search requests without errors or significant latency increase
- **SC-005**: System successfully indexes at least 95% of configured repositories (accounting for occasional API failures)
- **SC-006**: Search results include accurate file paths, line numbers, and code context that match the actual repository state

## Assumptions

- Users have GitHub personal access tokens with appropriate repo access scope
- Docker and Docker Compose are available in the deployment environment
- Sufficient disk space is available for repository clones and indexes (estimate: 2-3x repository size)
- Network connectivity to GitHub API is available from the indexing environment
- MCP clients (VS Code Copilot, Claude Desktop) support stdio or HTTP transport
