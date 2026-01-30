# Feature Specification: E2E & Integration Tests for Zoekt MCP Server

**Feature Branch**: `002-e2e-integration-tests`  
**Created**: 2025-01-14  
**Status**: Draft  
**Input**: User description: "Add end-to-end and integration tests for the Zoekt MCP server to verify tool functionality against a running Zoekt instance"

## Clarifications

### Session 2026-01-31

- Q: Integration test execution strategy - graceful skip vs separate project? → A: Separate Vitest project with explicit `npm run test:integration`. Default `npm test` runs only unit tests.
- Q: Test corpus strategy - embedded, dedicated repo, or use existing repos? → A: Embedded fixture folder inside `tests/fixtures/` with known content. Self-contained and reproducible.
- Q: CI infrastructure provisioning approach? → A: Docker Compose in CI - workflow starts containers, waits for health, runs tests, tears down.
- Q: MCP protocol testing scope for P3 story? → A: Full MCP client simulation - spin up server as subprocess, connect via stdio, send real JSON-RPC messages.

## Assumptions

- Integration tests will run against a real Zoekt webserver instance (not mocked)
- The existing Docker infrastructure (`docker/docker-compose.yml`) provides the test backend
- Tests should be runnable both locally and in CI with appropriate setup
- Test corpus is an embedded fixture folder, not external repositories

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Validates MCP Tools Work End-to-End (Priority: P1)

As a developer, I want to run integration tests that verify all MCP tools (`search`, `list_repos`, `file_content`) work correctly against a real Zoekt instance, so I can catch API format mismatches and integration bugs before deployment.

**Why this priority**: The unit tests mock all HTTP responses, which means API format changes (like the `Result` → `result` issue we discovered) can go undetected. Integration tests against a real backend are the primary way to catch these issues.

**Independent Test**: Can be fully tested by starting Docker infrastructure, running integration test suite, and verifying all tools return expected data structures.

**Acceptance Scenarios**:

1. **Given** Zoekt infrastructure is running with indexed repositories, **When** the `search` tool is called with a valid query, **Then** the response contains file matches with valid file paths, line numbers, and code content
2. **Given** Zoekt infrastructure is running with indexed repositories, **When** the `list_repos` tool is called, **Then** the response contains a list of repository names that were indexed
3. **Given** Zoekt infrastructure is running with indexed repositories, **When** the `file_content` tool is called with a valid repo and file path, **Then** the response contains the actual file content

---

### User Story 2 - Developer Catches Connection & Timeout Issues (Priority: P2)

As a developer, I want integration tests to verify error handling when the Zoekt backend is unavailable or slow, so I can ensure the MCP server gracefully handles infrastructure issues.

**Why this priority**: Production reliability depends on proper error handling. These tests validate the error paths that unit tests can only simulate.

**Independent Test**: Can be tested by intentionally stopping Zoekt or introducing network delays and verifying appropriate error responses.

**Acceptance Scenarios**:

1. **Given** Zoekt infrastructure is NOT running, **When** any tool is called, **Then** the MCP server returns an appropriate error message indicating the backend is unavailable
2. **Given** Zoekt infrastructure responds very slowly, **When** a tool is called with a short timeout, **Then** the MCP server returns a timeout error

---

### User Story 3 - Developer Validates MCP Protocol Compliance (Priority: P3)

As a developer, I want integration tests that verify the MCP server correctly responds to MCP protocol messages (`tools/list`, `tools/call`), so I can ensure the server integrates properly with MCP clients like VS Code.

**Why this priority**: MCP protocol compliance is essential for the server to work with any MCP client. This validates the full message flow, not just the tool logic.

**Independent Test**: Can be tested by simulating an MCP client and verifying proper JSON-RPC responses.

**Acceptance Scenarios**:

1. **Given** the MCP server is started, **When** a client sends `tools/list`, **Then** the response includes all three tools with correct schemas
2. **Given** the MCP server is started, **When** a client sends `tools/call` for `search`, **Then** the response follows the MCP tool result format

---

### Edge Cases

- What happens when searching for a pattern that returns zero matches?
- How does the system handle special characters in queries (regex, unicode)?
- What happens when `file_content` is called for a file that doesn't exist?
- How does the system handle repositories with no indexed files?
- What happens when the Zoekt server returns malformed JSON?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include an integration test suite as a separate Vitest project that runs against a live Zoekt webserver
- **FR-002**: Integration tests MUST verify the `search` tool returns matches with valid structure (file path, line numbers, content)
- **FR-003**: Integration tests MUST verify the `list_repos` tool returns a list of indexed repositories
- **FR-004**: Integration tests MUST verify the `file_content` tool returns file contents for valid paths
- **FR-005**: Integration tests MUST verify appropriate error responses when the backend is unavailable
- **FR-006**: Default `npm test` MUST run only unit tests; integration tests run via explicit `npm run test:integration`
- **FR-007**: System MUST include an embedded test corpus (`tests/fixtures/`) with known files for deterministic test results
- **FR-008**: Integration tests MUST run in a separate Vitest project from unit tests, selectable via `--project` flag
- **FR-009**: System MUST include npm scripts: `test` (unit only), `test:integration` (integration only), `test:all` (both)
- **FR-010**: CI workflow MUST start Docker Compose infrastructure, wait for health check, run integration tests, then tear down
- **FR-011**: MCP protocol tests MUST spin up the server as a subprocess and communicate via stdio with real JSON-RPC messages

### Non-Functional Requirements

- **NFR-001**: Integration tests should complete in under 30 seconds when infrastructure is running
- **NFR-002**: Test failures should provide clear diagnostic output indicating whether the issue is infrastructure or code
- **NFR-003**: CI workflow should support Docker Compose for provisioning Zoekt infrastructure
- **NFR-004**: Unit tests (`npm test`) should complete without any network calls or infrastructure dependencies

### Key Entities

- **Test Corpus**: An embedded `tests/fixtures/` folder with known TypeScript/JavaScript files for deterministic testing
- **Integration Test Project**: A separate Vitest project configuration for infrastructure-dependent tests
- **Test Fixtures**: Known queries, file paths, and expected results derived from the embedded corpus
- **MCP Test Client**: A subprocess-based client that sends JSON-RPC messages via stdio to validate protocol compliance

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Integration test suite covers all three MCP tools (`search`, `list_repos`, `file_content`)
- **SC-002**: Tests can detect API format changes (like the `Result` vs `result` issue) that unit tests miss
- **SC-003**: Developer can run `npm run test:integration` and get pass/fail results within 30 seconds
- **SC-004**: `npm test` runs only unit tests and completes without requiring Zoekt infrastructure
- **SC-005**: Tests use embedded fixture corpus for 100% reproducibility across environments
- **SC-006**: CI workflow provisions Docker infrastructure and runs integration tests on every PR
- **SC-007**: MCP protocol tests validate full JSON-RPC message flow via subprocess stdio
