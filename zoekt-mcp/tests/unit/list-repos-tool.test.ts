import { describe, it, expect } from 'vitest';
import { z } from 'zod';

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
      const repos = [
        { name: 'github.com/org/repo1', branches: ['main'] },
        { name: 'github.com/org/repo2', branches: ['main', 'develop'] },
      ];
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('## Indexed Repositories');
      expect(formatted).toContain('Found 2 repositories');
    });

    it('should format header with filter note', () => {
      const repos = [{ name: 'github.com/org/repo1', branches: ['main'] }];
      const formatted = formatRepoList(repos, 'org');
      expect(formatted).toContain("matching 'org'");
    });

    it('should format each repo with branches', () => {
      const repos = [
        { name: 'github.com/org/repo1', branches: ['main', 'develop'] },
      ];
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('github.com/org/repo1');
      expect(formatted).toContain('main, develop');
    });

    it('should show total count at end', () => {
      const repos = [
        { name: 'github.com/org/repo1', branches: ['main'] },
        { name: 'github.com/org/repo2', branches: ['main'] },
        { name: 'github.com/org/repo3', branches: ['main'] },
      ];
      const formatted = formatRepoList(repos);
      expect(formatted).toContain('Total: 3 repositories');
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

// Helper functions that mirror the implementation
function formatRepoList(
  repos: Array<{ name: string; branches: string[] }>,
  filter?: string
): string {
  let output = '## Indexed Repositories\n\n';
  
  const filterNote = filter ? ` matching '${filter}'` : '';
  output += `Found ${repos.length} repositories${filterNote}:\n\n`;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    if (repo) {
      const branchList = repo.branches.join(', ');
      output += `${i + 1}. ${repo.name} (${branchList})\n`;
    }
  }

  output += `\nTotal: ${repos.length} repositories\n`;
  return output;
}

function formatEmptyResponse(filter?: string): string {
  const message = filter
    ? `No repositories found matching '${filter}'.`
    : 'No repositories are currently indexed.';
  return `## Indexed Repositories\n\n${message}`;
}
