# Implementation Plan: Pagination Logic Evaluation & Fix

**Branch**: `004-pagination-logic` | **Date**: February 3, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-pagination-logic/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix pagination logic across MCP tools (`search_symbols`, `search_files`, `find_references`) to ensure cursor validation allows changing `limit` between pages, add comprehensive test coverage for pagination edge cases, and verify limit handling correctly controls result counts.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode  
**Primary Dependencies**: @modelcontextprotocol/sdk, Zod (validation), Pino (logging)  
**Storage**: N/A (stateless pagination via cursor encoding)  
**Testing**: Vitest for unit tests, integration tests against mock Zoekt responses  
**Target Platform**: Node.js 18+ (LTS)  
**Project Type**: Single MCP server project  
**Performance Goals**: Search response <2 seconds, pagination completes within 5 seconds for page 10+  
**Constraints**: Maximum limit of 100 enforced, cursor must be valid base64-encoded JSON  
**Scale/Scope**: Pagination across 3 tools, ~10 edge cases to cover

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MCP Protocol Compliance | ✅ PASS | All tools have Zod schemas; pagination parameters properly defined |
| II. Zoekt Integration Fidelity | ✅ PASS | Limit maps to MaxDocDisplayCount; query syntax preserved |
| III. Minimal Dependencies | ✅ PASS | No new dependencies required; uses existing crypto module |
| IV. Query-First API Design | ✅ PASS | Pagination is structural (limit, cursor), not filtering |
| V. Explicit Error Handling | ✅ PASS | Cursor validation returns clear error messages |
| VI. Observability & Debugging | ✅ PASS | Pagination operations logged with query, limit, cursor |
| VII. Simplicity First (YAGNI) | ✅ PASS | Simplest fix: remove limit validation from cursor |

## Project Structure

### Documentation (this feature)

```text
specs/004-pagination-logic/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
zoekt-mcp/
├── src/
│   ├── pagination/
│   │   └── cursor.ts        # Cursor encode/decode/validate functions (TO MODIFY)
│   ├── tools/
│   │   ├── search-symbols.ts  # Uses pagination (verify limit handling)
│   │   ├── search-files.ts    # Uses pagination (verify limit handling)
│   │   └── find-references.ts # Uses pagination (verify limit handling)
│   └── zoekt/
│       └── client.ts          # Zoekt API client (limit → MaxDocDisplayCount)
└── tests/
    └── unit/
        ├── pagination/
        │   └── cursor.test.ts    # Cursor unit tests (TO EXTEND)
        └── tools/
            ├── search-symbols.test.ts  # Tool pagination tests (TO EXTEND)
            ├── search-files.test.ts    # Tool pagination tests (TO EXTEND)
            └── find-references.test.ts # Tool pagination tests (TO EXTEND)
```

**Structure Decision**: Single project structure. All pagination code is in `src/pagination/cursor.ts`. Tests follow mirror structure in `tests/unit/`.

## Complexity Tracking

> No constitution violations. No complexity justification needed.

---

## Phase Completion Status

### Phase 0: Research ✅ Complete

- **Output**: [research.md](research.md)
- All NEEDS CLARIFICATION items resolved
- 5 research questions answered with decisions and rationale

### Phase 1: Design & Contracts ✅ Complete

- **Output**: 
  - [data-model.md](data-model.md) - Entity definitions and cursor format change
  - [contracts/](contracts/) - API contracts and TypeScript type definitions
  - [quickstart.md](quickstart.md) - Developer implementation guide
  - Agent context updated via `update-agent-context.ps1`

### Constitution Re-Check (Post-Design)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MCP Protocol Compliance | ✅ PASS | Zod schemas unchanged; cursor parameter remains string |
| II. Zoekt Integration Fidelity | ✅ PASS | No changes to Zoekt client or query handling |
| III. Minimal Dependencies | ✅ PASS | No new dependencies; using existing crypto.createHash |
| IV. Query-First API Design | ✅ PASS | Design preserves current API; only internal changes |
| V. Explicit Error Handling | ✅ PASS | Contracts define clear error messages for validation |
| VI. Observability & Debugging | ✅ PASS | Existing logging preserved; no logging changes needed |
| VII. Simplicity First (YAGNI) | ✅ PASS | Simplified design: removed limit from cursor entirely |

### Phase 2: Task Breakdown ✅ Complete

- **Output**: [tasks.md](tasks.md)
- 39 total tasks across 7 phases
- Organized by user story (US1-US4) for independent implementation
- Estimated time: ~2.5 hours

---

## Next Steps

1. ~~Run `/speckit.tasks` to generate task breakdown~~ ✅ Done
2. Implement changes following [quickstart.md](quickstart.md)
3. Verify all tests pass
4. Create PR for review
