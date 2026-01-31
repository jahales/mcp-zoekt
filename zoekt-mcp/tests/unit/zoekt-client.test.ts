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
    it('should call /api/search endpoint with type:repo query', async () => {
      const mockApiResponse = {
        Result: {
          Files: [
            { Repository: 'github.com/org/repo1', FileName: 'README.md', Branches: ['main'], Language: 'Markdown' },
            { Repository: 'github.com/org/repo2', FileName: 'README.md', Branches: ['main', 'develop'], Language: 'Markdown' },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const repos = await client.listRepos();

      expect(fetch).toHaveBeenCalled();
      expect(repos).toBeDefined();
      expect(repos.length).toBe(2);
    });

    it('should filter repos by pattern', async () => {
      const mockApiResponse = {
        Result: {
          Files: [
            { Repository: 'github.com/org/repo1', FileName: 'README.md', Branches: ['main'], Language: 'Markdown' },
            { Repository: 'github.com/org/repo2', FileName: 'README.md', Branches: ['main'], Language: 'Markdown' },
            { Repository: 'github.com/other/repo3', FileName: 'README.md', Branches: ['main'], Language: 'Markdown' },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response);

      const repos = await client.listRepos('org/repo');
      
      expect(repos.filter((r: { name: string }) => r.name.includes('org/repo')).length).toBeGreaterThan(0);
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
});
