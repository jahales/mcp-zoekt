# Feature Specification: Continuous Reindex for Docker Compose

**Feature Branch**: `006-continuous-reindex`  
**Created**: 2026-02-13  
**Status**: Draft  
**Input**: User description: "docker compose: mirror/index run once then go stale — add continuous reindex loops"  
**Related Issue**: [jahales/mcp-zoekt#11](https://github.com/jahales/mcp-zoekt/issues/11)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Repositories Stay Fresh Without Manual Intervention (Priority: P1)

As a developer running the Zoekt stack locally via `docker compose`, I want repository mirroring and indexing to repeat automatically on an interval so that new commits and newly added repositories appear in search results without restarting containers.

**Why this priority**: This is the core problem — the current one-shot behaviour renders the search index stale after the initial startup, defeating the purpose of a live code-search service.

**Independent Test**: Start the docker compose stack, push a new commit to a mirrored repository, wait for one sync cycle, and verify the new commit appears in search results.

**Acceptance Scenarios**:

1. **Given** the docker compose stack is running and one full mirror+index cycle has completed, **When** a new commit is pushed to a mirrored repository, **Then** the commit content appears in Zoekt search results after the next sync cycle completes without any manual action.
2. **Given** the docker compose stack is running, **When** a new repository is added to the GitHub organization, **Then** the repository is cloned and indexed automatically within the next mirror+index cycle.
3. **Given** the docker compose stack has been running for longer than the configured sync interval, **When** a user queries the search API, **Then** results reflect all changes up to at most one sync-interval ago.

---

### User Story 2 - Configurable Sync Interval (Priority: P2)

As a developer, I want to control how frequently mirroring and indexing occur so that I can balance freshness against resource usage on my machine.

**Why this priority**: Different teams have different freshness needs; a configurable interval avoids hard-coding a value that is too aggressive for large org mirrors or too slow for active development.

**Independent Test**: Set the sync interval environment variable to a short value (e.g., 60 seconds), start the stack, and confirm that mirroring and indexing repeat at approximately that cadence by observing container logs.

**Acceptance Scenarios**:

1. **Given** the user sets a sync-interval environment variable, **When** the stack starts, **Then** mirroring and indexing repeat at approximately that interval.
2. **Given** no sync-interval environment variable is set, **When** the stack starts, **Then** a sensible default interval is used (e.g., 3600 seconds / 1 hour).

---

### User Story 3 - Resilient to Transient Failures (Priority: P3)

As a developer, I want the mirror and index loops to survive transient failures (network timeouts, GitHub API rate limits) so that the stack self-heals on the next cycle rather than crashing.

**Why this priority**: Long-running loops inevitably encounter transient errors; the service must keep running and retry on the next pass.

**Independent Test**: Temporarily revoke or invalidate the GitHub token, observe that the mirror container logs an error but doesn't exit, restore the token, and verify that the next cycle succeeds.

**Acceptance Scenarios**:

1. **Given** the mirror or index process encounters a transient error (e.g., network timeout), **When** the current cycle completes, **Then** the container remains running and retries on the next scheduled cycle.
2. **Given** a single repository fails to index, **When** the index loop runs, **Then** the remaining repositories are still indexed and the failure is logged.

---

### Edge Cases

- What happens when the mirror process takes longer than the configured sync interval? The next cycle should begin only after the current one finishes (sequential, not overlapping).
- What happens when no repositories exist in the organization? The loop should complete without error and retry on the next cycle.
- What happens when the data volume runs out of disk space? The error should be logged and the loop should continue; the operator is responsible for provisioning sufficient storage.
- What happens when the container is stopped mid-cycle? On restart, the next full cycle should run from the beginning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The mirroring container MUST repeat the mirror operation on a recurring interval rather than running once and exiting.
- **FR-002**: The indexing container MUST repeat the index operation on a recurring interval rather than indexing once and sleeping forever.
- **FR-003**: Each sync cycle MUST run to completion before the next interval timer begins (no overlapping cycles).
- **FR-004**: A transient failure in the mirror or index process MUST NOT cause the container to exit; the error MUST be logged and the next cycle MUST proceed.
- **FR-005**: The sync interval MUST be configurable via environment variables with sensible defaults.
- **FR-006**: The mirroring container MUST use a `restart: unless-stopped` policy so that it recovers from unexpected crashes.
- **FR-007**: Each cycle MUST log a timestamped start and completion message so operators can confirm the service is alive and track cycle times.
- **FR-008**: A failure to index one repository MUST NOT prevent indexing of remaining repositories in the same cycle.

### Key Entities

- **Mirror Cycle**: A single pass of cloning/updating all repositories from the configured GitHub organization. Runs inside the mirror container.
- **Index Cycle**: A single pass of indexing all cloned repository directories. Runs inside the indexserver container.
- **Sync Interval**: The configurable pause between the end of one cycle and the start of the next. Expressed in seconds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After pushing a new commit to a mirrored repository, the commit content is searchable within two sync intervals without manual intervention.
- **SC-002**: The docker compose stack runs continuously for 24+ hours without the mirror or index containers exiting unexpectedly.
- **SC-003**: Operators can determine the time of the last successful sync cycle from container logs within 30 seconds.
- **SC-004**: Changing the sync interval environment variable and restarting the stack results in cycles running at the new cadence within one interval.

## Assumptions

- The `docker/docker-compose.yml` file is the target — not `docker-compose.prod.yml` or `docker-compose.test.yml`, which may already have their own scheduling mechanisms.
- The `zoekt:local` image already contains the `zoekt-mirror-github` and `zoekt-git-index` binaries and a POSIX shell.
- The GitHub token mounted at `/config/github-token.txt` remains valid for the lifetime of the container; token rotation is out of scope.
- A default sync interval of 3600 seconds (1 hour) is appropriate for typical local development use.
