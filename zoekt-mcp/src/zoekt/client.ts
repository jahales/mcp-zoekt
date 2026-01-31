import type { SearchResponse, Repository, HealthResponse, IndexStats } from './types.js';

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
   * Uses POST /api/search endpoint with type:repo query
   */
  async listRepos(filter?: string): Promise<Repository[]> {
    // Use type:repo query to get list of repositories
    const query = filter ? `type:repo ${filter}` : 'type:repo';
    const url = `${this.baseUrl}/api/search`;
    const body = JSON.stringify({
      Q: query,
      Opts: {
        MaxDocDisplayCount: 1000, // Get enough results to capture all repos
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
          `Failed to list repositories: ${errorText || response.statusText}`,
          'QUERY_ERROR',
          response.status
        );
      }

      const data = await response.json() as { Result: SearchResponse['result'] };
      const fileMatches = data.Result?.Files ?? data.Result?.FileMatches ?? [];
      
      // Extract unique repositories from file matches
      const repoMap = new Map<string, Set<string>>();
      for (const match of fileMatches) {
        const repoName = match.Repository;
        if (repoName) {
          if (!repoMap.has(repoName)) {
            repoMap.set(repoName, new Set());
          }
          for (const branch of match.Branches ?? ['HEAD']) {
            repoMap.get(repoName)!.add(branch);
          }
        }
      }

      const repositories: Repository[] = Array.from(repoMap.entries()).map(
        ([name, branches]) => ({
          name,
          branches: Array.from(branches),
        })
      );

      // Apply client-side filter if provided
      if (filter) {
        const filterRegex = new RegExp(filter, 'i');
        return repositories.filter((repo) => filterRegex.test(repo.name));
      }

      return repositories;
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
   * Get index statistics via type:repo query
   * Uses POST /api/search endpoint
   */
  async getStats(): Promise<IndexStats> {
    const url = `${this.baseUrl}/api/search`;
    const body = JSON.stringify({
      Q: 'type:repo',
      Opts: {
        MaxDocDisplayCount: 10000,
      },
    });
    
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

      const data = await response.json() as { Result: SearchResponse['result'] };
      const result = data.Result;
      const fileMatches = result?.Files ?? result?.FileMatches ?? [];
      
      // Count unique repositories
      const repos = new Set<string>();
      for (const match of fileMatches) {
        const repoName = match.Repository;
        if (repoName) {
          repos.add(repoName);
        }
      }

      return {
        repositoryCount: repos.size,
        documentCount: result?.FileCount ?? result?.Stats?.FileCount ?? 0,
        indexBytes: result?.IndexBytesLoaded ?? result?.Stats?.IndexBytesLoaded ?? 0,
        contentBytes: result?.ContentBytesLoaded ?? result?.Stats?.ContentBytesLoaded ?? 0,
      };
    } catch (error) {
      if (error instanceof ZoektError) {
        throw error;
      }
      throw new ZoektError(
        `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNAVAILABLE'
      );
    }
  }
}
