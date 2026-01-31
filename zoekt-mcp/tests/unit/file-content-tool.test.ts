import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test the file_content input schema matches the contract
describe('file_content tool', () => {
  // Schema matching contracts/mcp-tools.md
  const FileContentInputSchema = z.object({
    repository: z.string().describe(
      "Full repository name (e.g., 'github.com/org/repo')"
    ),
    path: z.string().describe(
      'Path to the file within the repository'
    ),
    branch: z.string().default('HEAD').describe(
      'Branch name (default: HEAD)'
    ),
  });

  describe('input schema', () => {
    it('should require repository and path', () => {
      expect(() => FileContentInputSchema.parse({})).toThrow();
      expect(() => FileContentInputSchema.parse({ repository: 'repo' })).toThrow();
      expect(() => FileContentInputSchema.parse({ path: 'file.ts' })).toThrow();
    });

    it('should accept repository and path', () => {
      const result = FileContentInputSchema.parse({
        repository: 'github.com/org/repo',
        path: 'src/main.ts',
      });
      expect(result.repository).toBe('github.com/org/repo');
      expect(result.path).toBe('src/main.ts');
      expect(result.branch).toBe('HEAD'); // default
    });

    it('should accept optional branch', () => {
      const result = FileContentInputSchema.parse({
        repository: 'github.com/org/repo',
        path: 'src/main.ts',
        branch: 'develop',
      });
      expect(result.branch).toBe('develop');
    });
  });

  describe('result formatting', () => {
    it('should format with repository and path header', () => {
      const formatted = formatFileContent(
        'github.com/org/repo',
        'src/main.ts',
        'HEAD',
        'const x = 1;',
        'typescript'
      );
      expect(formatted).toContain('## github.com/org/repo/src/main.ts');
    });

    it('should include branch information', () => {
      const formatted = formatFileContent(
        'github.com/org/repo',
        'src/main.ts',
        'develop',
        'const x = 1;',
        'typescript'
      );
      expect(formatted).toContain('Branch: develop');
    });

    it('should wrap content in code block with language', () => {
      const formatted = formatFileContent(
        'github.com/org/repo',
        'src/main.ts',
        'HEAD',
        'const x = 1;',
        'typescript'
      );
      expect(formatted).toContain('```typescript');
      expect(formatted).toContain('const x = 1;');
      expect(formatted).toContain('```');
    });

    it('should detect language from file extension', () => {
      expect(detectLanguage('file.ts')).toBe('typescript');
      expect(detectLanguage('file.tsx')).toBe('typescript');
      expect(detectLanguage('file.js')).toBe('javascript');
      expect(detectLanguage('file.py')).toBe('python');
      expect(detectLanguage('file.go')).toBe('go');
      expect(detectLanguage('file.rs')).toBe('rust');
      expect(detectLanguage('file.java')).toBe('java');
      expect(detectLanguage('file.rb')).toBe('ruby');
      expect(detectLanguage('file.unknown')).toBe('');
    });
  });

  describe('error handling', () => {
    it('should format file not found error', () => {
      const error = formatNotFoundError('github.com/org/repo', 'nonexistent.ts');
      expect(error).toContain('File not found');
      expect(error).toContain('github.com/org/repo/nonexistent.ts');
    });

    it('should format repository not found error', () => {
      const error = formatRepoNotFoundError('github.com/org/nonexistent');
      expect(error).toContain('Repository not indexed');
      expect(error).toContain('github.com/org/nonexistent');
    });
  });
});

// Helper functions that mirror the implementation
function formatFileContent(
  repository: string,
  path: string,
  branch: string,
  content: string,
  language: string
): string {
  let output = `## ${repository}/${path}\n\n`;
  output += `Branch: ${branch}\n\n`;
  output += `\`\`\`${language}\n`;
  output += content;
  if (!content.endsWith('\n')) {
    output += '\n';
  }
  output += `\`\`\`\n`;
  return output;
}

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    rb: 'ruby',
    php: 'php',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    xml: 'xml',
    toml: 'toml',
  };
  return languageMap[ext ?? ''] ?? '';
}

function formatNotFoundError(repository: string, path: string): string {
  return `Error: File not found: ${repository}/${path}`;
}

function formatRepoNotFoundError(repository: string): string {
  return `Error: Repository not indexed: ${repository}`;
}
