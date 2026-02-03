# Feature Specification: Pagination Logic Evaluation & Fix

**Feature Branch**: `004-pagination-logic`  
**Created**: February 3, 2026  
**Status**: Draft  
**Input**: User description: "Evaluate and fix pagination logic across all MCP tools, ensure cursor validation is correct, limit handling is robust, and add comprehensive test coverage"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Consistent Pagination Across Search Tools (Priority: P1)

As an AI assistant using the MCP tools, I want pagination to work consistently across `search_symbols`, `search_files`, and `find_references` so that I can reliably retrieve large result sets page by page without missing results or encountering errors.

**Why this priority**: Pagination is fundamental to all tools that return large result sets. Inconsistent behavior causes confusion and data loss.

**Independent Test**: Can be tested by performing multi-page searches and verifying each page contains the expected number of unique results with no duplicates or gaps.

**Acceptance Scenarios**:

1. **Given** a search that returns 100 symbols, **When** I request `limit=30` and paginate through all pages, **Then** I receive exactly 100 unique symbols across 4 pages (30+30+30+10).
2. **Given** a search with active pagination, **When** I use the provided cursor for the next page, **Then** I receive the next set of results starting from the correct offset.
3. **Given** a cursor from one search, **When** I attempt to use it with a different query, **Then** I receive a clear error message explaining cursor/query mismatch.

---

### User Story 2 - Robust Limit Parameter Handling (Priority: P1)

As an AI assistant, I want the `limit` parameter to correctly control the number of results returned per page, regardless of how results are distributed across files in the index.

**Why this priority**: The `limit` parameter is the primary mechanism for controlling response size. Incorrect handling leads to unpredictable response sizes.

**Independent Test**: Can be tested by specifying various limit values and verifying the exact number of items returned.

**Acceptance Scenarios**:

1. **Given** a search with many matching results, **When** I request `limit=5`, **Then** I receive exactly 5 items (or fewer if total results < 5).
2. **Given** a search where each file contains multiple symbols, **When** I request `limit=10`, **Then** I receive exactly 10 symbols, not 10 files worth of symbols.
3. **Given** Zoekt returns fewer files than requested but each file has many matches, **When** I request `limit=30`, **Then** I still receive up to 30 items extracted from those files.

---

### User Story 3 - Limit Consistency Between Pages (Priority: P2)

As an AI assistant, I want the ability to change the `limit` parameter between pages without the cursor becoming invalid.

**Why this priority**: Current implementation stores `limit` in cursor but uses it only for validation, causing confusing errors when users change page size.

**Independent Test**: Can be tested by starting pagination with one limit value and continuing with a different value.

**Acceptance Scenarios**:

1. **Given** a cursor created with `limit=30`, **When** I request the next page with `limit=50`, **Then** I receive up to 50 results starting from the correct offset.
2. **Given** a cursor created with `limit=100`, **When** I request the next page with `limit=10`, **Then** I receive up to 10 results without cursor validation failure.

---

### User Story 4 - Deep Pagination Efficiency (Priority: P3)

As an AI assistant navigating deep into result sets, I want pagination to be reasonably efficient even on page 10+ so that I can explore large result sets without excessive latency.

**Why this priority**: Current implementation re-fetches all results up to offset+limit on every page, which is inefficient but acceptable for shallow pagination. Deep pagination may have performance issues.

**Independent Test**: Can be tested by measuring response time for page 1 vs page 10 of the same query.

**Acceptance Scenarios**:

1. **Given** a search with 1000+ results, **When** I paginate to page 10 (offset 270), **Then** the response time is within 2x of page 1 response time.
2. **Given** deep pagination, **When** Zoekt's result count is insufficient for the requested offset, **Then** the system returns empty results with no cursor, not an error.

---

### Edge Cases

- What happens when a user provides a completely invalid cursor (random string, wrong encoding)? **Expected**: Clear error message with code.
- How does the system handle when the index changes between pagination requests? **Expected**: Best-effort results; may have minor inconsistencies.
- What happens when `offset + limit` exceeds the total result count? **Expected**: Return remaining results, no next cursor.
- How does pagination behave when symbols span many small files vs few large files? **Expected**: Correct item count regardless of file distribution.
- What happens if `limit=0` or `limit=-1` is requested? **Expected**: Rejected by Zod schema before handler is called.
- What happens when all results fit on one page? **Expected**: No next cursor generated.
- How does `find_references` handle pagination when definitions and usages have different counts? **Expected**: Combined pagination across both result sets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST correctly pass the `limit` parameter to Zoekt as `MaxDocDisplayCount` in all search operations.
- **FR-002**: System MUST return exactly `limit` items per page (or fewer if total results are exhausted).
- **FR-003**: System MUST generate a valid pagination cursor when more results are available beyond the current page.
- **FR-004**: System MUST NOT generate a cursor when the current page contains all remaining results.
- **FR-005**: System MUST validate cursor query hash matches the current query before using the offset.
- **FR-006**: System MUST reject cursors with invalid format, negative offsets, or malformed data with clear error messages.
- **FR-007**: System SHOULD allow changing the `limit` parameter between pages without invalidating the cursor.
- **FR-008**: System MUST request sufficient results from Zoekt to fulfill the pagination window (`offset + limit + 1` for has-more detection).
- **FR-009**: System MUST correctly slice extracted items (symbols/files/references) to apply pagination, not rely solely on Zoekt's file-level limit.
- **FR-010**: System MUST handle the case where extracted item count differs from file match count (multiple symbols per file, etc.).

### Key Entities

- **Cursor**: Encodes `queryHash`, `offset`, and `limit` for stateless pagination. Base64-encoded JSON.
- **Page**: A subset of results defined by `offset` (starting position) and `limit` (page size).
- **FileMatch**: Zoekt's unit of result (one file). May contain multiple items (symbols, line matches).
- **Item**: The granular result unit exposed by MCP tools (symbol, file path, or reference).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All pagination tests pass, including edge cases for cursor validation, limit handling, and multi-page navigation.
- **SC-002**: 100% of searches with `limit=N` return exactly N items (or total available if fewer).
- **SC-003**: Cursor-based pagination produces zero duplicate items and zero missed items across all pages.
- **SC-004**: Users can change `limit` between pages without encountering validation errors.
- **SC-005**: Deep pagination (page 10+) completes within 5 seconds for typical queries.
- **SC-006**: Test coverage for pagination module is at least 90% line coverage.
- **SC-007**: Integration tests verify end-to-end pagination through the MCP protocol.

## Assumptions

- The underlying Zoekt index is stable during a single pagination session (minor changes between pages are acceptable but not guaranteed to produce perfect consistency).
- `MaxDocDisplayCount` in Zoekt limits the number of files returned, not the total number of line/symbol matches within those files.
- The MCP client (AI assistant) will use cursors as opaque strings and not attempt to decode or modify them.
- Default limit of 30 is appropriate for most use cases.
- Maximum limit of 100 is enforced to prevent excessive response sizes.
