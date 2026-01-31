# Implementation Plan: Zoekt MCP Tools Enhancement

**Branch**: `003-zoekt-mcp-tools` | **Date**: 2026-01-31 | **Spec**: [specs/003-zoekt-mcp-tools/spec.md](../003-zoekt-mcp-tools/spec.md)
**Input**: Feature specification from `/specs/003-zoekt-mcp-tools/spec.md`

## Summary

Extend the Zoekt MCP server with specialized search tools (`search_symbols`, `search_files`, `find_references`), a health check tool (`get_health`), and cursor-based pagination. Implementation follows a "query-first" design where tool parameters handle structural concerns (limit, pagination) while query syntax handles filtering (lang:, repo:, case:). All tools wrap Zoekt's existing HTTP API with no new backend dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode  
**Primary Dependencies**: @modelcontextprotocol/sdk ^1.0.0, zod ^3.0.0, pino ^8.0.0  
**Storage**: N/A (stateless server; Zoekt manages index storage)  
**Testing**: Vitest for unit/integration tests; mock Zoekt responses  
**Target Platform**: Node.js 18+ LTS (Linux/macOS/Windows)  
**Project Type**: Single project (CLI server with library structure)  
**Performance Goals**: <2s search response for 100-repo indexes; <500ms health check  
**Constraints**: Stateless pagination (no server-side cursor storage); no new dependencies  
**Scale/Scope**: 100+ indexed repositories; 500+ result pagination

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| I. MCP Protocol Compliance | ✅ PASS | Using @modelcontextprotocol/sdk; all tools have Zod schemas |
| II. Zoekt Integration Fidelity | ✅ PASS | Query-first design preserves Zoekt syntax; no hidden features |
| III. Minimal Dependencies | ✅ PASS | No new runtime dependencies required |
| IV. Query-First API Design | ✅ PASS | Parameters limited to query, limit, contextLines, cursor |
| V. Explicit Error Handling | ✅ PASS | Spec requires error codes, messages, hints (FR-017 to FR-020) |
| VI. Observability & Debugging | ✅ PASS | Pino logging already in place; stats in responses |
| VII. Simplicity First | ✅ PASS | Wrapping existing Zoekt API; no new abstractions |

**Pre-Research Gate: PASSED** - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/003-zoekt-mcp-tools/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── tools.ts         # TypeScript type definitions for new tools
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
zoekt-mcp/
├── src/
│   ├── server.ts        # Main MCP server (add new tool registrations)
│   ├── tools/           # NEW: Extracted tool implementations
│   │   ├── search.ts        # Existing search tool (refactored)
│   │   ├── search-symbols.ts # NEW: Symbol search tool
│   │   ├── search-files.ts   # NEW: File search tool  
│   │   ├── find-references.ts # NEW: References tool
│   │   ├── list-repos.ts     # Existing repos tool (refactored)
│   │   ├── file-content.ts   # Existing file tool (refactored)
│   │   └── get-health.ts     # NEW: Health check tool
│   ├── pagination/      # NEW: Cursor implementation
│   │   ├── cursor.ts        # Encode/decode stateless cursors
│   │   └── cursor.test.ts   # Unit tests for cursor logic
│   ├── zoekt/
│   │   ├── client.ts    # HTTP client (add health check method)
│   │   └── types.ts     # Types (add symbol/health types)
│   └── errors/          # NEW: Structured error handling
│       └── codes.ts         # Error code constants
├── tests/
│   ├── unit/
│   │   └── tools/       # Unit tests for each tool
│   └── integration/
│       └── tools.test.ts # Integration tests with mock Zoekt
└── package.json
```

**Structure Decision**: Single project structure. New tools added to `src/tools/` directory for organization. Pagination logic extracted to `src/pagination/`. No changes to overall project shape.

## Complexity Tracking

> No constitution violations requiring justification.

---

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design completion.*

| Gate | Status | Evidence |
|------|--------|----------|
| I. MCP Protocol Compliance | ✅ PASS | All tools defined with Zod schemas in contracts/tools.ts |
| II. Zoekt Integration Fidelity | ✅ PASS | sym:, type:filename, /healthz endpoints documented |
| III. Minimal Dependencies | ✅ PASS | Only crypto (built-in) needed for cursor hashing |
| IV. Query-First API Design | ✅ PASS | Tool inputs: query, limit, cursor, contextLines only |
| V. Explicit Error Handling | ✅ PASS | StructuredError type with codes, messages, hints |
| VI. Observability & Debugging | ✅ PASS | Stats in all responses; health tool for diagnostics |
| VII. Simplicity First | ✅ PASS | Stateless cursors; no server-side session storage |

**Post-Design Gate: PASSED** - Design aligns with constitution principles.

---

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | [research.md](./research.md) | Zoekt API research, pagination design, error strategies |
| Data Model | [data-model.md](./data-model.md) | Entity definitions: Symbol, FileMatch, Cursor, etc. |
| Contracts | [contracts/tools.ts](./contracts/tools.ts) | TypeScript types for tool inputs/outputs |
| Quickstart | [quickstart.md](./quickstart.md) | Implementation guide with code snippets |

---

## Next Steps

1. Run `/speckit.tasks` to generate task breakdown from this plan
2. Implement in order specified in quickstart.md
3. Create PR for review when complete
