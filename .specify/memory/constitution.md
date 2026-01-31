# Zoekt MCP Server Constitution

## Core Principles

### I. MCP Protocol Compliance
The MCP server MUST use the official `@modelcontextprotocol/sdk` and follow all MCP specification requirements. All tools MUST have proper Zod schemas for input validation. Tool descriptions MUST be clear enough for a "junior developer" to understand usage without documentation.

### II. Zoekt Integration Fidelity
The MCP server acts as a thin wrapper over Zoekt's HTTP API. It MUST preserve full Zoekt query syntax capabilities. No query features should be hidden or modified—what works in Zoekt should work through the MCP.

### III. Minimal Dependencies
Runtime dependencies limited to essentials: MCP SDK, Zod (validation), Pino (logging). No frameworks, no abstractions. Every dependency must justify its inclusion.

### IV. Query-First API Design
Defer to Zoekt query syntax rather than adding tool parameters. Tool parameters should handle structural concerns (limit, pagination, context) not filtering (language, repo, case sensitivity). Document query syntax in tool descriptions with examples.

### V. Explicit Error Handling
All errors MUST include: (1) error code for programmatic handling, (2) human-readable message, (3) actionable hints where applicable. Never swallow errors silently. Structured error types: UNAVAILABLE, QUERY_ERROR, TIMEOUT, NOT_FOUND.

### VI. Observability & Debugging
All requests logged with: query, duration, result count. Pino JSON logging for production, human-readable for development. `--debug` flag for verbose output. Every search tool response includes stats (matches, files, duration).

### VII. Simplicity First (YAGNI)
Start with the simplest solution that meets requirements. Add complexity only when demonstrably needed. No premature abstractions, no over-engineering. Prefer inline code over abstractions until patterns emerge across 3+ use cases.

## Additional Constraints

### Technology Stack
- **Language**: TypeScript 5.x with strict mode
- **Runtime**: Node.js 18+ (LTS)
- **Testing**: Vitest for unit tests, integration tests against mock Zoekt responses
- **Transport**: stdio (primary), HTTP (future)

### Performance Requirements
- Search response: <2 seconds for indexes up to 100 repositories
- Concurrent requests: Handle 100 simultaneous searches without degradation
- Health check: <500ms response time

### Security
- No credentials in code or logs
- Sanitize all user inputs before passing to Zoekt
- Rate limiting awareness (defer to Zoekt's limits)

## Development Workflow

### Test-Driven Development
For all new tools: (1) Write failing test, (2) Implement minimum code to pass, (3) Refactor. Tests run on every commit via npm test.

### Incremental Delivery
Each tool can be implemented, tested, and merged independently. No big-bang releases. Feature flags for experimental capabilities.

### Code Review Standards
- Every PR requires passing tests
- Tool descriptions reviewed for clarity
- Query syntax examples verified against actual Zoekt behavior

## Governance

This constitution guides all development decisions for the Zoekt MCP server. When in doubt, choose the simpler option that adheres to these principles.

Amendments require: (1) documented rationale, (2) updated spec/plan, (3) team review.

**Version**: 1.0.0 | **Ratified**: 2026-01-31
