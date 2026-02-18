# Feature Specification: Working Tree Indexing & Multi-Org Support

**Feature Branch**: `008-workingtree-multi-org`  
**Created**: 2026-02-18  
**Status**: Draft  
**Input**: User description: "Support working tree indexing for local directories, fix null-safety bugs for branch data, make branch parameter optional, and support multiple GitHub organizations for mirroring"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Local Working Tree (Priority: P1)

A developer wants to search code in their local working tree (a directory on disk) without configuring GitHub organization mirroring. They point the Docker infrastructure at a local directory, and Zoekt indexes all files in that directory—respecting `.gitignore` rules—so the developer can immediately use their AI assistant to search across the local codebase.

**Why this priority**: This is the highest-value feature because it eliminates the GitHub mirroring prerequisite entirely, making the tool usable for local/private codebases, monorepos, and offline development. A community fork already demonstrates demand for this capability.

**Independent Test**: Can be fully tested by starting the Docker infrastructure with a `WORKSPACE_ROOT` pointing to a local directory, then querying the MCP server for file content and search results from that directory.

**Acceptance Scenarios**:

1. **Given** a local directory containing source code, **When** the user configures `WORKSPACE_ROOT` and starts the Docker infrastructure in working-tree mode, **Then** Zoekt indexes all files in that directory and they become searchable via the MCP server.
2. **Given** a working-tree index with files present, **When** the user searches for a string that exists in a local file, **Then** the search returns results with correct file paths and content.
3. **Given** a local directory with a `.gitignore` file, **When** indexing occurs, **Then** files matching `.gitignore` patterns (e.g., `node_modules/`, `dist/`, `build/`) are excluded from the index.
4. **Given** working-tree mode is active, **When** the user requests file content for a path that exists on disk, **Then** the system returns the current on-disk content (not a stale indexed copy).
5. **Given** working-tree mode is active, **When** a file is modified on disk and the next sync cycle completes, **Then** the updated content becomes searchable within the configured sync interval.

---

### User Story 2 - Null-Safe Branch Handling (Priority: P1)

When repositories are indexed from a working tree (rather than a git mirror), search results and repository listings may not contain branch information. The system must gracefully handle missing or null branch data without crashing, so that all existing MCP tools continue to work regardless of index source.

**Why this priority**: This is a P1 because without it, the server crashes with runtime errors when processing working-tree search results. It blocks working-tree indexing from being usable at all, and also hardens the server against unexpected data from any Zoekt backend.

**Independent Test**: Can be tested by sending search/list requests to the MCP server against an index that contains files without branch metadata, and verifying no errors occur.

**Acceptance Scenarios**:

1. **Given** a repository in the index with no branch information, **When** the user lists repositories, **Then** the repository is listed without error and the branch section is simply omitted.
2. **Given** a search result where `Branches` is null or undefined, **When** results are formatted, **Then** the system displays "HEAD" as a fallback without throwing an error.
3. **Given** a file content request with no branch specified, **When** the request is processed, **Then** the system omits the branch parameter from the Zoekt API call (rather than sending "HEAD"), allowing the backend to serve the appropriate content.
4. **Given** a find-references result where `Ranges` is null or undefined on a chunk match, **When** results are formatted, **Then** the system falls back to the chunk's `ContentStart` position without error.

---

### User Story 3 - Mirror Multiple GitHub Organizations (Priority: P2)

An organization uses multiple GitHub orgs (e.g., a primary org and an open-source org, or multiple team-level orgs). The user wants to index repositories from all of them in a single Zoekt instance so they can search across organizational boundaries with one query.

**Why this priority**: Many enterprises have multiple GitHub organizations. Currently the Docker setup only supports a single `GITHUB_ORG` environment variable, forcing users to run multiple Zoekt stacks or pick one org. Supporting multiple orgs is a natural extension that broadens the user base significantly.

**Independent Test**: Can be tested by configuring two or more organization names, running the sync service, and verifying repositories from all configured organizations appear in the index and are searchable.

**Acceptance Scenarios**:

1. **Given** the user configures multiple GitHub organizations (e.g., `GITHUB_ORGS=org-a,org-b`), **When** the sync service runs, **Then** repositories from both `org-a` and `org-b` are mirrored and indexed.
2. **Given** multiple orgs are configured, **When** the user searches for code, **Then** results from all configured organizations are returned in a single result set.
3. **Given** the user configures only a single organization (backward compatibility), **When** the sync service runs, **Then** the behavior is identical to today's single-org setup.
4. **Given** one of the configured organizations does not exist or the token lacks access, **When** the sync cycle runs, **Then** the system logs a warning for that org and continues indexing the remaining organizations without interruption.

---

### User Story 4 - Dual-Mode Deployment (Priority: P3)

A team wants to run Zoekt in both modes simultaneously: indexing their local working tree for fast iteration on a current project, while also mirroring their GitHub organization for cross-repo search. The Docker infrastructure should support choosing one or both modes.

**Why this priority**: This is a natural evolution once both modes exist, but either mode alone delivers standalone value. This story ensures the modes compose cleanly.

**Independent Test**: Can be tested by starting the Docker infrastructure with both working-tree and GitHub-org configuration active, then searching and verifying results include both local files and remote repositories.

**Acceptance Scenarios**:

1. **Given** both `WORKSPACE_ROOT` and `GITHUB_ORGS` are configured, **When** the infrastructure starts, **Then** both indexing modes run and results from local files and mirrored repos are searchable.
2. **Given** only `WORKSPACE_ROOT` is configured (no GitHub token or orgs), **When** the infrastructure starts, **Then** only working-tree indexing runs without errors.
3. **Given** only `GITHUB_ORGS` is configured (no workspace root), **When** the infrastructure starts, **Then** only GitHub mirroring runs (backward-compatible behavior).

---

### Edge Cases

- What happens when `WORKSPACE_ROOT` points to a non-existent directory? The system should log a clear error message and fail to start the indexer service.
- What happens when a `.gitignore` file is malformed? The system should log a warning and continue indexing without gitignore filtering.
- What happens when the same repository exists both in the working tree and in a mirrored GitHub org? Both should appear in search results, distinguished by their repository name/source.
- What happens when `GITHUB_ORGS` contains whitespace around org names (e.g., `"org-a, org-b"`)? The system should trim whitespace and process each org correctly.
- What happens when `GITHUB_ORGS` contains duplicate org names? The system should deduplicate and mirror each org only once.
- What happens when the working tree sync interval is very short (e.g., 10s) and the directory is very large? The system should handle overlapping index cycles gracefully (skip if previous cycle is still running, or queue).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a "working tree" indexing mode that indexes a local directory on disk, configurable via a `WORKSPACE_ROOT` environment variable.
- **FR-002**: System MUST respect `.gitignore` files when indexing a working tree, excluding matched files and directories from the index.
- **FR-003**: System MUST exclude common build/dependency directories (`node_modules`, `dist`, `build`, `vendor`, `.git`, `.hg`, `.svn`) from working-tree indexing by default.
- **FR-004**: System MUST serve file content directly from disk when in working-tree mode, so users always see the latest file contents.
- **FR-005**: System MUST re-index the working tree periodically, with a configurable sync interval (default: 60 seconds for working tree).
- **FR-006**: System MUST support configuring multiple GitHub organizations for mirroring, via a comma-separated `GITHUB_ORGS` environment variable.
- **FR-007**: System MUST remain backward-compatible with the existing single `GITHUB_ORG` environment variable; if only `GITHUB_ORG` is set, the system behaves as before.
- **FR-008**: System MUST handle null or missing branch data in search results, repository listings, and file content responses without errors.
- **FR-009**: System MUST make the `branch` parameter optional for file content requests; when omitted, the Zoekt backend determines the appropriate source (working tree or HEAD).
- **FR-010**: System MUST handle null or missing `Branches` arrays on file matches by using safe access patterns and falling back to "HEAD" for display.
- **FR-011**: System MUST handle null or missing `Ranges` arrays on chunk matches by falling back to the chunk's `ContentStart` position.
- **FR-012**: System MUST allow running both working-tree and GitHub-org indexing simultaneously if both are configured.
- **FR-013**: System MUST log warnings (not crash) when a configured GitHub organization is inaccessible or does not exist, and continue processing remaining organizations.
- **FR-014**: System MUST trim whitespace and deduplicate organization names from the `GITHUB_ORGS` variable.

### Key Entities

- **Working Tree**: A local directory on disk containing source code to be indexed. Identified by its filesystem path. Has no branch concept—files are indexed as-is.
- **GitHub Organization**: A named GitHub org whose public/private repositories are mirrored and indexed. Identified by org name. Requires a GitHub token for access.
- **Index Source**: Represents where indexed content came from—either a working tree path or a GitHub org mirror. Determines how file content is served (disk vs. index).
- **Sync Cycle**: A periodic process that mirrors/re-indexes content from a source. Has a configurable interval. Working tree and GitHub org sources may have different default intervals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can search local working tree files within 2 minutes of initial setup (start Docker, set `WORKSPACE_ROOT`, run a search).
- **SC-002**: All existing MCP tools (search, search_symbols, search_files, find_references, list_repos, file_content, get_health) work without errors against working-tree-indexed content.
- **SC-003**: Users can configure and index repositories from 2+ GitHub organizations in a single deployment.
- **SC-004**: File content served from a working tree reflects on-disk changes within one sync interval (default 60 seconds).
- **SC-005**: Backward compatibility is preserved: existing single-org deployments continue to work without configuration changes.
- **SC-006**: No runtime crashes occur when processing search results or repository listings that lack branch metadata.

## Assumptions

- The Zoekt `zoekt-index` binary supports (or will be extended to support) a `-gitignore` flag for `.gitignore` filtering. The community fork demonstrates this is feasible with the `go-git` library.
- The Zoekt `zoekt-webserver` supports (or will be extended to support) a `-working-tree` flag to serve files directly from disk. The community fork demonstrates a working implementation.
- The zoekt submodule may need to be updated or forked to include working-tree support. The existing community fork at `vichitra-studio/working-tree-zoekt` provides a reference implementation.
- Working-tree indexing uses `zoekt-index` (filesystem indexer) rather than `zoekt-git-index` (git repo indexer), as the target directory may not be a git repository.
- The default sync interval for working-tree mode is shorter (60 seconds) than for GitHub mirroring (3600 seconds), since local file changes are expected to be more frequent.
- Docker Compose profiles or conditional service definitions will be used to support the dual-mode deployment without requiring users to edit compose files.
