/**
 * Unit tests for search_symbols tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSearchSymbolsHandler, extractSymbols, wrapSymbolQuery } from '../../../src/tools/search-symbols.js';
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

describe('search_symbols tool', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
  });

  describe('wrapSymbolQuery', () => {
    it('wraps plain query with sym: prefix', () => {
      expect(wrapSymbolQuery('handleRequest')).toBe('sym:handleRequest');
    });

    it('preserves existing sym: prefix', () => {
      expect(wrapSymbolQuery('sym:handleRequest')).toBe('sym:handleRequest');
    });

    it('wraps query with filters, adding sym: before term', () => {
      // lang:typescript handleRequest -> sym:handleRequest lang:typescript
      const result = wrapSymbolQuery('handleRequest lang:typescript');
      expect(result).toContain('sym:');
      expect(result).toContain('lang:typescript');
    });

    it('handles regex patterns', () => {
      const result = wrapSymbolQuery('/^get.*/');
      expect(result).toBe('sym:/^get.*/');
    });

    it('handles repo: filter with symbol query', () => {
      const result = wrapSymbolQuery('UserService repo:myorg/myrepo');
      expect(result).toContain('sym:');
      expect(result).toContain('repo:myorg/myrepo');
    });
  });

  describe('extractSymbols', () => {
    it('extracts symbols from ChunkMatch with SymbolInfo', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/handler.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('function handleRequest(req: Request) {').toString('base64'),
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

      const symbols = extractSymbols(fileMatches);

      expect(symbols).toHaveLength(1);
      expect(symbols[0]).toEqual({
        name: 'handleRequest',
        kind: 'function',
        file: 'src/handler.ts',
        repository: 'github.com/org/repo',
        line: 10,
        column: 10,
      });
    });

    it('extracts nested symbols with parent info', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/service.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('  async processData(data: Data) {').toString('base64'),
          ContentStart: { ByteOffset: 100, LineNumber: 25, Column: 1 },
          Ranges: [{
            Start: { ByteOffset: 108, LineNumber: 25, Column: 9 },
            End: { ByteOffset: 119, LineNumber: 25, Column: 20 },
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

      const symbols = extractSymbols(fileMatches);

      expect(symbols).toHaveLength(1);
      expect(symbols[0]).toMatchObject({
        name: 'processData',
        kind: 'method',
        parent: 'DataService',
        parentKind: 'class',
      });
    });

    it('handles null SymbolInfo entries', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/handler.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('handleRequest()').toString('base64'),
          ContentStart: { ByteOffset: 0, LineNumber: 10, Column: 1 },
          Ranges: [
            { Start: { ByteOffset: 0, LineNumber: 10, Column: 1 }, End: { ByteOffset: 13, LineNumber: 10, Column: 14 } },
          ],
          FileName: false,
          SymbolInfo: [null],  // null entry
        }],
      }];

      const symbols = extractSymbols(fileMatches);
      expect(symbols).toHaveLength(0);  // No valid symbols
    });

    it('handles missing SymbolInfo array', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/handler.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('handleRequest()').toString('base64'),
          ContentStart: { ByteOffset: 0, LineNumber: 10, Column: 1 },
          Ranges: [],
          FileName: false,
          // No SymbolInfo
        }],
      }];

      const symbols = extractSymbols(fileMatches);
      expect(symbols).toHaveLength(0);
    });

    it('normalizes symbol kinds', () => {
      const fileMatches = [{
        Repository: 'github.com/org/repo',
        FileName: 'src/types.ts',
        Branches: ['main'],
        Language: 'TypeScript',
        ChunkMatches: [{
          Content: Buffer.from('interface UserInterface {').toString('base64'),
          ContentStart: { ByteOffset: 0, LineNumber: 5, Column: 1 },
          Ranges: [{
            Start: { ByteOffset: 10, LineNumber: 5, Column: 11 },
            End: { ByteOffset: 23, LineNumber: 5, Column: 24 },
          }],
          FileName: false,
          SymbolInfo: [{
            Sym: 'UserInterface',
            Kind: 'interface',  // Should map to 'interface'
            Parent: '',
            ParentKind: '',
          }],
        }],
      }];

      const symbols = extractSymbols(fileMatches);
      expect(symbols[0]?.kind).toBe('interface');
    });
  });

  describe('createSearchSymbolsHandler', () => {
    it('returns formatted symbols on successful search', async () => {
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: [{
            Repository: 'github.com/org/repo',
            FileName: 'src/handler.ts',
            Branches: ['main'],
            Language: 'TypeScript',
            ChunkMatches: [{
              Content: Buffer.from('function handleRequest() {').toString('base64'),
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
          }],
          Stats: { MatchCount: 1, FileCount: 1, Duration: 5000000 },
        },
      });

      const handler = createSearchSymbolsHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'handleRequest', limit: 30, contextLines: 3 });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect((result.content[0] as { text: string }).text).toContain('handleRequest');
      expect((result.content[0] as { text: string }).text).toContain('function');
    });

    it('returns no results message when no symbols found', async () => {
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: [],
          Stats: { MatchCount: 0, FileCount: 0, Duration: 1000000 },
        },
      });

      const handler = createSearchSymbolsHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'nonexistent', limit: 30, contextLines: 3 });

      expect(result.content[0]).toBeDefined();
      expect((result.content[0] as { text: string }).text).toContain('No symbols found');
    });

    it('returns error on failed search', async () => {
      mockClient.search.mockRejectedValue(new Error('Connection refused'));

      const handler = createSearchSymbolsHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'test', limit: 30, contextLines: 3 });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Error');
    });

    it('uses sym: query prefix', async () => {
      mockClient.search.mockResolvedValue({
        result: { FileMatches: [], Stats: { MatchCount: 0, FileCount: 0, Duration: 1000000 } },
      });

      const handler = createSearchSymbolsHandler(mockClient as unknown as ZoektClient, mockLogger);
      await handler({ query: 'handleRequest', limit: 30, contextLines: 3 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.stringContaining('sym:'),
        expect.any(Object)
      );
    });

    it('supports pagination with cursor', async () => {
      // Return 31 items to trigger pagination (more than limit of 30)
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: Array(31).fill(null).map((_, i) => ({
            Repository: 'github.com/org/repo',
            FileName: `src/handler${i}.ts`,
            Branches: ['main'],
            Language: 'TypeScript',
            ChunkMatches: [{
              Content: Buffer.from(`function test${i}() {`).toString('base64'),
              ContentStart: { ByteOffset: 0, LineNumber: 1, Column: 1 },
              Ranges: [{ Start: { ByteOffset: 9, LineNumber: 1, Column: 10 }, End: { ByteOffset: 13, LineNumber: 1, Column: 14 } }],
              FileName: false,
              SymbolInfo: [{ Sym: `test${i}`, Kind: 'function', Parent: '', ParentKind: '' }],
            }],
          })),
          Stats: { MatchCount: 100, FileCount: 31, Duration: 5000000 },
        },
      });

      const handler = createSearchSymbolsHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'test', limit: 30, contextLines: 3 });

      // Should include cursor for next page since there are more results
      expect((result.content[0] as { text: string }).text).toContain('cursor');
    });

    // T022: limit=5 returns exactly 5 symbols
    it('returns exactly limit number of symbols when more are available', async () => {
      // Return 10 files, each with 1 symbol
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: Array(10).fill(null).map((_, i) => ({
            Repository: 'github.com/org/repo',
            FileName: `src/handler${i}.ts`,
            Branches: ['main'],
            Language: 'TypeScript',
            ChunkMatches: [{
              Content: Buffer.from(`function test${i}() {`).toString('base64'),
              ContentStart: { ByteOffset: 0, LineNumber: 1, Column: 1 },
              Ranges: [{ Start: { ByteOffset: 9, LineNumber: 1, Column: 10 }, End: { ByteOffset: 13, LineNumber: 1, Column: 14 } }],
              FileName: false,
              SymbolInfo: [{ Sym: `test${i}`, Kind: 'function', Parent: '', ParentKind: '' }],
            }],
          })),
          Stats: { MatchCount: 10, FileCount: 10, Duration: 5000000 },
        },
      });

      const handler = createSearchSymbolsHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'test', limit: 5, contextLines: 3 });

      // Should show exactly 5 symbols, not 10
      const text = (result.content[0] as { text: string }).text;
      // Count how many symbol entries appear (markdown bullet format: - **kind**)
      const symbolMatches = text.match(/^- \*\*\w+\*\*/gm);
      expect(symbolMatches?.length).toBe(5);
    });

    // T023: limit=10 across multi-symbol files returns 10 symbols (not 10 files)
    it('returns limit symbols regardless of file distribution', async () => {
      // Return 3 files, each with 5 symbols (15 total)
      mockClient.search.mockResolvedValue({
        result: {
          FileMatches: Array(3).fill(null).map((_, fileIdx) => ({
            Repository: 'github.com/org/repo',
            FileName: `src/file${fileIdx}.ts`,
            Branches: ['main'],
            Language: 'TypeScript',
            ChunkMatches: Array(5).fill(null).map((_, symIdx) => ({
              Content: Buffer.from(`function method${fileIdx}_${symIdx}() {`).toString('base64'),
              ContentStart: { ByteOffset: 0, LineNumber: symIdx * 10 + 1, Column: 1 },
              Ranges: [{ Start: { ByteOffset: 9, LineNumber: symIdx * 10 + 1, Column: 10 }, End: { ByteOffset: 20, LineNumber: symIdx * 10 + 1, Column: 21 } }],
              FileName: false,
              SymbolInfo: [{ Sym: `method${fileIdx}_${symIdx}`, Kind: 'function', Parent: '', ParentKind: '' }],
            })),
          })),
          Stats: { MatchCount: 15, FileCount: 3, Duration: 5000000 },
        },
      });

      const handler = createSearchSymbolsHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({ query: 'method', limit: 10, contextLines: 3 });

      // Should show exactly 10 symbols from across the 3 files
      const text = (result.content[0] as { text: string }).text;
      const symbolMatches = text.match(/^- \*\*\w+\*\*/gm);
      expect(symbolMatches?.length).toBe(10);
    });
  });
});
