import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZoektClient, ZoektError } from '../../src/zoekt/client.js';
import type { SearchResponse } from '../../src/zoekt/types.js';

describe('ZoektClient', () => {
  let client: ZoektClient;

  beforeEach(() => {
    client = new ZoektClient('http://localhost:6070', 5000);
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search', () => {
    it('should call /api/search endpoint with POST and JSON body', async () => {
      // API response format from POST /api/search
      const mockApiResponse = {
        Result: {
          Files: [],
          MatchCount: 0,
          FileCount: 0,
          Duration: 1000000,
          ContentBytesLoaded: 0,
          IndexBytesLoaded: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      await client.search('test query', { limit: 30, contextLines: 3 });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"Q":"test query"'),
        })
      );

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string);
      expect(callBody.Q).toBe('test query');
      expect(callBody.Opts.MaxDocDisplayCount).toBe(30);
      expect(callBody.Opts.NumContextLines).toBe(3);
    });

    it('should throw ZoektError when backend is unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.search('test', {})).rejects.toThrow(ZoektError);
      await expect(client.search('test', {})).rejects.toThrow(/unavailable/i);
    });

    it('should throw ZoektError on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('query syntax error'),
      } as Response);

      await expect(client.search('bad[query', {})).rejects.toThrow(ZoektError);
    });

    it('should throw ZoektError on timeout', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      try {
        await client.search('slow query', {});
        expect.fail('Expected ZoektError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZoektError);
        expect((error as ZoektError).code).toBe('TIMEOUT');
        expect((error as ZoektError).message).toContain('timed out');
      }
    });
  });

  describe('listRepos', () => {
    it('should call /api/list endpoint and return all repositories', async () => {
      const mockApiResponse = {
        List: {
          Repos: [
            {
              Repository: { Name: 'github.com/org/repo1', URL: 'https://github.com/org/repo1', Branches: [{ Name: 'main', Version: 'abc1234567890' }], HasSymbols: true, LatestCommitDate: '2026-01-15T10:00:00Z' },
              IndexMetadata: { IndexTime: '2026-01-16T03:00:00Z' },
              Stats: { Repos: 0, Shards: 1, Documents: 100, IndexBytes: 5000, ContentBytes: 10000 },
            },
            {
              Repository: { Name: 'github.com/org/repo2', URL: 'https://github.com/org/repo2', Branches: [{ Name: 'main', Version: 'def4567890abc' }, { Name: 'develop', Version: 'ghi7890abcdef' }], HasSymbols: false, LatestCommitDate: '2026-01-10T08:00:00Z' },
              IndexMetadata: { IndexTime: '2026-01-11T02:00:00Z' },
              Stats: { Repos: 0, Shards: 1, Documents: 200, IndexBytes: 8000, ContentBytes: 20000 },
            },
          ],
          Stats: { Repos: 2, Shards: 2, Documents: 300, IndexBytes: 13000, ContentBytes: 30000 },
          Crashes: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const repos = await client.listRepos();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/list'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(repos).toHaveLength(2);
      expect(repos[0]!.name).toBe('github.com/org/repo1');
      expect(repos[0]!.branches).toEqual([{ name: 'main', version: 'abc1234567890' }]);
      expect(repos[0]!.hasSymbols).toBe(true);
      expect(repos[0]!.documentCount).toBe(100);
      expect(repos[0]!.contentBytes).toBe(10000);
      expect(repos[0]!.indexTime).toBeInstanceOf(Date);
      expect(repos[1]!.name).toBe('github.com/org/repo2');
      expect(repos[1]!.branches).toHaveLength(2);
    });

    it('should filter repos by pattern', async () => {
      const mockApiResponse = {
        List: {
          Repos: [
            {
              Repository: { Name: 'github.com/org/repo1', URL: '', Branches: [{ Name: 'main', Version: 'abc123' }], HasSymbols: false, LatestCommitDate: '' },
              IndexMetadata: { IndexTime: '2026-01-16T03:00:00Z' },
              Stats: { Repos: 0, Shards: 1, Documents: 10, IndexBytes: 500, ContentBytes: 1000 },
            },
            {
              Repository: { Name: 'github.com/org/repo2', URL: '', Branches: [{ Name: 'main', Version: 'def456' }], HasSymbols: false, LatestCommitDate: '' },
              IndexMetadata: { IndexTime: '2026-01-16T03:00:00Z' },
              Stats: { Repos: 0, Shards: 1, Documents: 20, IndexBytes: 600, ContentBytes: 2000 },
            },
            {
              Repository: { Name: 'github.com/other/repo3', URL: '', Branches: [{ Name: 'main', Version: 'ghi789' }], HasSymbols: false, LatestCommitDate: '' },
              IndexMetadata: { IndexTime: '2026-01-16T03:00:00Z' },
              Stats: { Repos: 0, Shards: 1, Documents: 30, IndexBytes: 700, ContentBytes: 3000 },
            },
          ],
          Stats: { Repos: 3, Shards: 3, Documents: 60, IndexBytes: 1800, ContentBytes: 6000 },
          Crashes: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const repos = await client.listRepos('org/repo');
      
      expect(repos).toHaveLength(2);
      expect(repos.every((r) => r.name.includes('org/repo'))).toBe(true);
    });

    it('should return empty array when Repos is null (no repos indexed)', async () => {
      const mockApiResponse = {
        List: {
          Repos: null,
          Stats: { Repos: 0, Shards: 0, Documents: 0, IndexBytes: 0, ContentBytes: 0 },
          Crashes: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const repos = await client.listRepos();

      expect(repos).toEqual([]);
    });

    it('should handle null Branches on a repository', async () => {
      const mockApiResponse = {
        List: {
          Repos: [
            {
              Repository: { Name: 'github.com/org/repo', URL: '', Branches: null, HasSymbols: false, LatestCommitDate: '' },
              IndexMetadata: { IndexTime: '2026-01-16T03:00:00Z' },
              Stats: { Repos: 0, Shards: 1, Documents: 50, IndexBytes: 1000, ContentBytes: 5000 },
            },
          ],
          Stats: { Repos: 1, Shards: 1, Documents: 50, IndexBytes: 1000, ContentBytes: 5000 },
          Crashes: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const repos = await client.listRepos();

      expect(repos).toHaveLength(1);
      expect(repos[0]!.branches).toEqual([]);
    });

    it('should treat Go zero-value dates as undefined', async () => {
      const mockApiResponse = {
        List: {
          Repos: [
            {
              Repository: { Name: 'github.com/org/repo', URL: '', Branches: null, HasSymbols: false, LatestCommitDate: '0001-01-01T00:00:00Z' },
              IndexMetadata: { IndexTime: '0001-01-01T00:00:00Z' },
              Stats: { Repos: 0, Shards: 1, Documents: 10, IndexBytes: 100, ContentBytes: 200 },
            },
          ],
          Stats: { Repos: 1, Shards: 1, Documents: 10, IndexBytes: 100, ContentBytes: 200 },
          Crashes: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const repos = await client.listRepos();

      expect(repos[0]!.indexTime).toBeUndefined();
      expect(repos[0]!.latestCommitDate).toBeUndefined();
    });

    it('should throw ZoektError with QUERY_ERROR code for invalid regex filter', async () => {
      await expect(client.listRepos('[invalid')).rejects.toThrow(ZoektError);

      try {
        await client.listRepos('[invalid');
        expect.fail('Expected ZoektError');
      } catch (error) {
        expect(error).toBeInstanceOf(ZoektError);
        expect((error as ZoektError).code).toBe('QUERY_ERROR');
        expect((error as ZoektError).message).toContain('Invalid filter pattern');
      }
    });
  });

  describe('getFileContent', () => {
    it('should call /print endpoint with correct parameters', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('file content here'),
      } as Response);

      const content = await client.getFileContent('github.com/org/repo', 'src/main.ts');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/print?'),
        expect.any(Object)
      );

      const callUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('r=github.com%2Forg%2Frepo');
      expect(callUrl).toContain('f=src%2Fmain.ts');
    });

    it('should throw ZoektError when file not found', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('file not found'),
      } as Response);

      await expect(
        client.getFileContent('github.com/org/repo', 'nonexistent.ts')
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('getStats', () => {
    it('should return correct aggregate stats from /api/list', async () => {
      const mockApiResponse = {
        List: {
          Repos: [],
          Stats: { Repos: 1104, Shards: 1200, Documents: 500000, IndexBytes: 5368709120, ContentBytes: 10737418240 },
          Crashes: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const stats = await client.getStats();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/list'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(stats.repositoryCount).toBe(1104);
      expect(stats.documentCount).toBe(500000);
      expect(stats.indexBytes).toBe(5368709120);
      expect(stats.contentBytes).toBe(10737418240);
    });

    it('should include shardCount from Stats.Shards', async () => {
      const mockApiResponse = {
        List: {
          Repos: [],
          Stats: { Repos: 10, Shards: 42, Documents: 1000, IndexBytes: 5000000, ContentBytes: 10000000 },
          Crashes: 0,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const stats = await client.getStats();

      expect(stats.shardCount).toBe(42);
    });
  });
});
