# Feature Specification: Zoekt List API Migration

**Feature Branch**: `005-zoekt-list-api`  
**Created**: 2026-02-06  
**Status**: Draft  
**Input**: User description: "Research the Zoekt server and confirm how we should design our MCP API. Plan changes to make list_repos and getStats more robust by using Zoekt's purpose-built /api/list endpoint instead of abusing /api/search with type:repo queries."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate Repository Listing at Scale (Priority: P1)

An LLM or human user invokes the `list_repos` tool and receives a complete, accurate list of all indexed repositories, regardless of how many repositories are indexed or how large individual repositories are.

**Why this priority**: This is the core bug. Currently `list_repos` returns only 5-7 repos when ~1100 are indexed because it extracts repository names from `FileMatches` which are capped by `MaxDocDisplayCount`. Without accurate repo listing, users cannot discover what code is available to search.

**Independent Test**: Invoke `list_repos` with no filter against an index containing 100+ repositories. Verify every indexed repository appears in the result. Compare result count against the Zoekt backend's actual repository count.

**Acceptance Scenarios**:

1. **Given** a Zoekt backend with 1104 indexed repositories, **When** the user calls `list_repos` with no filter, **Then** the response contains all 1104 repositories.
2. **Given** a Zoekt backend with 1104 indexed repositories, **When** the user calls `list_repos` with filter `my-org`, **Then** only repositories whose name matches the filter are returned, and none are omitted.
3. **Given** a Zoekt backend with zero indexed repositories, **When** the user calls `list_repos`, **Then** the response clearly indicates no repositories are indexed.

---

### User Story 2 - Accurate Health Statistics (Priority: P1)

The `get_health` tool reports correct aggregate index statistics: total repository count, total document (file) count, total index size, and total content size.

**Why this priority**: Tied with Story 1 since it shares the same root cause bug. Currently `get_health` reports 7 repositories instead of 1104. Additionally, it reports search I/O counters (`IndexBytesLoaded`, `ContentBytesLoaded`) as total index size — these are per-query byte-read counters, not the actual index size.

**Independent Test**: Invoke `get_health` and compare the reported repository count, document count, index bytes, and content bytes against the values returned by directly querying Zoekt's `/api/list` endpoint.

**Acceptance Scenarios**:

1. **Given** a healthy Zoekt backend with 1104 repos and 500,000 documents, **When** the user calls `get_health`, **Then** the response shows exactly 1104 repositories and 500,000 documents.
2. **Given** a healthy Zoekt backend, **When** the user calls `get_health`, **Then** the reported `indexBytes` and `contentBytes` match the actual total index and content sizes (from `RepoStats`), not search I/O counters.
3. **Given** an unreachable Zoekt backend, **When** the user calls `get_health`, **Then** the response shows status "unhealthy" with a meaningful error message (existing behavior preserved).

---

### User Story 3 - Enriched Repository Metadata (Priority: P2)

The `list_repos` tool returns richer per-repository metadata beyond just name and branch names, so LLM consumers can make informed decisions about which repos to search and what tools to use.

**Why this priority**: This is a quality-of-life improvement enabled by the API migration. The Zoekt `/api/list` endpoint provides per-repo metadata (branch SHAs, document counts, symbol availability, index freshness) that is currently discarded. Exposing it makes the MCP server significantly more useful for LLM consumers, but the system is functional without it.

**Independent Test**: Invoke `list_repos` and verify the output includes branch commit SHAs, document counts, symbol availability flag, and index freshness indicators for each repository.

**Acceptance Scenarios**:

1. **Given** a Zoekt backend with repositories that have ctags symbol indexing, **When** the user calls `list_repos`, **Then** each repository entry indicates whether symbol search is available for that repo.
2. **Given** a Zoekt backend with multiple indexed branches per repo, **When** the user calls `list_repos`, **Then** each branch includes its commit SHA so users know which revision is indexed.
3. **Given** a Zoekt backend, **When** the user calls `list_repos`, **Then** each repository includes its document count and content size, so users can gauge repo size.
4. **Given** a Zoekt backend, **When** the user calls `list_repos`, **Then** each repository includes its index timestamp, so users can assess data freshness.

---

### User Story 4 - Shard Count in Health Stats (Priority: P3)

The `get_health` tool includes the total shard count in its statistics output, providing operators with additional operational insight.

**Why this priority**: Minor enhancement — shard count is freely available from the `/api/list` aggregate stats and useful for operational monitoring, but not critical to correctness.

**Independent Test**: Invoke `get_health` and verify the statistics section includes a shard count that matches the Zoekt backend's actual shard count.

**Acceptance Scenarios**:

1. **Given** a healthy Zoekt backend, **When** the user calls `get_health`, **Then** the statistics table includes a "Shards" row with the correct total shard count.

---

### Edge Cases

- What happens when the Zoekt backend returns an empty `Repos` array (no repositories indexed)? Expected: `list_repos` returns an empty list with a clear message; `get_health` reports 0 repositories.
- How does the system handle a Zoekt backend that is reachable but returns a malformed `/api/list` response? Expected: graceful error with "QUERY_ERROR" code.
- What happens when a repository has no branches (`Branches` is null in the Zoekt response)? Expected: the repository is still listed, with branches shown as empty or defaulting to `["HEAD"]`.
- How does filtering behave when the filter pattern is an invalid regex? Expected: clear error message indicating the filter pattern is invalid, rather than an unhandled exception.
- What happens when the Zoekt backend times out during the `/api/list` call? Expected: timeout error with the existing "TIMEOUT" code and a user-friendly message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `listRepos()` client method MUST call the Zoekt `POST /api/list` endpoint instead of `POST /api/search` with `type:repo`.
- **FR-002**: The `listRepos()` method MUST return all repositories matching the filter, with no artificial cap on result count.
- **FR-003**: The `listRepos()` method MUST extract repository data from `RepoList.Repos[].Repository` and `RepoList.Repos[].Stats` (not from `FileMatches`).
- **FR-004**: The `getStats()` client method MUST derive aggregate statistics from `RepoList.Stats` returned by `POST /api/list`, not from search I/O counters.
- **FR-005**: The `getStats()` method MUST report the correct `repositoryCount` using `RepoList.Stats.Repos`, the correct `documentCount` using `RepoList.Stats.Documents`, and the correct index/content byte sizes using `RepoList.Stats.IndexBytes` and `RepoList.Stats.ContentBytes`.
- **FR-006**: Each repository returned by `list_repos` MUST include: name, branches (with commit SHAs), document count, content size, whether symbol search is available, and the index timestamp.
- **FR-007**: The `list_repos` tool MUST continue to support optional name-based filtering via regex pattern applied to repository names.
- **FR-008**: The `IndexStats` type MUST include a `shardCount` field populated from `RepoList.Stats.Shards`.
- **FR-009**: The `list_repos` tool output MUST remain readable as markdown, with the enriched metadata presented in a scannable format.
- **FR-010**: All existing error handling behavior (timeout, backend unreachable, query error) MUST be preserved for both `listRepos()` and `getStats()`.
- **FR-011**: Invalid regex filter patterns passed to `list_repos` MUST produce a clear error message rather than crashing.

### Key Entities

- **Repository**: Represents an indexed code repository. Key attributes: name, URL, branches (name + commit SHA), document count, content size, symbol availability, index time, latest commit date.
- **IndexStats**: Aggregate statistics across all indexed repositories. Key attributes: repository count, document count, index bytes, content bytes, shard count.
- **Branch**: A named reference within a repository. Key attributes: branch name, commit SHA (version).

## Assumptions

- The Zoekt backend version in use supports the `POST /api/list` endpoint. This endpoint has been part of the Zoekt JSON API since the initial implementation and is present in the codebase being deployed.
- The default `ListOptions.Field` value of `0` (`RepoListFieldRepos`) is appropriate — full metadata is needed, not the minimal `ReposMap` variant.
- Client-side regex filtering of repository names (currently applied after fetching results) is acceptable. The Zoekt `/api/list` endpoint accepts a query that can filter by `repo:` atom server-side, but client-side filtering maintains backward compatibility with the existing `filter` parameter behavior.
- URL templates (FileURLTemplate, LineFragmentTemplate, CommitURLTemplate) are not exposed in this iteration. They are available in the response but are better suited for a future feature that generates clickable source links in tool output.
- The `LanguageMap` from `IndexMetadata` is not exposed in this iteration. While useful for suggesting `lang:` filters, it adds complexity to the output format and can be added later.
- Performance impact of calling `/api/list` instead of `/api/search` is neutral or positive — `/api/list` is a metadata-only operation that does not perform content search.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `list_repos` returns the correct total number of repositories for any index size (verified against Zoekt backend directly), with zero repositories missing.
- **SC-002**: `get_health` reports repository count, document count, index bytes, and content bytes that exactly match the Zoekt backend's aggregate statistics.
- **SC-003**: `list_repos` response time does not regress — listing 1000+ repositories completes within the existing timeout period.
- **SC-004**: All existing unit tests continue to pass after updating mocks to reflect the new API call shape.
- **SC-005**: Each repository in `list_repos` output includes at minimum: name, branches with SHAs, document count, symbol availability indicator, and index timestamp.
- **SC-006**: `get_health` statistics include shard count alongside existing metrics.
