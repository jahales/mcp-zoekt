# Data Model: Zoekt MCP Tools Enhancement

**Date**: 2026-01-31  
**Spec**: [spec.md](./spec.md)

## Overview

This document defines the data entities and their relationships for the Zoekt MCP Tools feature. All entities are derived from the feature specification requirements.

---

## Entities

### 1. Symbol

A code symbol indexed by Zoekt via ctags integration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Symbol name (e.g., "handleRequest") |
| `kind` | SymbolKind | ✅ | Type of symbol |
| `parent` | string | ❌ | Parent symbol name (e.g., "UserService") |
| `parentKind` | SymbolKind | ❌ | Parent symbol type |
| `file` | string | ✅ | File path containing the symbol |
| `repository` | string | ✅ | Repository name |
| `line` | number | ✅ | 1-based line number |
| `column` | number | ✅ | 1-based column number |

**SymbolKind Enum:**
- `function`
- `class`
- `method`
- `variable`
- `interface`
- `type`
- `constant`
- `property`
- `unknown`

**Relationships:**
- Symbol → 1 FileMatch (symbol exists in a file)
- Symbol → 0..1 Parent Symbol (nested within another symbol)

**Validation Rules:**
- `name` must be non-empty
- `kind` defaults to `unknown` if not provided by ctags
- `line` must be ≥ 1

---

### 2. FileMatch

A file matching a search query, with optional content matches.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileName` | string | ✅ | File path within repository |
| `repository` | string | ✅ | Full repository name |
| `branches` | string[] | ✅ | Branches containing this file |
| `language` | string | ❌ | Detected programming language |
| `matches` | ContentMatch[] | ❌ | Content matches (empty for filename-only search) |
| `score` | number | ❌ | Relevance score |

**Relationships:**
- FileMatch → 0..* ContentMatch (file contains matching content)
- FileMatch → 1 Repository (file belongs to a repo)

**Validation Rules:**
- `fileName` must be non-empty
- `branches` must have at least one entry

---

### 3. ContentMatch

A matching region within a file's content.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | ✅ | Matched content with context |
| `lineNumber` | number | ✅ | Starting line number (1-based) |
| `column` | number | ✅ | Starting column (1-based) |
| `ranges` | Range[] | ✅ | Highlighted match ranges |
| `symbol` | Symbol | ❌ | Symbol info if this is a symbol match |

**Relationships:**
- ContentMatch → 0..* Range (match has highlight regions)
- ContentMatch → 0..1 Symbol (match may be a symbol)

---

### 4. Range

A text range within content, used for highlighting.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startLine` | number | ✅ | Start line (1-based) |
| `startColumn` | number | ✅ | Start column (1-based) |
| `endLine` | number | ✅ | End line (1-based) |
| `endColumn` | number | ✅ | End column (1-based, exclusive) |

---

### 5. SearchCursor

Stateless pagination cursor for traversing large result sets.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `queryHash` | string | ✅ | SHA-256 hash of the query string |
| `offset` | number | ✅ | Number of results already returned |
| `limit` | number | ✅ | Page size used for this cursor |

**Encoding:** Base64-encoded JSON string

**Example:**
```
eyJxIjoiYWJjMTIzIiwibyI6NTAsImwiOjUwfQ==
```

**Validation Rules:**
- `queryHash` must match the current query (prevents cursor reuse across queries)
- `offset` must be ≥ 0
- `limit` must be 1-100

**State Transitions:**
- Created when first page has more results
- Updated (new offset) for each subsequent page
- Null/absent when no more results

---

### 6. ReferenceResult

A location where a symbol is defined or used.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | ReferenceType | ✅ | Whether this is a definition or usage |
| `file` | string | ✅ | File path |
| `repository` | string | ✅ | Repository name |
| `line` | number | ✅ | Line number (1-based) |
| `column` | number | ✅ | Column number (1-based) |
| `context` | string | ✅ | Surrounding code context |
| `symbol` | Symbol | ❌ | Symbol info (for definitions) |

**ReferenceType Enum:**
- `definition` - Where the symbol is declared
- `usage` - Where the symbol is referenced

**Relationships:**
- ReferenceResult → 0..1 Symbol (definitions include symbol metadata)

---

### 7. HealthStatus

Server and backend operational status.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | HealthState | ✅ | Overall health status |
| `serverVersion` | string | ✅ | MCP server version |
| `zoektReachable` | boolean | ✅ | Zoekt backend connectivity |
| `zoektVersion` | string | ❌ | Zoekt backend version (if reachable) |
| `indexStats` | IndexStats | ❌ | Index statistics (if reachable) |
| `errorMessage` | string | ❌ | Error details (if unhealthy) |

**HealthState Enum:**
- `healthy` - All systems operational
- `degraded` - Partial functionality available
- `unhealthy` - System not operational

---

### 8. IndexStats

Statistics about the indexed repositories.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repositoryCount` | number | ✅ | Number of indexed repositories |
| `documentCount` | number | ✅ | Number of indexed files |
| `indexBytes` | number | ✅ | Index memory usage in bytes |
| `contentBytes` | number | ✅ | Content memory usage in bytes |

---

### 9. StructuredError

Enhanced error response with actionable information.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | ErrorCode | ✅ | Machine-readable error code |
| `message` | string | ✅ | Human-readable error message |
| `hint` | string | ❌ | Actionable suggestion for resolution |
| `details` | object | ❌ | Additional error context |

**ErrorCode Enum:**
- `UNAVAILABLE` - Backend not reachable
- `QUERY_ERROR` - Invalid query syntax
- `TIMEOUT` - Request timed out
- `NOT_FOUND` - Requested resource not found

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐
│   Repository    │────<│    FileMatch    │
└─────────────────┘     └────────┬────────┘
                                 │
                                 │ contains
                                 ▼
                        ┌─────────────────┐
                        │  ContentMatch   │
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
      ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
      │    Symbol    │   │    Range     │   │ReferenceResult│
      └──────────────┘   └──────────────┘   └──────────────┘

┌─────────────────┐     ┌─────────────────┐
│  SearchCursor   │     │  HealthStatus   │
└─────────────────┘     └────────┬────────┘
                                 │
                                 │ includes
                                 ▼
                        ┌─────────────────┐
                        │   IndexStats    │
                        └─────────────────┘
```

---

## Type Mappings

### Zoekt API → MCP Entities

| Zoekt Type | MCP Entity | Notes |
|------------|------------|-------|
| `FileMatch` | `FileMatch` | Direct mapping |
| `ChunkMatch` | `ContentMatch` | Decode base64 content |
| `Symbol` | `Symbol` | Map Kind values |
| `Location` | Part of `Range` | Convert 0-based → 1-based |
| `RepoStats` | `IndexStats` | Subset of fields |

### MCP Entities → TypeScript Types

See [contracts/tools.ts](./contracts/tools.ts) for full TypeScript type definitions.
