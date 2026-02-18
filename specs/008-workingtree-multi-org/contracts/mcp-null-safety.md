# Contract: MCP TypeScript Null-Safety Changes

**Feature**: 008-workingtree-multi-org  
**Date**: 2026-02-18

## Type Changes

### zoekt/types.ts — FileMatch

```typescript
// BEFORE
export interface FileMatch {
  Repository?: string;
  Repo?: string;
  FileName: string;
  Branches: string[];       // ← Required, crashes if missing
  Language: string;
  ChunkMatches?: ChunkMatch[];
  LineMatches?: LineMatch[];
}

// AFTER
export interface FileMatch {
  Repository?: string;
  Repo?: string;
  FileName: string;
  Branches?: string[];      // ← Optional, safe for working-tree results
  Language: string;
  ChunkMatches?: ChunkMatch[];
  LineMatches?: LineMatch[];
}
```

## API Changes

### zoekt/client.ts — getFileContent

```typescript
// BEFORE
async getFileContent(
  repository: string,
  path: string,
  branch: string = 'HEAD'
): Promise<string> {
  const params = new URLSearchParams({
    r: repository,
    f: path,
    b: branch,        // ← Always sends branch, even for working-tree
    format: 'raw',
  });

// AFTER
async getFileContent(
  repository: string,
  path: string,
  branch?: string       // ← Optional
): Promise<string> {
  const params = new URLSearchParams({
    r: repository,
    f: path,
    format: 'raw',
  });
  if (branch) {
    params.append('b', branch);   // ← Only send if specified
  }
```

### server.ts — file_content tool schema

```typescript
// BEFORE
branch: z.string().default('HEAD').describe(
  'Branch name (default: HEAD)'
),

// AFTER
branch: z.string().optional().describe(
  'Branch name (optional, defaults to HEAD or working tree)'
),
```

### server.ts — formatFileContent

```typescript
// BEFORE
function formatFileContent(
  repository: string,
  path: string,
  branch: string,
  content: string,
  language: string
): string {
  // ...
  output += `Branch: ${branch}\n\n`;

// AFTER
function formatFileContent(
  repository: string,
  path: string,
  branch: string | undefined,
  content: string,
  language: string
): string {
  // ...
  output += `Branch: ${branch || 'HEAD'}\n\n`;
```

### server.ts — formatSearchResults

```typescript
// BEFORE
output += `Language: ${match.Language || 'Unknown'} | Branch: ${match.Branches[0] || 'HEAD'}\n\n`;

// AFTER
output += `Language: ${match.Language || 'Unknown'} | Branch: ${match.Branches?.[0] || 'HEAD'}\n\n`;
```

### formatting/repoList.ts — branch guard

```typescript
// BEFORE
if (repo.branches.length > 0) {

// AFTER
if (repo.branches && repo.branches.length > 0) {
```

### tools/find-references.ts — Ranges guard

```typescript
// BEFORE
const column = chunk.Ranges[0]?.Start?.Column ?? chunk.ContentStart.Column;

// AFTER
const column = chunk.Ranges?.[0]?.Start?.Column ?? chunk.ContentStart.Column;
```

## Test Impact

All existing tests should continue to pass. New unit tests should verify:

1. `formatRepoList` handles repos with empty/undefined `branches`
2. `formatSearchResults` handles matches with null `Branches`
3. `getFileContent` omits `b` param when branch is undefined
4. `formatFileContent` displays "HEAD" when branch is undefined
5. `extractUsages` handles chunks with empty/undefined `Ranges`
