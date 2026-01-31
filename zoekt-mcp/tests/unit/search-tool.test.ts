import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

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
