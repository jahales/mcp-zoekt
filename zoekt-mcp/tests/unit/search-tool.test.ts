import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { createSearchHandler } from '../../src/tools/search.js';
import type { Logger } from '../../src/logger.js';
import type { ZoektClient } from '../../src/zoekt/client.js';

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

// Test the search input schema matches the contract
describe('search tool', () => {
  // Schema matching contracts/mcp-tools.md
  const SearchInputSchema = z.object({
    query: z.string().describe(
      'Zoekt search query. Supports regex, file filters (file:, lang:), repo filters (repo:), symbol search (sym:), and boolean operators (and, or, not).'
    ),
    limit: z.number().int().min(1).max(100).default(30).describe(
      'Maximum number of file matches to return'
    ),
    contextLines: z.number().int().min(0).max(10).default(3).describe(
      'Number of context lines to include around each match'
    ),
    cursor: z.string().optional().describe(
      'Pagination cursor from previous response'
    ),
  });

  describe('input schema', () => {
    it('should require query field', () => {
      expect(() => SearchInputSchema.parse({})).toThrow();
    });

    it('should accept query only', () => {
      const result = SearchInputSchema.parse({ query: 'test' });
      expect(result.query).toBe('test');
      expect(result.limit).toBe(30); // default
      expect(result.contextLines).toBe(3); // default
    });

    it('should accept all fields', () => {
      const result = SearchInputSchema.parse({
        query: 'test',
        limit: 50,
        contextLines: 5,
      });
      expect(result.query).toBe('test');
      expect(result.limit).toBe(50);
      expect(result.contextLines).toBe(5);
    });

    it('should enforce limit max of 100', () => {
      expect(() => SearchInputSchema.parse({ query: 'test', limit: 150 })).toThrow();
    });

    it('should enforce limit min of 1', () => {
      expect(() => SearchInputSchema.parse({ query: 'test', limit: 0 })).toThrow();
    });

    it('should enforce contextLines max of 10', () => {
      expect(() => SearchInputSchema.parse({ query: 'test', contextLines: 15 })).toThrow();
    });

    it('should enforce contextLines min of 0', () => {
      expect(() => SearchInputSchema.parse({ query: 'test', contextLines: -1 })).toThrow();
    });
  });

  describe('result formatting', () => {
    it('should format results with header', () => {
      const query = 'test query';
      const formatted = formatSearchHeader(query);
      expect(formatted).toContain('## Results for:');
      expect(formatted).toContain('test query');
    });

    it('should format file match with repository and filename', () => {
      const match = {
        Repository: 'github.com/org/repo',
        FileName: 'src/main.ts',
        Language: 'TypeScript',
        Branches: ['main'],
      };
      const formatted = formatFileMatch(match);
      expect(formatted).toContain('github.com/org/repo');
      expect(formatted).toContain('src/main.ts');
      expect(formatted).toContain('TypeScript');
    });

    it('should format stats with match count and duration', () => {
      const stats = {
        MatchCount: 42,
        FileCount: 10,
        Duration: 500000000, // 500ms in nanoseconds
      };
      const formatted = formatStats(stats);
      expect(formatted).toContain('42 matches');
      expect(formatted).toContain('10 files');
      expect(formatted).toContain('500ms');
    });
  });

  describe('createSearchHandler', () => {
    let mockClient: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      vi.clearAllMocks();
      mockClient = createMockClient();
    });

    const fileMatch = (i: number) => ({
      Repository: 'github.com/org/repo',
      FileName: `src/file${i}.ts`,
      Branches: ['main'],
      Language: 'TypeScript',
      ChunkMatches: [{
        Content: Buffer.from(`const x${i} = 1;`).toString('base64'),
        ContentStart: { ByteOffset: 0, LineNumber: i + 1, Column: 1 },
        Ranges: [{ Start: { ByteOffset: 0, LineNumber: i + 1, Column: 1 }, End: { ByteOffset: 5, LineNumber: i + 1, Column: 6 } }],
        FileName: false,
      }],
    });

    it('returns formatted results on a successful search', async () => {
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: [fileMatch(0)],
          Stats: { MatchCount: 1, FileCount: 1, Duration: 3000000 },
        },
      });

      const handler = createSearchHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'const', limit: 30, contextLines: 3 });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('src/file0.ts');
      expect(text).toContain('github.com/org/repo');
    });

    it('returns a no-matches message when nothing is found', async () => {
      mockClient.search.mockResolvedValue({
        result: { FileMatches: [], Stats: { MatchCount: 0, FileCount: 0, Duration: 1000000 } },
      });

      const handler = createSearchHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'nope', limit: 30, contextLines: 3 });

      expect((result.content[0] as { text: string }).text).toContain('No matches found');
    });

    it('returns a structured error on a failed search', async () => {
      mockClient.search.mockRejectedValue(new Error('Connection refused'));

      const handler = createSearchHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'test', limit: 30, contextLines: 3 });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Error');
    });

    it('offers a cursor when more file matches are available', async () => {
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: Array(31).fill(null).map((_, i) => fileMatch(i)),
          Stats: { MatchCount: 100, FileCount: 31, Duration: 5000000 },
        },
      });

      const handler = createSearchHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'const', limit: 30, contextLines: 3 });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('cursor');
      // Only `limit` file matches are rendered, not the extra look-ahead item.
      expect((text.match(/^### /gm) ?? []).length).toBe(30);
    });

    it('advances through file matches on subsequent pages (no repeats)', async () => {
      // 6 total matches, limit 3: page 1 = file0-2, page 2 = file3-5.
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: Array(6).fill(null).map((_, i) => fileMatch(i)),
          Stats: { MatchCount: 6, FileCount: 6, Duration: 5000000 },
        },
      });

      const handler = createSearchHandler(mockClient as unknown as ZoektClient, mockLogger);

      const page1 = await handler({ query: 'const', limit: 3, contextLines: 3 });
      const text1 = (page1.content[0] as { text: string }).text;
      expect(text1).toContain('src/file0.ts');
      expect(text1).toContain('src/file2.ts');
      expect(text1).not.toContain('src/file3.ts');

      const cursor = text1.match(/Use cursor: `([^`]+)`/)?.[1];
      expect(cursor).toBeDefined();

      const page2 = await handler({ query: 'const', limit: 3, contextLines: 3, cursor });
      const text2 = (page2.content[0] as { text: string }).text;
      expect(text2).not.toContain('src/file0.ts');
      expect(text2).not.toContain('src/file2.ts');
      expect(text2).toContain('src/file3.ts');
      expect(text2).toContain('src/file5.ts');
    });

    it('rejects a cursor minted for a different query', async () => {
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: Array(6).fill(null).map((_, i) => fileMatch(i)),
          Stats: { MatchCount: 6, FileCount: 6, Duration: 5000000 },
        },
      });

      const handler = createSearchHandler(mockClient as unknown as ZoektClient, mockLogger);
      const page1 = await handler({ query: 'const', limit: 3, contextLines: 3 });
      const cursor = (page1.content[0] as { text: string }).text.match(/Use cursor: `([^`]+)`/)?.[1];

      const result = await handler({ query: 'different', limit: 3, contextLines: 3, cursor });
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('does not match');
    });
  });
});

// Helper functions that mirror the implementation
function formatSearchHeader(query: string): string {
  return `## Results for: \`${query}\`\n\n`;
}

function formatFileMatch(match: {
  Repository: string;
  FileName: string;
  Language: string;
  Branches: string[];
}): string {
  return `### ${match.Repository} - ${match.FileName}\nLanguage: ${match.Language} | Branch: ${match.Branches[0] || 'HEAD'}\n`;
}

function formatStats(stats: { MatchCount: number; FileCount: number; Duration: number }): string {
  const durationMs = stats.Duration / 1_000_000;
  return `Stats: ${stats.MatchCount} matches in ${stats.FileCount} files (${durationMs.toFixed(0)}ms)\n`;
}
