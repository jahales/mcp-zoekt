# Data Model: Zoekt MCP Infrastructure

**Feature**: 001-zoekt-mcp-infra  
**Date**: 2026-01-30

## Overview

This feature doesn't require a persistent database. Data flows through the system as follows:
- **Zoekt indexes**: Stored on disk by zoekt-indexserver, read by zoekt-webserver
- **Search requests/responses**: Transient, handled by MCP server
- **Configuration**: JSON files for indexer, environment variables for MCP server

## Entities

### Configuration (Static)

```typescript
// MCP Server Configuration (from environment/CLI)
interface McpServerConfig {
  zoektUrl: string;         // e.g., "http://localhost:6070"
  transport: "stdio" | "http";
  port?: number;            // For HTTP transport
  host?: string;            // For HTTP transport
  logLevel: "debug" | "info" | "warn" | "error";
  timeoutMs: number;        // Request timeout
}

// Docker Indexer Configuration (from JSON file)
interface IndexerConfigEntry {
  GithubOrg?: string;       // Organization to index
  GithubUser?: string;      // User to index (alternative to org)
  GitHubURL?: string;       // GitHub Enterprise URL (optional)
  CredentialPath: string;   // Path to token file
  Name?: string;            // Regex to filter repo names
  Exclude?: string;         // Regex to exclude repos
  Topics?: string[];        // Filter by topics
  ExcludeTopics?: string[]; // Exclude by topics
  NoArchived?: boolean;     // Skip archived repos
  Forks?: boolean;          // Include forks
  Visibility?: ("public" | "private" | "internal")[];
}
```

### Search Domain (Runtime)

```typescript
// Search Request (from MCP tool)
interface SearchInput {
  query: string;            // Zoekt query syntax
  limit?: number;           // Max results (default: 30, max: 100)
  contextLines?: number;    // Lines of context (default: 3, max: 10)
}

// Search Response (from Zoekt API)
interface SearchResponse {
  result: {
    FileMatches?: FileMatch[];
    Stats?: SearchStats;
  };
}

interface FileMatch {
  Repository: string;       // e.g., "github.com/org/repo"
  FileName: string;         // e.g., "src/auth/handler.ts"
  Branches: string[];       // e.g., ["HEAD", "main"]
  Language: string;         // e.g., "TypeScript"
  Matches: LineMatch[];
}

interface LineMatch {
  LineNum: number;
  Line: string;             // Base64 encoded content
  Before?: string[];        // Context lines before
  After?: string[];         // Context lines after
}

interface SearchStats {
  MatchCount: number;
  FileCount: number;
  Duration: number;         // Nanoseconds
  ContentBytesLoaded: number;
  IndexBytesLoaded: number;
}
```

### Repository Domain (Runtime)

```typescript
// List Repos Request
interface ListReposInput {
  filter?: string;          // Optional name filter pattern
}

// Repository Metadata (from Zoekt)
interface Repository {
  name: string;             // e.g., "github.com/org/repo"
  branches: string[];
  fileCount?: number;
  indexTime?: Date;
}

// File Content Request
interface FileContentInput {
  repository: string;       // Full repo name
  path: string;             // File path within repo
  branch?: string;          // Optional branch (default: HEAD)
}
```

## State Transitions

### Indexing Pipeline (Docker Infrastructure)

```
[GitHub Repos] 
    ↓ zoekt-mirror-github (periodic)
[Local Git Clones] → /data/repos/
    ↓ zoekt-git-index
[Zoekt Indexes] → /data/index/
    ↓ zoekt-webserver (serves)
[HTTP API :6070]
```

### Search Request Flow (MCP Server)

```
[AI Agent]
    ↓ MCP Protocol (stdio/HTTP)
[MCP Server]
    ↓ HTTP GET /search
[Zoekt Webserver]
    ↓ Read from index
[Search Results]
    ↓ Format as text
[MCP Response]
```

## Validation Rules

| Field | Validation |
|-------|------------|
| `query` | Non-empty string; Zoekt validates syntax |
| `limit` | Integer 1-100 |
| `contextLines` | Integer 0-10 |
| `repository` | Non-empty string; must exist in index |
| `path` | Non-empty string; relative path |
| `CredentialPath` | File must exist and be readable |

## Data Retention

| Data | Retention | Location |
|------|-----------|----------|
| Git clones | Until repo deleted from config | `/data/repos/` volume |
| Zoekt indexes | Until re-indexed | `/data/index/` volume |
| Search logs | Ephemeral (container lifetime) | Container stdout |
| Request/response | Not persisted | Memory only |
