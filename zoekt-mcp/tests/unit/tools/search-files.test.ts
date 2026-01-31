/**
 * Unit tests for search_files tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSearchFilesHandler, extractFiles, wrapFilenameQuery } from '../../../src/tools/search-files.js';
import type { Logger } from '../../../src/logger.js';
import type { ZoektClient } from '../../../src/zoekt/client.js';

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: () => mockLogger,
  level: 'info',
} as unknown as Logger;

// Mock Zoekt client
const createMockClient = () => ({
  search: vi.fn(),
  listRepos: vi.fn(),
  getFileContent: vi.fn(),
  checkHealth: vi.fn(),
  getStats: vi.fn(),
});

describe('search_files tool', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
  });

  describe('wrapFilenameQuery', () => {
    it('wraps plain query with type:filename', () => {
      expect(wrapFilenameQuery('package.json')).toBe('type:filename package.json');
    });

    it('preserves existing type:filename', () => {
      expect(wrapFilenameQuery('type:filename package.json')).toBe('type:filename package.json');
    });

    it('wraps query with filters, keeping type:filename first', () => {
      const result = wrapFilenameQuery('config.yaml lang:yaml');
      expect(result).toContain('type:filename');
      expect(result).toContain('config.yaml');
      expect(result).toContain('lang:yaml');
    });

    it('handles regex patterns', () => {
      const result = wrapFilenameQuery('/.*\\.test\\.ts$/');
      expect(result).toBe('type:filename /.*\\.test\\.ts$/');
    });

    it('handles repo: filter with filename query', () => {
      const result = wrapFilenameQuery('README.md repo:myorg/myrepo');
      expect(result).toContain('type:filename');
      expect(result).toContain('README.md');
      expect(result).toContain('repo:myorg/myrepo');
    });

    it('preserves type:file variant', () => {
      expect(wrapFilenameQuery('type:file package.json')).toBe('type:file package.json');
    });
  });

  describe('extractFiles', () => {
    it('extracts file info from FileMatch', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'package.json',
        Branches: ['main', 'develop'],
        Language: 'JSON',
      }];

      const files = extractFiles(fileMatches);

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        fileName: 'package.json',
        repository: 'github.com/org/repo',
        branches: ['main', 'develop'],
        language: 'JSON',
      });
    });

    it('handles multiple files', () => {
      const fileMatches = [
        {
          Repository: 'github.com/org/repo1',
          FileName: 'package.json',
          Branches: ['main'],
          Language: 'JSON',
        },
        {
          Repository: 'github.com/org/repo2',
          FileName: 'package.json',
          Branches: ['master'],
          Language: 'JSON',
        },
      ];

      const files = extractFiles(fileMatches);

      expect(files).toHaveLength(2);
      expect(files.map(f => f.repository)).toEqual([
        'github.com/org/repo1',
        'github.com/org/repo2',
      ]);
    });

    it('handles Repo field alternative', () => {
      const fileMatches = [{
        Repo: 'github.com/org/repo',
        FileName: 'config.yaml',
        Branches: ['main'],
        Language: 'YAML',
      }];

      const files = extractFiles(fileMatches as any);

      expect(files).toHaveLength(1);
      expect(files[0]?.repository).toBe('github.com/org/repo');
    });

    it('does not include content matches', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'README.md',
        Branches: ['main'],
        Language: 'Markdown',
        ChunkMatches: [{
          Content: Buffer.from('# Title').toString('base64'),
          ContentStart: { ByteOffset: 0, LineNumber: 1, Column: 1 },
          Ranges: [],
          FileName: true, // This is a filename match
        }],
      }];

      const files = extractFiles(fileMatches);

      expect(files).toHaveLength(1);
      // Should not include matches - just file metadata
      expect(files[0]).not.toHaveProperty('matches');
    });
  });

  describe('createSearchFilesHandler', () => {
    it('returns formatted files on successful search', async () => {
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: [{
            Repository: 'github.com/org/repo',
            FileName: 'package.json',
            Branches: ['main'],
            Language: 'JSON',
            ChunkMatches: [{
              Content: Buffer.from('package.json').toString('base64'),
              ContentStart: { ByteOffset: 0, LineNumber: 0, Column: 0 },
              Ranges: [],
              FileName: true,
            }],
          }],
          Stats: { MatchCount: 1, FileCount: 1, Duration: 3000000 },
        },
      });

      const handler = createSearchFilesHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'package.json', limit: 30 });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect((result.content[0] as { text: string }).text).toContain('package.json');
      expect((result.content[0] as { text: string }).text).toContain('github.com/org/repo');
    });

    it('returns no results message when no files found', async () => {
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: [],
          Stats: { MatchCount: 0, FileCount: 0, Duration: 1000000 },
        },
      });

      const handler = createSearchFilesHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'nonexistent.xyz', limit: 30 });

      expect(result.content[0]).toBeDefined();
      expect((result.content[0] as { text: string }).text).toContain('No files found');
    });

    it('returns error on failed search', async () => {
      mockClient.search.mockRejectedValue(new Error('Connection refused'));

      const handler = createSearchFilesHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'test', limit: 30 });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Error');
    });

    it('uses type:filename query mode', async () => {
      mockClient.search.mockResolvedValue({
        result: { FileMatches: [], Stats: { MatchCount: 0, FileCount: 0, Duration: 1000000 } },
      });

      const handler = createSearchFilesHandler(mockClient as unknown as ZoektClient, mockLogger);
      await handler({ query: 'package.json', limit: 30 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.stringContaining('type:filename'),
        expect.any(Object)
      );
    });

    it('supports pagination with cursor', async () => {
      // Return 31 items to trigger pagination
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: Array(31).fill(null).map((_, i) => ({
            Repository: 'github.com/org/repo',
            FileName: `file${i}.ts`,
            Branches: ['main'],
            Language: 'TypeScript',
          })),
          Stats: { MatchCount: 100, FileCount: 31, Duration: 5000000 },
        },
      });

      const handler = createSearchFilesHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: '*.ts', limit: 30 });

      // Should include cursor for next page
      expect((result.content[0] as { text: string }).text).toContain('cursor');
    });
  });
});
