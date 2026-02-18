# Implementation Plan: Working Tree Indexing & Multi-Org Support

**Branch**: `008-workingtree-multi-org` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/008-workingtree-multi-org/spec.md`

## Summary

Add working-tree indexing (local directory search without GitHub), fix null-safety crashes when branch/range data is missing, support multiple GitHub organizations via comma-separated `GITHUB_ORGS`, and enable dual-mode (local + GitHub simultaneously). Docker Compose profiles control which services start. MCP TypeScript server gets defensive null-checks across 6 code locations. No new runtime dependencies; no Zoekt fork required.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022 target, NodeNext modules, strict mode)  
**Primary Dependencies**: `@modelcontextprotocol/sdk ^1.25.2`, `pino ^9.0.0`, `zod ^3.23.0`  
**Storage**: Zoekt index files on Docker volumes (`/data/index`), no database  
**Testing**: Vitest 2.x — 172 existing tests across 12 files (unit + integration)  
**Target Platform**: Linux containers (Node.js 18+ runtime), Docker Compose orchestration  
**Project Type**: Monorepo — `zoekt-mcp/` (TypeScript MCP server) + `docker/` (infrastructure)  
**Performance Goals**: Index refresh within configured interval (30s–3600s); no MCP latency regression  
**Constraints**: No Zoekt Go fork for v1; upstream `zoekt-index -ignore_dirs` for exclusions  
**Scale/Scope**: Single developer machine or small team; 1–5 GitHub orgs; working trees up to ~100k files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | MCP Protocol Compliance | ✅ PASS | Tool schemas updated with Zod; `branch` becomes `.optional()` |
| II | Zoekt Integration Fidelity | ✅ PASS | Uses upstream zoekt-index; no query modifications |
| III | Minimal Dependencies | ✅ PASS | Zero new runtime dependencies added |
| IV | Query-First API Design | ✅ PASS | Only structural parameter (`branch`) changed; no filtering added |
| V | Explicit Error Handling | ✅ PASS | Null-safety fixes use defensive checks with fallback values |
| VI | Observability & Debugging | ✅ PASS | Existing Pino logging preserved; Docker services log sync cycles |
| VII | Simplicity First (YAGNI) | ✅ PASS | No Zoekt fork, no abstractions; shell loop for multi-org |

**Pre-design gate**: ✅ ALL PASS  
**Post-design re-check**: ✅ ALL PASS — contracts add no new abstractions, no new deps, no query modifications

## Project Structure

### Documentation (this feature)

```text
specs/008-workingtree-multi-org/
├── plan.md              # This file
├── research.md          # Phase 0: 6 research decisions (R1–R6)
├── data-model.md        # Phase 1: Entity updates and state transitions
├── quickstart.md        # Phase 1: End-to-end validation scenarios
├── contracts/
│   ├── docker-infra.md  # Docker Compose profiles, services, env vars
│   └── mcp-null-safety.md  # 6 TypeScript change contracts (before/after)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
docker/
├── docker-compose.yml       # MODIFIED: profiles (workingtree, github), new zoekt-indexer service
├── .env.example             # NEW: configuration template with all env vars documented
├── update-index.sh          # MODIFIED or NEW: working-tree index script
├── Dockerfile.zoekt         # EXISTING: already builds zoekt-index binary
└── config/
    └── mirror-config.json   # EXISTING: GitHub mirror config

zoekt-mcp/src/
├── zoekt/
│   ├── types.ts             # MODIFIED: Branches?: string[], Ranges optional
│   └── client.ts            # MODIFIED: branch param optional in getFileContent
├── server.ts                # MODIFIED: 3 changes — schema, formatSearchResults, formatFileContent
├── formatting/
│   └── repoList.ts          # MODIFIED: null-guard on branches
└── tools/
    └── find-references.ts   # MODIFIED: optional chaining on Ranges

zoekt-mcp/tests/
├── unit/
│   └── null-safety.test.ts  # NEW: tests for all null-safety paths
└── integration/
    └── workingtree.integration.test.ts  # NEW: working-tree mode integration tests
```

**Structure Decision**: Existing monorepo structure preserved. Changes span two areas: `docker/` for infrastructure (profiles, indexer service, multi-org sync) and `zoekt-mcp/src/` for TypeScript null-safety fixes. No new directories or abstractions introduced.

## Complexity Tracking

> No constitution violations detected. All changes follow existing patterns.
