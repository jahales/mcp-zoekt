/**
 * Zoekt MCP Tools - API Contracts
 * 
 * TypeScript type definitions for new MCP tools.
 * These types define the input schemas and response formats.
 * 
 * @module contracts/tools
 */

// =============================================================================
// ENUMS
// =============================================================================

/** Types of code symbols indexed by ctags */
export type SymbolKind = 
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'interface'
  | 'type'
  | 'constant'
  | 'property'
  | 'unknown';

/** Reference types for find_references results */
export type ReferenceType = 'definition' | 'usage';

/** Health status states */
export type HealthState = 'healthy' | 'degraded' | 'unhealthy';

/** Structured error codes */
export type ErrorCode = 'UNAVAILABLE' | 'QUERY_ERROR' | 'TIMEOUT' | 'NOT_FOUND';

// =============================================================================
// CORE ENTITIES
// =============================================================================

/** A code symbol (function, class, method, etc.) */
export interface Symbol {
  /** Symbol name (e.g., "handleRequest") */
  name: string;
  /** Type of symbol */
  kind: SymbolKind;
  /** Parent symbol name, if nested */
  parent?: string;
  /** Parent symbol type */
  parentKind?: SymbolKind;
  /** File path containing the symbol */
  file: string;
  /** Repository name */
  repository: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
}

/** A text range for highlighting */
export interface Range {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/** A matching region within file content */
export interface ContentMatch {
  /** Matched content with context */
  content: string;
  /** Starting line number (1-based) */
  lineNumber: number;
  /** Starting column (1-based) */
  column: number;
  /** Highlighted match ranges */
  ranges: Range[];
  /** Symbol info if this is a symbol match */
  symbol?: Symbol;
}

/** A file matching a search query */
export interface FileMatch {
  /** File path within repository */
  fileName: string;
  /** Full repository name */
  repository: string;
  /** Branches containing this file */
  branches: string[];
  /** Detected programming language */
  language?: string;
  /** Content matches (empty for filename-only search) */
  matches?: ContentMatch[];
  /** Relevance score */
  score?: number;
}

/** Pagination cursor (opaque to clients) */
export interface SearchCursor {
  /** SHA-256 hash of query string */
  queryHash: string;
  /** Number of results already returned */
  offset: number;
  /** Page size */
  limit: number;
}

/** Index statistics */
export interface IndexStats {
  /** Number of indexed repositories */
  repositoryCount: number;
  /** Number of indexed files */
  documentCount: number;
  /** Index memory usage in bytes */
  indexBytes: number;
  /** Content memory usage in bytes */
  contentBytes: number;
}

/** Health status response */
export interface HealthStatus {
  /** Overall health status */
  status: HealthState;
  /** MCP server version */
  serverVersion: string;
  /** Zoekt backend connectivity */
  zoektReachable: boolean;
  /** Zoekt backend version (if reachable) */
  zoektVersion?: string;
  /** Index statistics (if reachable) */
  indexStats?: IndexStats;
  /** Error details (if unhealthy) */
  errorMessage?: string;
}

/** A location where a symbol is defined or used */
export interface ReferenceResult {
  /** Whether this is a definition or usage */
  type: ReferenceType;
  /** File path */
  file: string;
  /** Repository name */
  repository: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Surrounding code context */
  context: string;
  /** Symbol info (for definitions) */
  symbol?: Symbol;
}

/** Structured error response */
export interface StructuredError {
  /** Machine-readable error code */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Actionable suggestion for resolution */
  hint?: string;
  /** Additional error context */
  details?: Record<string, unknown>;
}

// =============================================================================
// TOOL INPUT SCHEMAS
// =============================================================================

/** Input for search_symbols tool */
export interface SearchSymbolsInput {
  /**
   * Symbol search query.
   * 
   * Examples:
   * - `handleRequest` - Find symbols named handleRequest
   * - `handler lang:typescript` - TypeScript symbols matching "handler"
   * - `/^get.*/` - Symbols starting with "get" (regex)
   * - `UserService repo:myorg/myrepo` - Symbol in specific repo
   */
  query: string;
  
  /** Maximum number of results (1-100, default: 30) */
  limit?: number;
  
  /** Number of context lines around matches (0-10, default: 3) */
  contextLines?: number;
  
  /** Pagination cursor from previous response */
  cursor?: string;
}

/** Input for search_files tool */
export interface SearchFilesInput {
  /**
   * File name search query.
   * 
   * Examples:
   * - `package.json` - Exact filename match
   * - `.*\.test\.ts$` - TypeScript test files (regex)
   * - `README.md repo:myorg/myrepo` - README in specific repo
   * - `config lang:yaml` - YAML config files
   */
  query: string;
  
  /** Maximum number of results (1-100, default: 30) */
  limit?: number;
  
  /** Pagination cursor from previous response */
  cursor?: string;
}

/** Input for find_references tool */
export interface FindReferencesInput {
  /**
   * Symbol to find references for.
   * 
   * The tool searches for:
   * 1. Symbol definitions (using sym: query)
   * 2. Symbol usages (content search)
   * 
   * Examples:
   * - `handleRequest` - Find all references to handleRequest
   * - `UserService lang:typescript` - TypeScript only
   * - `validateInput repo:backend` - Within specific repo
   */
  symbol: string;
  
  /** Additional query filters (lang:, repo:, branch:, etc.) */
  filters?: string;
  
  /** Maximum number of results (1-100, default: 30) */
  limit?: number;
  
  /** Number of context lines around matches (0-10, default: 3) */
  contextLines?: number;
  
  /** Pagination cursor from previous response */
  cursor?: string;
}

/** Input for get_health tool (no input required) */
export interface GetHealthInput {
  // No parameters - health check is parameter-free
}

// =============================================================================
// TOOL OUTPUT SCHEMAS
// =============================================================================

/** Search statistics */
export interface SearchStats {
  /** Total matches found */
  matchCount: number;
  /** Files containing matches */
  fileCount: number;
  /** Search duration in milliseconds */
  durationMs: number;
}

/** Output for search_symbols tool */
export interface SearchSymbolsOutput {
  /** Query that was executed */
  query: string;
  /** Matched symbols */
  symbols: Symbol[];
  /** Search statistics */
  stats: SearchStats;
  /** Cursor for next page (if more results) */
  nextCursor?: string;
}

/** Output for search_files tool */
export interface SearchFilesOutput {
  /** Query that was executed */
  query: string;
  /** Matched files */
  files: FileMatch[];
  /** Search statistics */
  stats: SearchStats;
  /** Cursor for next page (if more results) */
  nextCursor?: string;
}

/** Output for find_references tool */
export interface FindReferencesOutput {
  /** Symbol that was searched */
  symbol: string;
  /** Definition locations */
  definitions: ReferenceResult[];
  /** Usage locations */
  usages: ReferenceResult[];
  /** Combined statistics */
  stats: {
    definitionCount: number;
    usageCount: number;
    durationMs: number;
  };
  /** Cursor for next page (if more results) */
  nextCursor?: string;
}

/** Output for get_health tool */
export interface GetHealthOutput {
  /** Health status */
  health: HealthStatus;
}

// =============================================================================
// ZOD SCHEMAS (for MCP tool registration)
// =============================================================================

/**
 * Zod schema definitions for MCP tool registration.
 * These are provided as documentation - actual implementation in src/tools/*.ts
 */
export const ZodSchemas = {
  searchSymbols: {
    query: 'z.string().describe("Symbol search query...")',
    limit: 'z.number().int().min(1).max(100).default(30)',
    contextLines: 'z.number().int().min(0).max(10).default(3)',
    cursor: 'z.string().optional()',
  },
  searchFiles: {
    query: 'z.string().describe("File name search query...")',
    limit: 'z.number().int().min(1).max(100).default(30)',
    cursor: 'z.string().optional()',
  },
  findReferences: {
    symbol: 'z.string().describe("Symbol to find references for")',
    filters: 'z.string().optional().describe("Additional query filters")',
    limit: 'z.number().int().min(1).max(100).default(30)',
    contextLines: 'z.number().int().min(0).max(10).default(3)',
    cursor: 'z.string().optional()',
  },
  getHealth: {
    // No parameters
  },
} as const;
