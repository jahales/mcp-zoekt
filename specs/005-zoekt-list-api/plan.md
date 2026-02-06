# Implementation Plan: Zoekt List API Migration

**Branch**: `005-zoekt-list-api` | **Date**: 2026-02-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-zoekt-list-api/spec.md`

## Summary

Migrate `listRepos()` and `getStats()` from abusing Zoekt's `/api/search` endpoint (where results are capped by `MaxDocDisplayCount`) to using the purpose-built `/api/list` endpoint. This fixes a critical bug where `list_repos` returns ~5-7 repos instead of ~1100, and `get_health` reports incorrect statistics. The migration also enables exposing richer per-repository metadata (branch SHAs, document counts, symbol availability, index freshness) that `/api/list` provides for free.

## Technical Context

**Language/Version**: TypeScript 5.5+ with strict mode, ES2022 target  
**Primary Dependencies**: `@modelcontextprotocol/sdk` ^1.25.2, `zod` ^3.23.0, `pino` ^9.0.0  
**Storage**: N/A (stateless HTTP client to Zoekt backend)  
**Testing**: Vitest ^2.0.0 — unit tests with mocked HTTP, integration tests against real Zoekt  
**Target Platform**: Node.js 18+ (LTS), deployed as Docker container or CLI  
**Project Type**: Single project (MCP server wrapping Zoekt HTTP API)  
**Performance Goals**: Search response <2s for 100-repo indexes, health check <500ms  
**Constraints**: 3 runtime dependencies only (MCP SDK, Zod, Pino). No frameworks, no abstractions.  
**Scale/Scope**: 1000+ indexed repositories, single MCP server instance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MCP Protocol Compliance | PASS | No changes to MCP tool schemas or Zod validation. Tool descriptions may be updated for clarity. |
| II. Zoekt Integration Fidelity | PASS | This change *improves* fidelity — moves from abusing `/api/search` to using `/api/list` as Zoekt intends. |
| III. Minimal Dependencies | PASS | No new dependencies added. |
| IV. Query-First API Design | PASS | The `filter` parameter on `list_repos` remains a structural concern (which repos to list), not a query filter. No Zoekt query syntax changes. |
| V. Explicit Error Handling | PASS | All existing error codes preserved (UNAVAILABLE, QUERY_ERROR, TIMEOUT). Error handling for `/api/list` follows same pattern as `/api/search`. |
| VI. Observability & Debugging | PASS | Existing Pino logging pattern preserved. Stats in output become more accurate. |
| VII. Simplicity First (YAGNI) | PASS | Replacing a broken hack (search + FileMatches dedup) with a direct API call is simpler. New types model the actual Zoekt response shape. No premature abstractions. |
| TypeScript Strict Mode | PASS | Existing strict tsconfig preserved. New types will have precise field typing. |
| Test-Driven Development | PASS | Unit tests updated for new API call shapes. Integration test validates against real Zoekt. |
| Incremental Delivery | PASS | Single PR — `listRepos()` and `getStats()` are internal methods; swapping implementation is atomic with no feature flag needed. |

## Project Structure

### Documentation (this feature)

```text
specs/005-zoekt-list-api/
├── plan.md              # This file
├── research.md          # Phase 0: Zoekt API research findings
├── data-model.md        # Phase 1: TypeScript type definitions
├── quickstart.md        # Phase 1: Implementation guide
├── contracts/           # Phase 1: API contract (Zoekt /api/list request/response)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (affected files in zoekt-mcp/)

```text
zoekt-mcp/
├── src/
│   ├── zoekt/
│   │   ├── client.ts          # MODIFY: Rewrite listRepos() and getStats() to use /api/list
│   │   └── types.ts           # MODIFY: Add /api/list response types, enrich Repository
│   ├── server.ts              # MODIFY: Update formatRepoList() for richer metadata
│   └── tools/
│       └── get-health.ts      # MODIFY: IndexStats gains shardCount field
└── tests/
    └── unit/
        ├── zoekt-client.test.ts    # MODIFY: Update mocks for /api/list call shape
        └── tools/
            └── get-health.test.ts  # MODIFY: Update getStats mock shapes
```

**Structure Decision**: Single project, no structural changes. All modifications are within existing files in `zoekt-mcp/src/zoekt/`, `zoekt-mcp/src/server.ts`, `zoekt-mcp/src/tools/`, and `zoekt-mcp/tests/unit/`. No new files needed in `src/`.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
