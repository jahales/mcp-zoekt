# Quickstart: Running Integration Tests

**Feature**: 002-e2e-integration-tests  
**Date**: 2026-01-31

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Built Zoekt Docker image (`zoekt:local`)

## Quick Commands

```bash
# Run unit tests only (no infrastructure required)
cd zoekt-mcp
npm test

# Run integration tests (requires running Zoekt)
npm run test:integration

# Run all tests
npm run test:all
```

## Local Development Setup

### 1. Start Zoekt Infrastructure

```bash
# From repository root
cd docker

# Start infrastructure with test corpus
docker compose -f docker-compose.test.yml up -d

# Wait for health (should complete in ~30 seconds)
curl --retry 10 --retry-delay 3 --retry-connrefused http://localhost:6070/
```

### 2. Build the MCP Server

```bash
cd zoekt-mcp
npm install
npm run build
```

### 3. Run Integration Tests

```bash
# Run integration tests only
npm run test:integration

# Run with verbose output
npm run test:integration -- --reporter=verbose

# Run specific test file
npm run test:integration -- tests/integration/search-tool.integration.test.ts
```

### 4. Cleanup

```bash
cd docker
docker compose -f docker-compose.test.yml down -v
```

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests only (default, no infra needed) |
| `npm run test:integration` | Run integration tests (requires Zoekt) |
| `npm run test:all` | Run both unit and integration tests |
| `npm run test:integration -- --project unit` | Run specific project |

## Troubleshooting

### "Connection refused" errors

Zoekt infrastructure isn't running. Start it with:
```bash
docker compose -f docker/docker-compose.test.yml up -d
```

### "No matches found" when expected

The test corpus may not be indexed. Check indexer logs:
```bash
docker logs zoekt-indexserver
```

### Tests timeout

Increase the test timeout in `vitest.config.ts` or use:
```bash
npm run test:integration -- --test-timeout=60000
```

### MCP protocol tests fail with "spawn error"

Ensure the MCP server is built:
```bash
cd zoekt-mcp
npm run build
```

## CI Integration

Integration tests run automatically on every PR via GitHub Actions. See `.github/workflows/integration-tests.yml`.

The CI workflow:
1. Checks out code
2. Starts Docker Compose infrastructure
3. Waits for Zoekt health check
4. Runs `npm run test:integration`
5. Tears down infrastructure (even on failure)
