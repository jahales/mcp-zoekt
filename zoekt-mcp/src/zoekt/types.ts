/**
 * Zoekt API Types
 * Based on zoekt-webserver JSON response format
 */

// Search Request types
export interface SearchInput {
  query: string;
  limit?: number;
  contextLines?: number;
}

// Search Response types from Zoekt API
export interface SearchResponse {
  result: SearchResult;
}

export interface SearchResult {
  FileMatches?: FileMatch[];
  Files?: FileMatch[];  // Alternative field name from /api/search endpoint
  RepoURLs?: Record<string, string[]>;
  Stats?: SearchStats;
  // Inline stats from /api/search endpoint
  MatchCount?: number;
  FileCount?: number;
  Duration?: number;
  ContentBytesLoaded?: number;
  IndexBytesLoaded?: number;
}

export interface FileMatch {
  Repository?: string;
  Repo?: string;  // Alternative field name used by newer API
  FileName: string;
  Branches: string[];
  Language: string;
  ChunkMatches?: ChunkMatch[];
  // Legacy format
  LineMatches?: LineMatch[];
}

export interface ChunkMatch {
  Content: string;  // Base64 encoded
  ContentStart: ContentPosition;
  Ranges: MatchRange[];
  FileName: boolean;
  SymbolInfo?: (SymbolInfo | null)[];  // Array aligned with Ranges
}

export interface ContentPosition {
  ByteOffset: number;
  LineNumber: number;
  Column: number;
}

export interface MatchRange {
  Start: ContentPosition;
  End: ContentPosition;
}

export interface LineMatch {
  Line: string;  // Base64 encoded
  LineNumber: number;
  LineStart: number;
  LineEnd: number;
  Before?: string;
  After?: string;
}

export interface SearchStats {
  MatchCount: number;
  FileCount: number;
  Duration: number;  // nanoseconds
  ContentBytesLoaded: number;
  IndexBytesLoaded: number;
  Crashes?: number;
  FilesConsidered?: number;
  FilesLoaded?: number;
  FilesSkipped?: number;
  ShardsScanned?: number;
  ShardsSkipped?: number;
}

// List Repos types
export interface ListReposInput {
  filter?: string;
}

export interface Repository {
  name: string;
  branches: string[];
  fileCount?: number;
  indexTime?: Date;
}

export interface ListReposResponse {
  repositories: Repository[];
  total: number;
}

// File Content types
export interface FileContentInput {
  repository: string;
  path: string;
  branch?: string;
}

export interface FileContentResponse {
  content: string;
  repository: string;
  path: string;
  branch: string;
}

// Symbol types (from ctags integration)
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

/** Symbol information from Zoekt's ctags integration */
export interface SymbolInfo {
  /** Symbol name (e.g., "handleRequest") */
  Sym: string;
  /** Symbol type (e.g., "function", "class") */
  Kind: string;
  /** Parent symbol name (e.g., "UserService") */
  Parent: string;
  /** Parent symbol type */
  ParentKind: string;
}

/** Parsed symbol with normalized types */
export interface Symbol {
  name: string;
  kind: SymbolKind;
  parent?: string;
  parentKind?: SymbolKind;
  file: string;
  repository: string;
  line: number;
  column: number;
}

/** Reference type for find_references */
export type ReferenceType = 'definition' | 'usage';

/** A location where a symbol is defined or used */
export interface ReferenceResult {
  type: ReferenceType;
  file: string;
  repository: string;
  line: number;
  column: number;
  context: string;
  symbol?: Symbol;
}

// Health check types
export type HealthState = 'healthy' | 'degraded' | 'unhealthy';

/** Index statistics from Zoekt */
export interface IndexStats {
  repositoryCount: number;
  documentCount: number;
  indexBytes: number;
  contentBytes: number;
}

/** Health status response */
export interface HealthStatus {
  status: HealthState;
  serverVersion: string;
  zoektReachable: boolean;
  zoektVersion?: string;
  indexStats?: IndexStats;
  errorMessage?: string;
}

/** Raw health response from Zoekt /healthz endpoint */
export interface HealthResponse {
  result?: {
    Stats?: SearchStats;
  };
}

