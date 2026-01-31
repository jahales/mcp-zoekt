# Feature Specification: Zoekt MCP Tools Enhancement

**Feature Branch**: `003-zoekt-mcp-tools`  
**Created**: 2026-01-31  
**Status**: Draft  
**Input**: Add full support for Zoekt search tools to the MCP: search_symbols tool, search_files tool, find_references/find_definitions tools, pagination support, health/status resource, enhanced search parameters (case_sensitive, whole_word), and improved error messages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search for Symbols Across Repositories (Priority: P1)

As a developer using an AI coding assistant, I want to search specifically for symbol names (functions, classes, methods, variables) across all indexed repositories, so that I can quickly find definitions and understand code structure without wading through content matches.

**Why this priority**: Symbol search is one of the most common developer workflows. AI agents navigating codebases need to quickly locate function definitions, class names, and other symbols to understand and modify code effectively.

**Independent Test**: Can be tested by calling the `search_symbols` MCP tool with a symbol name like "handleRequest" and verifying that results contain only symbol matches (not content matches containing the text).

**Acceptance Scenarios**:

1. **Given** repositories are indexed with symbol information (ctags enabled), **When** a user calls `search_symbols` with query "UserService", **Then** the system returns matches showing class/function definitions named "UserService" with file paths, line numbers, and symbol kind (class, function, method, etc.).

2. **Given** a symbol query with a language filter, **When** a user calls `search_symbols` with query "handler" and lang "typescript", **Then** only TypeScript symbols matching "handler" are returned.

3. **Given** no symbols match the query, **When** a user calls `search_symbols`, **Then** the system returns an empty result with a helpful message suggesting alternative approaches.

---

### User Story 2 - Search for Files by Name Pattern (Priority: P1)

As a developer using an AI coding assistant, I want to search for files by filename pattern without content matching, so that I can quickly locate configuration files, test files, or specific file types across repositories.

**Why this priority**: File navigation is a fundamental capability. AI agents frequently need to find specific files (e.g., "find all package.json files" or "locate test files") without searching file contents.

**Independent Test**: Can be tested by calling the `search_files` MCP tool with a pattern like "*.config.ts" and verifying that results list matching filenames without content snippets.

**Acceptance Scenarios**:

1. **Given** repositories are indexed, **When** a user calls `search_files` with pattern "package.json", **Then** the system returns all files named "package.json" with their repository and full path.

2. **Given** a regex pattern is provided, **When** a user calls `search_files` with pattern ".*\.test\.ts$", **Then** all TypeScript test files are returned.

3. **Given** a repository filter is provided, **When** a user calls `search_files` with pattern "README.md" and repo filter "my-org/my-repo", **Then** only README files from that specific repository are returned.

---

### User Story 3 - Find References to a Symbol (Priority: P2)

As a developer using an AI coding assistant, I want to find all usages/references to a specific symbol (function, class, variable), so that I can understand the impact of changes and trace dependencies across the codebase.

**Why this priority**: Understanding symbol usage is critical for refactoring, debugging, and impact analysis. This enables AI agents to provide accurate information about how code is connected.

**Independent Test**: Can be tested by calling `find_references` with a known function name and verifying results include both the definition and all call sites across repositories.

**Acceptance Scenarios**:

1. **Given** a function "validateInput" exists and is called in multiple files, **When** a user calls `find_references` with symbol "validateInput", **Then** the system returns all files and locations where the function is called or referenced.

2. **Given** a symbol query with a scope filter, **When** a user calls `find_references` with symbol "config" and repo filter "backend-service", **Then** only references within that repository are returned.

3. **Given** no references are found, **When** a user calls `find_references`, **Then** the system returns an empty result indicating no usages were found.

---

### User Story 4 - Paginate Through Large Result Sets (Priority: P2)

As a developer using an AI coding assistant, I want to paginate through large search result sets, so that I can explore comprehensive results without being limited to the first 100 matches.

**Why this priority**: Current 100-result limit can miss important matches in large codebases. Pagination enables complete exploration of results when needed.

**Independent Test**: Can be tested by executing a broad search that returns 100+ results, verifying the response includes pagination cursor, then fetching the next page and verifying different results are returned.

**Acceptance Scenarios**:

1. **Given** a search query matches 250 results, **When** a user calls `search` with limit 50, **Then** the response includes the first 50 results and a `nextCursor` token for fetching more.

2. **Given** a user has a `nextCursor` from a previous search, **When** they call `search` with that cursor, **Then** the next page of results is returned with a new cursor (or no cursor if exhausted).

3. **Given** pagination is exhausted, **When** a user reaches the last page, **Then** no `nextCursor` is returned, indicating all results have been retrieved.

---

### User Story 5 - Control Search Case Sensitivity (Priority: P2)

As a developer using an AI coding assistant, I want to explicitly control case sensitivity in searches, so that I can find exact matches when precision matters or cast a wider net when exploring.

**Why this priority**: Case sensitivity control enables precise searches (finding "Config" but not "config") and is a frequently requested search refinement option.

**Independent Test**: Can be tested by searching for "Error" with `case_sensitive: true` and verifying that "error" matches are not returned, then repeating with `case_sensitive: false` and verifying both are returned.

**Acceptance Scenarios**:

1. **Given** a search with `case_sensitive: true`, **When** a user searches for "UserConfig", **Then** only exact case matches are returned (not "userconfig" or "USERCONFIG").

2. **Given** a search with `case_sensitive: false`, **When** a user searches for "error", **Then** matches include "Error", "ERROR", and "error".

3. **Given** no case sensitivity parameter is provided, **When** a user searches, **Then** the default Zoekt behavior applies (auto-detect based on query pattern).

---

### User Story 6 - Match Whole Words Only (Priority: P3)

As a developer using an AI coding assistant, I want to search for whole word matches only, so that I can find "log" without matching "logging", "catalog", or "dialog".

**Why this priority**: Whole word matching reduces noise in search results and is particularly valuable when searching for short, common terms.

**Independent Test**: Can be tested by searching for "log" with `whole_word: true` and verifying that "logging" matches are excluded.

**Acceptance Scenarios**:

1. **Given** a search with `whole_word: true`, **When** a user searches for "get", **Then** only matches where "get" appears as a complete word are returned (not "getUser" or "target").

2. **Given** a search with `whole_word: false` (default), **When** a user searches for "get", **Then** partial matches like "getUser" and "getter" are included.

---

### User Story 7 - Check Server Health Status (Priority: P3)

As a platform operator or AI agent, I want to check the health and status of the Zoekt MCP server and its backend, so that I can diagnose connectivity issues and verify the system is operational.

**Why this priority**: Health checks enable monitoring and debugging when things go wrong, though they don't directly impact the core search experience.

**Independent Test**: Can be tested by accessing the health resource endpoint and verifying it returns status information including Zoekt backend connectivity.

**Acceptance Scenarios**:

1. **Given** the Zoekt backend is running normally, **When** an agent reads the health resource, **Then** the response shows "healthy" status with backend connectivity confirmed.

2. **Given** the Zoekt backend is unavailable, **When** an agent reads the health resource, **Then** the response shows "unhealthy" status with a clear error message about backend connectivity.

3. **Given** the health check succeeds, **When** the response is returned, **Then** it includes useful metadata like server version, uptime, and indexed repository count.

---

### User Story 8 - Get Helpful Error Messages (Priority: P2)

As a developer using an AI coding assistant, I want clear, actionable error messages when searches fail, so that I can understand what went wrong and how to fix my query.

**Why this priority**: Good error messages reduce friction and help users self-correct. Poorly-formed queries are common, especially when learning the query syntax.

**Independent Test**: Can be tested by submitting an invalid query (e.g., malformed regex) and verifying the error message includes the specific issue and hints for correction.

**Acceptance Scenarios**:

1. **Given** a malformed regex in the query, **When** the search fails, **Then** the error message identifies the regex syntax error and suggests the correct format.

2. **Given** an unknown field in the query (e.g., "filee:"), **When** the search fails, **Then** the error message identifies the unknown field and lists valid field options.

3. **Given** the Zoekt backend times out, **When** the error is returned, **Then** the message suggests narrowing the query scope or increasing specificity.

---

### Edge Cases

- What happens when symbol search is requested but ctags indexing is not enabled?
  → The system returns an empty result with a message indicating symbol indexing may not be configured.

- What happens when pagination cursor expires or becomes invalid?
  → The system returns an error indicating the cursor is invalid and suggests starting a new search.

- What happens when whole_word is combined with regex patterns?
  → The whole_word parameter is ignored for regex patterns (regex gives full control); a warning may be logged.

- What happens when file search pattern has invalid regex syntax?
  → The system returns an error with the specific regex parsing issue and suggests alternatives.

## Requirements *(mandatory)*

### Functional Requirements

#### New Tools

- **FR-001**: MCP server MUST expose a `search_symbols` tool that searches for symbol names (functions, classes, methods, variables) using Zoekt's `sym:` query syntax
- **FR-002**: MCP server MUST expose a `search_files` tool that searches for files by name pattern using Zoekt's `type:filename` query mode
- **FR-003**: MCP server MUST expose a `find_references` tool that finds all usages of a symbol across indexed repositories
- **FR-004**: The `search_symbols` tool MUST return symbol kind (function, class, method, variable) when available from ctags data
- **FR-005**: The `search_files` tool MUST support regex patterns for flexible file matching
- **FR-006**: The `find_references` tool MUST combine symbol definition search with content search to find both declarations and usages

#### Pagination

- **FR-007**: The `search` tool MUST accept an optional `cursor` parameter for pagination
- **FR-008**: Search responses MUST include a `nextCursor` field when more results are available
- **FR-009**: Cursor-based pagination MUST maintain consistent result ordering across pages
- **FR-010**: Invalid or expired cursors MUST return a clear error message

#### Enhanced Search Parameters

- **FR-011**: The `search` tool MUST accept an optional `case_sensitive` boolean parameter (maps to Zoekt's `case:yes/no`)
- **FR-012**: The `search` tool MUST accept an optional `whole_word` boolean parameter (wraps query terms in word boundary regex)
- **FR-013**: New search tools (`search_symbols`, `search_files`, `find_references`) MUST also support `case_sensitive` and `whole_word` parameters
- **FR-014**: When `whole_word: true`, the system MUST wrap search terms with `\b` word boundary markers in regex

#### Health and Status

- **FR-015**: MCP server MUST expose a `health` resource (or tool) that reports server and backend status
- **FR-016**: Health checks MUST verify connectivity to the Zoekt webserver
- **FR-017**: Health response MUST include: status (healthy/unhealthy), server version, Zoekt backend reachability, and indexed repository count

#### Error Handling

- **FR-018**: Error messages for query syntax errors MUST include the specific issue and hint for correction
- **FR-019**: Error messages for unknown query fields MUST list valid field options
- **FR-020**: Timeout errors MUST suggest query refinement strategies
- **FR-021**: All error responses MUST include an error code for programmatic handling

### Key Entities

- **Symbol**: A code symbol (function, class, method, variable) indexed by Zoekt via ctags; has name, kind, file location, and repository
- **File Match**: A file matching a filename pattern; has path, repository, and branches
- **Search Cursor**: An opaque token representing pagination state; includes query hash and offset information
- **Health Status**: Server operational state; includes connectivity status, version, and statistics
- **Search Options**: Parameters modifying search behavior; includes case_sensitive, whole_word, limit, context_lines

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can search for symbols and receive results within 2 seconds for indexes up to 100 repositories
- **SC-002**: Users can search for files by name and receive results within 1 second for indexes up to 100 repositories
- **SC-003**: Users can paginate through 500+ search results by fetching successive pages
- **SC-004**: Case-sensitive searches return only exact case matches (zero false positives from case mismatch)
- **SC-005**: Whole-word searches exclude partial matches (e.g., searching "log" does not return "logging")
- **SC-006**: Error messages for 90% of common query mistakes include actionable correction hints
- **SC-007**: Health check endpoint responds within 500ms and accurately reflects backend status
- **SC-008**: All new tools are discoverable by MCP clients and include complete parameter documentation

## Assumptions

- Zoekt indexing includes ctags symbol extraction (required for symbol search functionality)
- Zoekt webserver API supports the query syntax features being wrapped (sym:, type:filename, case:, etc.)
- MCP clients can handle pagination cursor tokens in tool responses
- The existing search, list_repos, and file_content tools continue to work alongside new tools
- Zoekt's offset-based result limiting can be used to implement cursor-based pagination
