/**
 * Unit tests for find_references tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFindReferencesHandler,
  extractDefinitions,
  extractUsages,
  deduplicateReferences,
} from '../../../src/tools/find-references.js';
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

describe('find_references tool', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
  });

  describe('extractDefinitions', () => {
    it('extracts definitions from symbol search results', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/handler.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('function handleRequest(req) {').toString('base64'),
          ContentStart: { ByteOffset: 0, LineNumber: 10, Column: 1 },
          Ranges: [{
            Start: { ByteOffset: 9, LineNumber: 10, Column: 10 },
            End: { ByteOffset: 22, LineNumber: 10, Column: 23 },
          }],
          FileName: false,
          SymbolInfo: [{
            Sym: 'handleRequest',
            Kind: 'function',
            Parent: '',
            ParentKind: '',
          }],
        }],
      }];

      const definitions = extractDefinitions(fileMatches);

      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toMatchObject({
        type: 'definition',
        file: 'src/handler.ts',
        repository: 'github.com/org/repo',
        line: 10,
        symbol: {
          name: 'handleRequest',
          kind: 'function',
        },
      });
    });

    it('handles class methods with parent info', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/service.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('  processData(data) {').toString('base64'),
          ContentStart: { ByteOffset: 100, LineNumber: 25, Column: 1 },
          Ranges: [{
            Start: { ByteOffset: 102, LineNumber: 25, Column: 3 },
            End: { ByteOffset: 113, LineNumber: 25, Column: 14 },
          }],
          FileName: false,
          SymbolInfo: [{
            Sym: 'processData',
            Kind: 'method',
            Parent: 'DataService',
            ParentKind: 'class',
          }],
        }],
      }];

      const definitions = extractDefinitions(fileMatches);

      expect(definitions[0]?.symbol?.parent).toBe('DataService');
      expect(definitions[0]?.symbol?.parentKind).toBe('class');
    });
  });

  describe('extractUsages', () => {
    it('extracts usages from content search results', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/api.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('  const result = handleRequest(req);').toString('base64'),
          ContentStart: { ByteOffset: 200, LineNumber: 45, Column: 1 },
          Ranges: [{
            Start: { ByteOffset: 217, LineNumber: 45, Column: 18 },
            End: { ByteOffset: 230, LineNumber: 45, Column: 31 },
          }],
          FileName: false,
        }],
      }];

      const usages = extractUsages(fileMatches);

      expect(usages).toHaveLength(1);
      expect(usages[0]).toMatchObject({
        type: 'usage',
        file: 'src/api.ts',
        repository: 'github.com/org/repo',
        line: 45,
      });
      expect(usages[0]?.context).toContain('handleRequest');
    });

    it('extracts multiple usages from same file', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/api.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [
          {
            Content: Buffer.from('handleRequest(req1);').toString('base64'),
            ContentStart: { ByteOffset: 0, LineNumber: 10, Column: 1 },
            Ranges: [{ Start: { ByteOffset: 0, LineNumber: 10, Column: 1 }, End: { ByteOffset: 13, LineNumber: 10, Column: 14 } }],
            FileName: false,
          },
          {
            Content: Buffer.from('handleRequest(req2);').toString('base64'),
            ContentStart: { ByteOffset: 100, LineNumber: 20, Column: 1 },
            Ranges: [{ Start: { ByteOffset: 100, LineNumber: 20, Column: 1 }, End: { ByteOffset: 113, LineNumber: 20, Column: 14 } }],
            FileName: false,
          },
        ],
      }];

      const usages = extractUsages(fileMatches);

      expect(usages).toHaveLength(2);
      expect(usages[0]?.line).toBe(10);
      expect(usages[1]?.line).toBe(20);
    });
  });

  describe('deduplicateReferences', () => {
    it('removes definitions from usages list', () => {
      const definitions = [{
        type: 'definition' as const,
        file: 'src/handler.ts',
        repository: 'github.com/org/repo',
        line: 10,
        column: 10,
        context: 'function handleRequest() {',
      }];

      const usages = [
        {
          type: 'usage' as const,
          file: 'src/handler.ts',
          repository: 'github.com/org/repo',
          line: 10,  // Same as definition
          column: 10,
          context: 'function handleRequest() {',
        },
        {
          type: 'usage' as const,
          file: 'src/api.ts',
          repository: 'github.com/org/repo',
          line: 45,
          column: 18,
          context: 'handleRequest(req);',
        },
      ];

      const deduplicated = deduplicateReferences(definitions, usages);

      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0]?.file).toBe('src/api.ts');
    });

    it('preserves usages in different repos', () => {
      const definitions = [{
        type: 'definition' as const,
        file: 'src/handler.ts',
        repository: 'github.com/org/repo1',
        line: 10,
        column: 10,
        context: 'function handleRequest() {',
      }];

      const usages = [{
        type: 'usage' as const,
        file: 'src/handler.ts',  // Same file
        repository: 'github.com/org/repo2',  // Different repo
        line: 10,  // Same line
        column: 10,
        context: 'handleRequest(req);',
      }];

      const deduplicated = deduplicateReferences(definitions, usages);

      expect(deduplicated).toHaveLength(1);
    });
  });

  describe('createFindReferencesHandler', () => {
    it('returns both definitions and usages', async () => {
      // First call: symbol search for definitions
      mockClient.search.mockResolvedValueOnce({
        result: {
          FileMatches: [{
            Repository: 'github.com/org/repo',
            FileName: 'src/handler.ts',
            Branches: ['main'],
            Language: 'TypeScript',
            ChunkMatches: [{
              Content: Buffer.from('function handleRequest() {').toString('base64'),
              ContentStart: { ByteOffset: 0, LineNumber: 10, Column: 1 },
              Ranges: [{ Start: { ByteOffset: 9, LineNumber: 10, Column: 10 }, End: { ByteOffset: 22, LineNumber: 10, Column: 23 } }],
              FileName: false,
              SymbolInfo: [{ Sym: 'handleRequest', Kind: 'function', Parent: '', ParentKind: '' }],
            }],
          }],
          Stats: { MatchCount: 1, FileCount: 1, Duration: 3000000 },
        },
      });

      // Second call: content search for usages
      mockClient.search.mockResolvedValueOnce({
        result: {
          FileMatches: [{
            Repository: 'github.com/org/repo',
            FileName: 'src/api.ts',
            Branches: ['main'],
            Language: 'TypeScript',
            ChunkMatches: [{
              Content: Buffer.from('  handleRequest(req);').toString('base64'),
              ContentStart: { ByteOffset: 0, LineNumber: 45, Column: 1 },
              Ranges: [{ Start: { ByteOffset: 2, LineNumber: 45, Column: 3 }, End: { ByteOffset: 15, LineNumber: 45, Column: 16 } }],
              FileName: false,
            }],
          }],
          Stats: { MatchCount: 1, FileCount: 1, Duration: 2000000 },
        },
      });

      const handler = createFindReferencesHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ symbol: 'handleRequest', limit: 30, contextLines: 3 });

      expect(result.content).toHaveLength(1);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('handleRequest');
      expect(text).toContain('Definition');
      expect(text).toContain('Usage');
    });

    it('returns error on failed search', async () => {
      mockClient.search.mockRejectedValue(new Error('Connection refused'));

      const handler = createFindReferencesHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ symbol: 'test', limit: 30, contextLines: 3 });

      expect(result.isError).toBe(true);
    });

    it('uses sym: for definition search and content for usage search', async () => {
      mockClient.search.mockResolvedValue({
        result: { FileMatches: [], Stats: { MatchCount: 0, FileCount: 0, Duration: 1000000 } },
      });

      const handler = createFindReferencesHandler(mockClient as unknown as ZoektClient, mockLogger);
      await handler({ symbol: 'handleRequest', limit: 30, contextLines: 3 });

      // First call should use sym:
      expect(mockClient.search).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('sym:'),
        expect.any(Object)
      );

      // Second call should be content search (not sym:)
      expect(mockClient.search).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('handleRequest'),
        expect.any(Object)
      );
    });

    it('applies filters to both searches', async () => {
      mockClient.search.mockResolvedValue({
        result: { FileMatches: [], Stats: { MatchCount: 0, FileCount: 0, Duration: 1000000 } },
      });

      const handler = createFindReferencesHandler(mockClient as unknown as ZoektClient, mockLogger);
      await handler({ symbol: 'handleRequest', filters: 'lang:typescript repo:myrepo', limit: 30, contextLines: 3 });

      // Both calls should include filters
      expect(mockClient.search).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('lang:typescript'),
        expect.any(Object)
      );
      expect(mockClient.search).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('lang:typescript'),
        expect.any(Object)
      );
    });
  });
});
