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
  RepoURLs?: Record<string, string[]>;
  Stats?: SearchStats;
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
