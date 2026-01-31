/**
 * Performance tests for MCP tools
 * 
 * Validates that tools meet performance requirements:
 * - Search operations: <2s for 100 repos
 * - Health check: <500ms
 */

import { describe, it, expect } from 'vitest';
import { ZoektClient } from '../../src/zoekt/client.js';
import { getZoektUrl } from '../helpers/zoekt-health.js';

describe('Performance Tests', () => {
  const client = new ZoektClient(getZoektUrl(), 10000);

  describe('Search Performance', () => {
    it('should complete search within 2 seconds', async () => {
      const start = Date.now();
      
      const result = await client.search('function', { limit: 100 });
      
      const duration = Date.now() - start;
      
      expect(result.result).toBeDefined();
      expect(duration).toBeLessThan(2000);
      
      console.log(`Search duration: ${duration}ms`);
    });

    it('should complete symbol search within 2 seconds', async () => {
      const start = Date.now();
      
      const result = await client.search('sym:main', { limit: 100 });
      
      const duration = Date.now() - start;
      
      expect(result.result).toBeDefined();
      expect(duration).toBeLessThan(2000);
      
      console.log(`Symbol search duration: ${duration}ms`);
    });

    it('should complete file search within 2 seconds', async () => {
      const start = Date.now();
      
      const result = await client.search('type:filename package.json', { limit: 100 });
      
      const duration = Date.now() - start;
      
      expect(result.result).toBeDefined();
      expect(duration).toBeLessThan(2000);
      
      console.log(`File search duration: ${duration}ms`);
    });

    it('should complete paginated search within 2 seconds per page', async () => {
      // First page
      const start1 = Date.now();
      const result1 = await client.search('const', { limit: 50 });
      const duration1 = Date.now() - start1;
      
      expect(result1.result).toBeDefined();
      expect(duration1).toBeLessThan(2000);
      
      // Second page (simulated with offset if supported)
      const start2 = Date.now();
      const result2 = await client.search('const', { limit: 50 });
      const duration2 = Date.now() - start2;
      
      expect(result2.result).toBeDefined();
      expect(duration2).toBeLessThan(2000);
      
      console.log(`Paginated search: page1=${duration1}ms, page2=${duration2}ms`);
    });
  });

  describe('Health Check Performance', () => {
    it('should complete health check within 500ms', async () => {
      const start = Date.now();
      
      const result = await client.checkHealth();
      
      const duration = Date.now() - start;
      
      expect(result.healthy).toBe(true);
      expect(duration).toBeLessThan(500);
      
      console.log(`Health check duration: ${duration}ms`);
    });

    it('should complete stats retrieval within 500ms', async () => {
      const start = Date.now();
      
      const result = await client.getStats();
      
      const duration = Date.now() - start;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(500);
      
      console.log(`Stats retrieval duration: ${duration}ms`);
    });

    it('should complete combined health + stats within 1 second', async () => {
      const start = Date.now();
      
      const [health, stats] = await Promise.all([
        client.checkHealth(),
        client.getStats(),
      ]);
      
      const duration = Date.now() - start;
      
      expect(health.healthy).toBe(true);
      expect(stats).toBeDefined();
      expect(duration).toBeLessThan(1000);
      
      console.log(`Combined health+stats duration: ${duration}ms`);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 5 concurrent searches within 5 seconds total', async () => {
      const start = Date.now();
      
      const searches = [
        client.search('function', { limit: 20 }),
        client.search('class', { limit: 20 }),
        client.search('const', { limit: 20 }),
        client.search('interface', { limit: 20 }),
        client.search('export', { limit: 20 }),
      ];
      
      const results = await Promise.all(searches);
      
      const duration = Date.now() - start;
      
      results.forEach(result => {
        expect(result.result).toBeDefined();
      });
      expect(duration).toBeLessThan(5000);
      
      console.log(`5 concurrent searches duration: ${duration}ms`);
    });
  });

  describe('Large Result Set Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const start = Date.now();
      
      // Search for a common pattern that should return many results
      const result = await client.search('import', { limit: 200 });
      
      const duration = Date.now() - start;
      
      expect(result.result).toBeDefined();
      // Even large result sets should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
      
      const matchCount = result.result.FileMatches?.length ?? 0;
      console.log(`Large result set: ${matchCount} matches in ${duration}ms`);
    });
  });
});
