/**
 * Integration tests for the list_repos tool
 * 
 * Tests repository listing against a real Zoekt instance.
 */

import { describe, it, expect } from 'vitest';
import { ZoektClient } from '../../src/zoekt/client.js';
import { getZoektUrl } from '../helpers/zoekt-health.js';

describe('List Repos Tool Integration', () => {
  const client = new ZoektClient(getZoektUrl(), 10000);

  describe('Repository Listing', () => {
    it('should list indexed repositories', async () => {
      const repos = await client.listRepos();
      
      expect(repos).toBeDefined();
      expect(Array.isArray(repos)).toBe(true);
      expect(repos.length).toBeGreaterThan(0);
    });

    it('should return repository names', async () => {
      const repos = await client.listRepos();
      
      expect(repos.length).toBeGreaterThan(0);
      
      // Each repo should have a name
      repos.forEach(repo => {
        expect(repo.name).toBeDefined();
        expect(typeof repo.name).toBe('string');
        expect(repo.name.length).toBeGreaterThan(0);
      });
    });

    it('should include test-repo in results', async () => {
      const repos = await client.listRepos();
      
      // The test corpus should be indexed
      const repoNames = repos.map(r => r.name);
      const hasTestRepo = repoNames.some(name => 
        name.includes('test-repo') || name.includes('test_repo')
      );
      
      expect(hasTestRepo).toBe(true);
    });

    it('should include branch information when available', async () => {
      const repos = await client.listRepos();
      
      expect(repos.length).toBeGreaterThan(0);
      
      // Branches should be an array (may be empty)
      repos.forEach(repo => {
        expect(repo.branches).toBeDefined();
        expect(Array.isArray(repo.branches)).toBe(true);
      });
    });
  });
});
