# code-search Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-30

## Active Technologies
- TypeScript 5.x, Node.js 18+ + Vitest 2.x (projects feature), @modelcontextprotocol/sdk (test client), node:child_process (subprocess spawning) (002-e2e-integration-tests)
- N/A (tests use embedded fixture files) (002-e2e-integration-tests)
- TypeScript 5.x with strict mode + @modelcontextprotocol/sdk ^1.0.0, zod ^3.0.0, pino ^8.0.0 (003-zoekt-mcp-tools)
- N/A (stateless server; Zoekt manages index storage) (003-zoekt-mcp-tools)
- TypeScript 5.x with strict mode + @modelcontextprotocol/sdk, Zod (validation), Pino (logging) (004-pagination-logic)
- N/A (stateless pagination via cursor encoding) (004-pagination-logic)

- TypeScript 5.x, Node.js 18+ + `@modelcontextprotocol/sdk`, `zod`, `pino` (logging) (001-zoekt-mcp-infra)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x, Node.js 18+: Follow standard conventions

## Recent Changes
- 004-pagination-logic: Added TypeScript 5.x with strict mode + @modelcontextprotocol/sdk, Zod (validation), Pino (logging)
- 003-zoekt-mcp-tools: Added TypeScript 5.x with strict mode + @modelcontextprotocol/sdk ^1.0.0, zod ^3.0.0, pino ^8.0.0
- 002-e2e-integration-tests: Added TypeScript 5.x, Node.js 18+ + Vitest 2.x (projects feature), @modelcontextprotocol/sdk (test client), node:child_process (subprocess spawning)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
