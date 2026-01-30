<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0
Modified principles: N/A (initial creation)
Added sections: Core Principles (5), Technology Stack, Development Workflow, Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (compatible - uses Constitution Check section)
  - .specify/templates/spec-template.md ✅ (compatible - standard format)
  - .specify/templates/tasks-template.md ✅ (compatible - phase-based structure aligns)
Follow-up TODOs: None
-->

# Zoekt MCP Constitution

## Core Principles

### I. MCP Protocol Compliance

The Zoekt MCP server MUST strictly adhere to the Model Context Protocol specification.

- All tool definitions MUST include complete JSON Schema with descriptions, required fields, and type constraints
- Tools MUST return structured responses following MCP result formats (text content, error handling)
- Server MUST implement proper capability negotiation during initialization
- All MCP protocol errors MUST be propagated with appropriate error codes and human-readable messages
- Server MUST support graceful shutdown and connection lifecycle management

**Rationale**: MCP compliance ensures interoperability with any MCP-compatible client (VS Code Copilot, Claude Desktop, etc.) and prevents protocol-level failures.

### II. Zoekt Integration Fidelity

The MCP layer MUST preserve Zoekt's full query capabilities without lossy abstraction.

- All Zoekt query syntax features MUST be exposed (file filters, regex, boolean operators, symbol search)
- Search results MUST include complete metadata: file paths, line numbers, match context, repository info
- The MCP server MUST NOT interpret or transform queries beyond protocol translation
- Performance characteristics MUST remain consistent with direct Zoekt CLI/API usage
- Index paths and configuration MUST be explicitly configurable, not hard-coded

**Rationale**: Zoekt's power comes from its rich query language and fast trigram indexing; the MCP wrapper must not diminish this capability.

### III. Minimal Dependencies

The MCP server MUST have a minimal dependency footprint.

- Use standard Node.js APIs where possible; external dependencies require explicit justification
- The MCP server MUST be distributable via `npx` for easy installation
- Required dependencies: `@modelcontextprotocol/sdk`, `zod` (schema validation), logging library
- Configuration via environment variables and/or command-line flags only (no config files required)

**Rationale**: Simplicity reduces attack surface, eases deployment, and ensures long-term maintainability.

### IV. Explicit Error Handling

All error conditions MUST be handled explicitly with actionable feedback.

- Zoekt index not found → Clear message with expected path and setup instructions
- Query syntax errors → Return Zoekt's parse error with position information
- No results → Distinguish between "no matches" and "index empty/missing"
- Connection/timeout errors → Include retry guidance and diagnostic info
- MUST NOT panic; all recoverable errors return structured MCP error responses

**Rationale**: AI agents and users need clear, actionable errors to diagnose and fix issues without manual debugging.

### V. Observability & Debugging

The server MUST provide visibility into its operation for troubleshooting.

- Structured logging (JSON format) to stderr with configurable verbosity levels
- Each search request MUST log: query, index path, result count, duration
- Startup MUST log: version, index path(s), configured capabilities
- Support a `--debug` flag for verbose protocol-level tracing
- Health/status endpoint or tool for operational verification

**Rationale**: MCP servers run as background processes; operators need logs to diagnose issues without attaching debuggers.

## Technology Stack

- **Language**: TypeScript (Node.js 18+) for MCP server; Go for Zoekt infrastructure (existing)
- **MCP Transport**: stdio (primary), with optional HTTP/SSE for remote scenarios
- **Build**: npm/bun with TypeScript compilation; single distributable via `npx`
- **Testing**: Vitest or Jest for unit/integration tests
- **Zoekt Dependency**: HTTP API client to zoekt-webserver (not Go library import)
- **Docker**: Docker Compose for indexing infrastructure (zoekt-indexserver, zoekt-webserver)

## Development Workflow

### Code Quality Gates

1. **All code MUST pass ESLint and TypeScript strict mode** before commit
2. **All public functions MUST have JSDoc comments** explaining purpose and usage
3. **All MCP tools MUST have integration tests** verifying end-to-end behavior
4. **Breaking changes to tool schemas MUST increment major version** and document migration

### Review Requirements

- All PRs MUST verify compliance with this constitution
- New tools MUST include: schema definition, handler implementation, tests, documentation
- Performance-sensitive changes MUST include benchmark comparisons

## Governance

This constitution is the authoritative source for project principles and supersedes all other documentation when conflicts arise.

### Amendment Process

1. Propose changes via PR with rationale
2. Changes affecting principles require explicit justification
3. Version MUST be incremented according to semantic versioning:
   - MAJOR: Principle removal or fundamental redefinition
   - MINOR: New principle or section added
   - PATCH: Clarifications, wording improvements
4. LAST_AMENDED_DATE MUST be updated to amendment date

### Compliance Review

- All feature specifications MUST reference applicable principles
- Implementation plans MUST include a Constitution Check section
- Code reviews MUST verify principle adherence

**Version**: 1.1.0 | **Ratified**: 2026-01-30 | **Last Amended**: 2026-01-30
