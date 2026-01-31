/**
 * Integration tests for new MCP tools
 * 
 * Tests search_symbols, search_files, find_references, and get_health tools
 * against a real Zoekt instance.
 */

import { describe, it, expect } from 'vitest';
import { ZoektClient } from '../../src/zoekt/client.js';
import { getZoektUrl } from '../helpers/zoekt-health.js';
import { wrapSymbolQuery, extractSymbols } from '../../src/tools/search-symbols.js';
import { wrapFilenameQuery, extractFiles } from '../../src/tools/search-files.js';
import { extractDefinitions, extractUsages, deduplicateReferences } from '../../src/tools/find-references.js';
import { buildHealthStatus } from '../../src/tools/get-health.js';
import type { ReferenceResult } from '../../src/zoekt/types.js';

describe('New Tools Integration', () => {
  const client = new ZoektClient(getZoektUrl(), 10000);

  describe('search_symbols Tool', () => {
    it('should wrap query with sym: prefix', () => {
      const wrapped = wrapSymbolQuery('handleRequest');
      expect(wrapped).toBe('sym:handleRequest');
    });

    it('should preserve existing filters', () => {
      const wrapped = wrapSymbolQuery('handler lang:typescript');
      expect(wrapped).toBe('sym:handler lang:typescript');
    });

    it('should not double-wrap sym: queries', () => {
      const wrapped = wrapSymbolQuery('sym:existingQuery');
      expect(wrapped).toBe('sym:existingQuery');
    });

    it('should search for symbols and extract results', async () => {
      // Use sym: prefix to search for symbols
      const result = await client.search('sym:greet', { limit: 10 });
      
      expect(result.result).toBeDefined();
      // Note: Symbol extraction requires ctags to be enabled in indexing
      // The result may have FileMatches with or without SymbolInfo depending on ctags
      if (result.result.FileMatches && result.result.FileMatches.length > 0) {
        const symbols = extractSymbols(result.result.FileMatches);
        // May be empty if ctags not enabled, but should not throw
        expect(Array.isArray(symbols)).toBe(true);
      }
    });

    it('should handle symbol search with no results', async () => {
      const result = await client.search('sym:nonexistent_symbol_xyz_12345', { limit: 10 });
      
      expect(result.result).toBeDefined();
      expect(result.result.FileMatches?.length ?? 0).toBe(0);
    });
  });

  describe('search_files Tool', () => {
    it('should wrap query with type:filename', () => {
      const wrapped = wrapFilenameQuery('package.json');
      expect(wrapped).toBe('type:filename package.json');
    });

    it('should preserve existing filters when wrapping', () => {
      const wrapped = wrapFilenameQuery('README.md repo:myrepo');
      expect(wrapped).toBe('type:filename README.md repo:myrepo');
    });

    it('should not double-wrap type:filename queries', () => {
      const wrapped = wrapFilenameQuery('config.yaml type:filename');
      expect(wrapped).toBe('config.yaml type:filename');
    });

    it('should search for files by name', async () => {
      const wrapped = wrapFilenameQuery('sample.ts');
      const result = await client.search(wrapped, { limit: 10 });
      
      expect(result.result).toBeDefined();
      if (result.result.FileMatches && result.result.FileMatches.length > 0) {
        const files = extractFiles(result.result.FileMatches);
        expect(files.length).toBeGreaterThan(0);
        expect(files.some(f => f.fileName.includes('sample.ts'))).toBe(true);
      }
    });

    it('should return file metadata without content', async () => {
      const wrapped = wrapFilenameQuery('index.ts');
      const result = await client.search(wrapped, { limit: 10 });
      
      expect(result.result).toBeDefined();
      if (result.result.FileMatches && result.result.FileMatches.length > 0) {
        const files = extractFiles(result.result.FileMatches);
        files.forEach(file => {
          expect(file.fileName).toBeDefined();
          expect(file.repository).toBeDefined();
        });
      }
    });

    it('should handle file search with no results', async () => {
      const wrapped = wrapFilenameQuery('nonexistent_file_xyz.abc');
      const result = await client.search(wrapped, { limit: 10 });
      
      expect(result.result).toBeDefined();
      const files = extractFiles(result.result.FileMatches ?? []);
      expect(files.length).toBe(0);
    });
  });

  describe('find_references Tool', () => {
    it('should find definitions using sym: query', async () => {
      const result = await client.search('sym:greet', { limit: 10 });
      
      expect(result.result).toBeDefined();
      if (result.result.FileMatches && result.result.FileMatches.length > 0) {
        const definitions = extractDefinitions(result.result.FileMatches);
        // May be empty if ctags not enabled
        expect(Array.isArray(definitions)).toBe(true);
      }
    });

    it('should find usages using content query', async () => {
      const result = await client.search('greet', { limit: 10 });
      
      expect(result.result).toBeDefined();
      if (result.result.FileMatches && result.result.FileMatches.length > 0) {
        const usages = extractUsages(result.result.FileMatches);
        expect(Array.isArray(usages)).toBe(true);
        expect(usages.length).toBeGreaterThan(0);
      }
    });

    it('should deduplicate definitions from usages', () => {
      const definitions: ReferenceResult[] = [
        { file: 'sample.ts', repository: 'test', line: 10, column: 0, context: 'function def', type: 'definition' },
      ];
      const usages: ReferenceResult[] = [
        { file: 'sample.ts', repository: 'test', line: 10, column: 0, context: 'same line', type: 'usage' },
        { file: 'sample.ts', repository: 'test', line: 20, column: 0, context: 'usage 1', type: 'usage' },
        { file: 'other.ts', repository: 'test', line: 5, column: 0, context: 'usage 2', type: 'usage' },
      ];

      const deduplicated = deduplicateReferences(definitions, usages);
      
      // Line 10 should be removed from usages since it's a definition
      expect(deduplicated.length).toBe(2);
      expect(deduplicated.find(u => u.line === 10)).toBeUndefined();
      expect(deduplicated.find(u => u.line === 20)).toBeDefined();
      expect(deduplicated.find(u => u.line === 5)).toBeDefined();
    });
  });

  describe('get_health Tool', () => {
    it('should return healthy status when Zoekt is available', async () => {
      const healthResponse = await client.checkHealth();
      const statsResponse = await client.getStats();
      
      const status = buildHealthStatus(healthResponse, statsResponse, '1.0.0');
      
      expect(status.status.toLowerCase()).toContain('healthy');
      expect(status.zoektReachable).toBe(true);
    });

    it('should include repository count in stats', async () => {
      const healthResponse = await client.checkHealth();
      const statsResponse = await client.getStats();
      
      const status = buildHealthStatus(healthResponse, statsResponse, '1.0.0');
      
      expect(status.indexStats).toBeDefined();
      if (status.indexStats) {
        expect(typeof status.indexStats.repositoryCount).toBe('number');
        expect(status.indexStats.repositoryCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return unhealthy status when error occurs', () => {
      const status = buildHealthStatus(
        { healthy: false, error: 'Connection refused' },
        null,
        '1.0.0'
      );
      
      expect(status.status.toLowerCase()).toContain('unhealthy');
      expect(status.zoektReachable).toBe(false);
      expect(status.errorMessage).toBeDefined();
    });
  });
});
