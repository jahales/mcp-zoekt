import type { SearchResponse, Repository, SearchInput } from './types.js';

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
   */
  async search(
    query: string,
    options: { limit?: number; contextLines?: number }
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      num: String(options.limit ?? 30),
      ctx: String(options.contextLines ?? 3),
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;
    
    try {
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new ZoektError(
          `Query error: ${errorText || response.statusText}`,
          'QUERY_ERROR',
          response.status
        );
      }

      return await response.json() as SearchResponse;
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
   */
  async listRepos(filter?: string): Promise<Repository[]> {
    // Use type:repo query to get list of repositories
    const query = filter ? `type:repo ${filter}` : 'type:repo';
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      num: '1000', // Get enough results to capture all repos
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;
    
    try {
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new ZoektError(
          `Failed to list repositories: ${errorText || response.statusText}`,
          'QUERY_ERROR',
          response.status
        );
      }

      const data = await response.json() as SearchResponse;
      const fileMatches = data.result?.FileMatches ?? [];
      
      // Extract unique repositories from file matches
      const repoMap = new Map<string, Set<string>>();
      for (const match of fileMatches) {
        const repoName = match.Repo ?? match.Repository;
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
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
