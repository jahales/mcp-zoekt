import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { Repository } from '../../src/zoekt/types.js';
import { formatRepoList, formatEmptyResponse } from '../../src/formatting/repoList.js';

// Test the list_repos input schema matches the contract
describe('list_repos tool', () => {
  // Schema matching contracts/mcp-tools.md
  const ListReposInputSchema = z.object({
    filter: z.string().optional().describe(
      'Optional filter pattern to match repository names (regex supported)'
    ),
  });

  describe('input schema', () => {
    it('should accept empty input', () => {
      const result = ListReposInputSchema.parse({});
      expect(result.filter).toBeUndefined();
    });

    it('should accept filter field', () => {
      const result = ListReposInputSchema.parse({ filter: 'my-org' });
      expect(result.filter).toBe('my-org');
    });

    it('should accept regex pattern as filter', () => {
      const result = ListReposInputSchema.parse({ filter: '^my-org/.*-api$' });
      expect(result.filter).toBe('^my-org/.*-api$');
    });
  });

  describe('result formatting', () => {
    it('should format header with count', () => {
      const repos = makeRepos([
        { name: 'github.com/org/repo1', branches: [{ name: 'main', version: 'abc1234' }] },
        { name: 'github.com/org/repo2', branches: [{ name: 'main', version: 'def5678' }, { name: 'develop', version: '9876543' }] },
      ]);
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('## Indexed Repositories');
      expect(formatted).toContain('Found 2 repositories');
    });

    it('should format header with filter note', () => {
      const repos = makeRepos([
        { name: 'github.com/org/repo1', branches: [{ name: 'main', version: 'abc1234' }] },
      ]);
      const formatted = formatRepoList(repos, 'org');
      expect(formatted).toContain("matching 'org'");
    });

    it('should format each repo with enriched metadata', () => {
      const repos = makeRepos([
        {
          name: 'github.com/org/repo1',
          branches: [{ name: 'main', version: 'abc1234def5678' }, { name: 'develop', version: '9876543aabbcc' }],
          hasSymbols: true,
          documentCount: 1234,
          contentBytes: 10500000,
          indexTime: new Date('2026-01-16T00:00:00Z'),
        },
      ]);
      const formatted = formatRepoList(repos);
      // Bold repo name with doc count and size
      expect(formatted).toContain('**github.com/org/repo1**');
      expect(formatted).toContain('1,234 files');
      // Branch names with truncated SHAs
      expect(formatted).toContain('main@abc1234');
      expect(formatted).toContain('develop@9876543');
      // Symbol indicator and index date
      expect(formatted).toContain('Symbols: ✅');
      expect(formatted).toContain('Indexed: 2026-01-16');
    });

    it('should show total count at end', () => {
      const repos = makeRepos([
        { name: 'github.com/org/repo1', branches: [{ name: 'main', version: 'a' }] },
        { name: 'github.com/org/repo2', branches: [{ name: 'main', version: 'b' }] },
        { name: 'github.com/org/repo3', branches: [{ name: 'main', version: 'c' }] },
      ]);
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('Total: 3 repositories');
    });

    it('should show ❌ when symbols unavailable', () => {
      const repos = makeRepos([
        { name: 'github.com/org/repo1', branches: [], hasSymbols: false },
      ]);
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('Symbols: ❌');
    });

    it('should omit index date when undefined', () => {
      const repos = makeRepos([
        { name: 'github.com/org/repo1', branches: [], indexTime: undefined },
      ]);
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('Symbols:');
      expect(formatted).not.toContain('Indexed:');
    });

    it('should handle empty branches array', () => {
      const repos = makeRepos([
        { name: 'github.com/org/repo1', branches: [] },
      ]);
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('**github.com/org/repo1**');
      expect(formatted).not.toContain('Branches:');
    });

    it('should handle empty list', () => {
      const formatted = formatEmptyResponse();
      expect(formatted).toContain('No repositories are currently indexed');
    });

    it('should handle empty list with filter', () => {
      const formatted = formatEmptyResponse('nonexistent');
      expect(formatted).toContain("No repositories found matching 'nonexistent'");
    });
  });
});

/**
 * Build Repository objects with sensible defaults.
 */
function makeRepos(
  overrides: Array<Partial<Repository> & { name: string }>
): Repository[] {
  return overrides.map((o) => ({
    name: o.name,
    url: o.url ?? '',
    branches: o.branches ?? [],
    hasSymbols: o.hasSymbols ?? false,
    documentCount: o.documentCount ?? 0,
    contentBytes: o.contentBytes ?? 0,
    indexBytes: o.indexBytes ?? 0,
    indexTime: o.indexTime,
    latestCommitDate: o.latestCommitDate,
  }));
}
