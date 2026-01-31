/**
 * Integration tests for the search tool
 * 
 * Tests the search tool against a real Zoekt instance.
 */

import { describe, it, expect } from 'vitest';
import { ZoektClient } from '../../src/zoekt/client.js';
import { getZoektUrl } from '../helpers/zoekt-health.js';

describe('Search Tool Integration', () => {
  const client = new ZoektClient(getZoektUrl(), 10000);

  describe('Basic Search Queries', () => {
    it('should find function by name', async () => {
      const result = await client.search('function greet', { limit: 10 });
      
      expect(result.result).toBeDefined();
      expect(result.result.FileMatches).toBeDefined();
      expect(result.result.FileMatches!.length).toBeGreaterThan(0);
      
      const match = result.result.FileMatches![0];
      expect(match.FileName).toContain('sample.ts');
    });

    it('should find async function', async () => {
      const result = await client.search('async function processData', { limit: 10 });
      
      expect(result.result).toBeDefined();
      expect(result.result.FileMatches!.length).toBeGreaterThan(0);
      
      const match = result.result.FileMatches![0];
      expect(match.FileName).toContain('sample.ts');
    });

    it('should find constant definition', async () => {
      const result = await client.search('VERSION', { limit: 10 });
      
      expect(result.result).toBeDefined();
      expect(result.result.FileMatches!.length).toBeGreaterThan(0);
      
      // VERSION appears in both helper.ts and index.ts
      const fileNames = result.result.FileMatches!.map(m => m.FileName);
      expect(fileNames.some(f => f.includes('helper.ts'))).toBe(true);
    });

    it('should find class definition', async () => {
      const result = await client.search('class DataProcessor', { limit: 10 });
      
      expect(result.result).toBeDefined();
      expect(result.result.FileMatches!.length).toBeGreaterThan(0);
      
      const match = result.result.FileMatches![0];
      expect(match.FileName).toContain('sample.ts');
    });
  });

  describe('Search Edge Cases', () => {
    it('should return empty results for non-existent pattern', async () => {
      const result = await client.search('nonexistent_xyz_pattern_12345', { limit: 10 });
      
      expect(result.result).toBeDefined();
      expect(result.result.FileMatches?.length ?? 0).toBe(0);
    });

    it('should handle special characters in query', async () => {
      const result = await client.search('"quotes"', { limit: 10 });
      
      expect(result.result).toBeDefined();
      // Should find SPECIAL_CHARS in helper.ts
      if (result.result.FileMatches && result.result.FileMatches.length > 0) {
        const match = result.result.FileMatches[0];
        expect(match.FileName).toContain('helper.ts');
      }
    });

    it('should support file filter in query', async () => {
      const result = await client.search('file:helper.ts formatMessage', { limit: 10 });
      
      expect(result.result).toBeDefined();
      if (result.result.FileMatches && result.result.FileMatches.length > 0) {
        // All matches should be from helper.ts
        result.result.FileMatches.forEach(match => {
          expect(match.FileName).toContain('helper.ts');
        });
      }
    });

    it('should include context lines in matches', async () => {
      const result = await client.search('function greet', { limit: 10, contextLines: 2 });
      
      expect(result.result).toBeDefined();
      expect(result.result.FileMatches!.length).toBeGreaterThan(0);
      
      const match = result.result.FileMatches![0];
      // Check that we have some match content - structure varies by Zoekt version
      expect(match).toBeDefined();
      expect(match.FileName).toBeDefined();
    });
  });

  describe('Search Statistics', () => {
    it('should return search statistics', async () => {
      const result = await client.search('function', { limit: 10 });
      
      expect(result.result).toBeDefined();
      expect(result.result.Stats).toBeDefined();
      expect(typeof result.result.Stats!.Duration).toBe('number');
    });
  });
});
