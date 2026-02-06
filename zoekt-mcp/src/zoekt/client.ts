import type { SearchResponse, Repository, HealthResponse, IndexStats, ZoektListResponse } from './types.js';

/**
 * Parse a Go date string, treating Go zero-value dates as undefined.
 * Go's zero time is 0001-01-01T00:00:00Z.
 */
function parseGoDate(dateStr: string | undefined | null): Date | undefined {
  if (!dateStr || dateStr.startsWith('0001-01-01')) {
    return undefined;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return undefined;
  }
  return date;
}

/**
 * Custom error class for Zoekt-related errors
 */
export class ZoektError extends Error {
  public readonly code: 'UNAVAILABLE' | 'QUERY_ERROR' | 'TIMEOUT' | 'NOT_FOUND';
  public readonly statusCode: number | undefined;

  constructor(
    message: string,
    code: 'UNAVAILABLE' | 'QUERY_ERROR' | 'TIMEOUT' | 'NOT_FOUND',
    statusCode?: number
  ) {
    super(message);
    this.name = 'ZoektError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * HTTP client for Zoekt webserver API
 */
export class ZoektClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, timeoutMs: number = 30000) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Search for code across indexed repositories
   * Uses POST /api/search endpoint with JSON payload
   */
  async search(
    query: string,
    options: { limit?: number; contextLines?: number }
  ): Promise<SearchResponse> {
    const url = `${this.baseUrl}/api/search`;
    const body = JSON.stringify({
      Q: query,
      Opts: {
        NumContextLines: options.contextLines ?? 3,
        MaxDocDisplayCount: options.limit ?? 30,
      },
    });
    
    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new ZoektError(
          `Query error: ${errorText || response.statusText}`,
          'QUERY_ERROR',
          response.status
        );
      }

      // The /api/search endpoint returns { Result: SearchResult }
      // Normalize Files -> FileMatches for consistent downstream usage
      const data = await response.json() as { Result: SearchResponse['result'] };
      const result = data.Result;
      if (result && result.Files && !result.FileMatches) {
        result.FileMatches = result.Files;
      }
      return { result };
    } catch (error) {
      if (error instanceof ZoektError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ZoektError(
          `Search timed out after ${this.timeoutMs}ms. Try a more specific query.`,
          'TIMEOUT'
        );
      }
      throw new ZoektError(
        `Search backend unavailable at ${this.baseUrl}. Ensure zoekt-webserver is running.`,
        'UNAVAILABLE'
      );
    }
  }

  /**
   * List indexed repositories
   * Uses POST /api/list endpoint for complete, accurate results
   */
  async listRepos(filter?: string): Promise<Repository[]> {
    // Validate and compile regex filter upfront if provided
    let filterRegex: RegExp | undefined;
    if (filter) {
      try {
        filterRegex = new RegExp(filter, 'i');
      } catch {
        throw new ZoektError(
          `Invalid filter pattern: '${filter}' is not a valid regular expression`,
          'QUERY_ERROR'
        );
      }
    }

    const url = `${this.baseUrl}/api/list`;
    const body = JSON.stringify({ Q: '' });
    
    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new ZoektError(
          `Failed to list repositories: ${errorText || response.statusText}`,
          'QUERY_ERROR',
          response.status
        );
      }

      const data = await response.json() as ZoektListResponse;

      // Validate response shape so malformed responses don't appear as "no repos indexed"
      const list = data?.List;
      if (!list || (list.Repos !== null && !Array.isArray(list.Repos))) {
        throw new ZoektError(
          'Malformed /api/list response: missing or invalid List.Repos field',
          'QUERY_ERROR'
        );
      }
      const entries = list.Repos ?? [];
      
      const repositories: Repository[] = entries.map((entry) => ({
        name: entry.Repository.Name,
        url: entry.Repository.URL ?? '',
        branches: (entry.Repository.Branches ?? []).map((b) => ({
          name: b.Name,
          version: b.Version,
        })),
        hasSymbols: entry.Repository.HasSymbols ?? false,
        documentCount: entry.Stats.Documents ?? 0,
        contentBytes: entry.Stats.ContentBytes ?? 0,
        indexBytes: entry.Stats.IndexBytes ?? 0,
        indexTime: parseGoDate(entry.IndexMetadata.IndexTime),
        latestCommitDate: parseGoDate(entry.Repository.LatestCommitDate),
      }));

      // Apply client-side filter if provided
      if (filterRegex) {
        return repositories.filter((repo) => filterRegex.test(repo.name));
      }

      return repositories;
    } catch (error) {
      if (error instanceof ZoektError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ZoektError(
          `List repositories timed out after ${this.timeoutMs}ms.`,
          'TIMEOUT'
        );
      }
      throw new ZoektError(
        `Zoekt backend unavailable at ${this.baseUrl}/api/list. Ensure zoekt-webserver is running.`,
        'UNAVAILABLE'
      );
    }
  }

  /**
   * Get file content from an indexed repository
   */
  async getFileContent(
    repository: string,
    path: string,
    branch: string = 'HEAD'
  ): Promise<string> {
    const params = new URLSearchParams({
      r: repository,
      f: path,
      b: branch,
      format: 'raw',
    });

    const url = `${this.baseUrl}/print?${params.toString()}`;
    
    try {
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new ZoektError(
            `File not found: ${repository}/${path}`,
            'NOT_FOUND',
            404
          );
        }
        const errorText = await response.text();
        throw new ZoektError(
          `Failed to get file content: ${errorText || response.statusText}`,
          'QUERY_ERROR',
          response.status
        );
      }

      return await response.text();
    } catch (error) {
      if (error instanceof ZoektError) {
        throw error;
      }
      throw new ZoektError(
        `Search backend unavailable at ${this.baseUrl}. Ensure zoekt-webserver is running.`,
        'UNAVAILABLE'
      );
    }
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    options?: { method?: string; headers?: Record<string, string>; body?: string }
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        method: options?.method ?? 'GET',
        signal: controller.signal,
      };
      if (options?.headers) {
        fetchOptions.headers = options.headers;
      }
      if (options?.body) {
        fetchOptions.body = options.body;
      }
      const response = await fetch(url, fetchOptions);
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check Zoekt backend health via /healthz endpoint
   */
  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    const url = `${this.baseUrl}/healthz`;
    
    try {
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        return { healthy: false, error: errorText || response.statusText };
      }

      // Parse response to confirm it's valid
      await response.json() as HealthResponse;
      return { healthy: true };
    } catch (error) {
      if (error instanceof Error) {
        return { healthy: false, error: error.message };
      }
      return { healthy: false, error: 'Unknown error checking health' };
    }
  }

  /**
   * Get index statistics via POST /api/list endpoint
   * Returns aggregate stats across all indexed repositories
   */
  async getStats(): Promise<IndexStats> {
    const url = `${this.baseUrl}/api/list`;
    const body = JSON.stringify({ Q: '' });
    
    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      
      if (!response.ok) {
        throw new ZoektError(
          'Failed to get index stats',
          'QUERY_ERROR',
          response.status
        );
      }

      const data = await response.json() as ZoektListResponse;

      const stats = data?.List?.Stats;
      if (!stats) {
        throw new ZoektError(
          'Malformed /api/list response: missing List.Stats field',
          'QUERY_ERROR'
        );
      }

      return {
        repositoryCount: stats.Repos ?? 0,
        documentCount: stats.Documents ?? 0,
        indexBytes: stats.IndexBytes ?? 0,
        contentBytes: stats.ContentBytes ?? 0,
        shardCount: stats.Shards ?? 0,
      };
    } catch (error) {
      if (error instanceof ZoektError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ZoektError(
          `Get stats timed out after ${this.timeoutMs}ms.`,
          'TIMEOUT'
        );
      }
      throw new ZoektError(
        `Zoekt backend unavailable at ${this.baseUrl}/api/list. Ensure zoekt-webserver is running.`,
        'UNAVAILABLE'
      );
    }
  }
}
