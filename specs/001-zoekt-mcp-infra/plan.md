# Implementation Plan: Zoekt MCP Infrastructure

**Branch**: `001-zoekt-mcp-infra` | **Date**: 2026-01-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-zoekt-mcp-infra/spec.md`

## Summary

Build a TypeScript MCP server that wraps Zoekt's search API, enabling AI coding assistants to search across hundreds of private GitHub repositories. The infrastructure includes Docker Compose configuration for running Zoekt's indexserver (to sync and index GitHub repos) and webserver (to serve the search API).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: `@modelcontextprotocol/sdk`, `zod`, `pino` (logging)  
**Storage**: Docker volumes for Zoekt indexes; no application database  
**Testing**: Vitest for unit tests, manual integration tests with MCP Inspector  
**Target Platform**: Linux/macOS/Windows (Node.js), Linux containers (Docker)
**Project Type**: Single project with Docker infrastructure  
**Performance Goals**: Search response <2s for 100 repos; handle 100 concurrent requests  
**Constraints**: Minimal dependencies; stdio + HTTP transport; graceful error handling  
**Scale/Scope**: 100-500 private GitHub repositories across multiple organizations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. MCP Protocol Compliance** | ✅ PASS | Using official `@modelcontextprotocol/sdk`; all tools have Zod schemas |
| **II. Zoekt Integration Fidelity** | ✅ PASS | HTTP client to zoekt-webserver preserves full query syntax |
| **III. Minimal Dependencies** | ✅ PASS | 3 runtime deps: MCP SDK, Zod, Pino |
| **IV. Explicit Error Handling** | ✅ PASS | Structured errors for backend unavailable, query errors, file not found |
| **V. Observability & Debugging** | ✅ PASS | Pino JSON logging, `--debug` flag, request logging |

## Project Structure

### Documentation (this feature)

```text
specs/001-zoekt-mcp-infra/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (MCP tool schemas)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
zoekt-mcp/                    # MCP Server (TypeScript)
├── src/
│   ├── index.ts              # CLI entrypoint
│   ├── server.ts             # MCP server setup
│   ├── config.ts             # Configuration handling
│   ├── logger.ts             # Pino logger setup
│   ├── tools/
│   │   ├── search.ts         # search tool
│   │   ├── list-repos.ts     # list_repos tool
│   │   └── file-content.ts   # file_content tool
│   └── zoekt/
│       ├── client.ts         # Zoekt HTTP client
│       └── types.ts          # Zoekt API types
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── README.md

docker/                       # Docker Infrastructure
├── docker-compose.yml        # Indexer + Webserver + Volume
├── config/
│   ├── mirror-config.json    # GitHub organizations to index
│   └── github-token.txt      # GitHub PAT (gitignored)
└── README.md                 # Docker setup instructions
```

**Structure Decision**: Single TypeScript project for MCP server; separate `docker/` directory for infrastructure. The MCP server connects to the Zoekt webserver via HTTP API.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
