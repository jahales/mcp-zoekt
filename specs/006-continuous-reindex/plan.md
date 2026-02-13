# Implementation Plan: Continuous Reindex for Docker Compose

**Branch**: `006-continuous-reindex` | **Date**: 2026-02-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-continuous-reindex/spec.md`

## Summary

The local-dev `docker-compose.yml` currently runs mirror and index as one-shot tasks, causing the search index to go stale after startup. This plan merges both operations into a single long-lived container that loops: mirror → index → sleep → repeat. The sync interval is configurable via environment variable with a 3600-second default. Error handling ensures transient failures don't crash the loop. The README is updated accordingly.

## Technical Context

**Language/Version**: POSIX shell (BusyBox/Alpine)  
**Primary Dependencies**: zoekt-mirror-github, zoekt-git-index (already in `zoekt:local` image)  
**Storage**: Docker volume (`zoekt-data`) — shared between sync and webserver containers  
**Testing**: Manual integration test via `docker compose up` + commit push + search verification  
**Target Platform**: Local developer workstation (Docker Desktop on macOS/Windows/Linux)  
**Project Type**: Infrastructure / Docker Compose configuration  
**Performance Goals**: N/A — sync interval is configurable; no latency SLA  
**Constraints**: Must use only BusyBox-compatible shell commands (Alpine base image)  
**Scale/Scope**: Single Docker Compose stack indexing one GitHub organization

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. MCP Protocol Compliance | N/A | No MCP server code is modified |
| II. Zoekt Integration Fidelity | N/A | No query features are modified |
| III. Minimal Dependencies | PASS | No new dependencies; only BusyBox shell builtins |
| IV. Query-First API Design | N/A | No API changes |
| V. Explicit Error Handling | PASS | FR-004/FR-008: errors logged, loop continues |
| VI. Observability & Debugging | PASS | FR-007: ISO 8601 timestamped start/end logging |
| VII. Simplicity First (YAGNI) | PASS | Shell `while/sleep` loop is simplest possible; no cron, no scheduler |

**Post-Phase-1 Re-check**: All gates still pass. The merged-container design is simpler than the original two-container architecture. No complexity violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-continuous-reindex/
├── plan.md              # This file
├── research.md          # Phase 0 output — R1-R6 decisions
├── data-model.md        # Phase 1 output — entity/config model
├── quickstart.md        # Phase 1 output — verification steps
├── contracts/           # Phase 1 output — docker-compose service contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
docker/
├── docker-compose.yml       # MODIFIED — merge mirror+indexserver into zoekt-sync
├── docker-compose.prod.yml  # UNCHANGED — uses profiles + cron via update-index.sh
├── docker-compose.test.yml  # UNCHANGED — test corpus, one-shot indexing
├── README.md                # MODIFIED — update service docs, env var reference
└── update-index.sh          # UNCHANGED — production cron script
```

**Structure Decision**: This feature modifies only `docker/docker-compose.yml` and `docker/README.md`. No new files are created in the source tree. The prod and test compose files are unaffected.
