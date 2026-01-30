/**
 * Integration tests for the file_content tool
 * 
 * Tests file content retrieval against a real Zoekt instance.
 */

import { describe, it, expect } from 'vitest';
import { ZoektClient, ZoektError } from '../../src/zoekt/client.js';
import { getZoektUrl } from '../helpers/zoekt-health.js';

describe('File Content Tool Integration', () => {
  const client = new ZoektClient(getZoektUrl(), 10000);

  describe('Valid File Retrieval', () => {
    it('should retrieve file content from root', async () => {
      // First, search to find a file
      const searchResult = await client.search('function greet', { limit: 1 });
      
      expect(searchResult.result.FileMatches!.length).toBeGreaterThan(0);
      
      const match = searchResult.result.FileMatches![0];
      const repoName = match.Repo ?? match.Repository ?? '';
      
      // Now get the file content
      const content = await client.getFileContent(repoName, match.FileName);
      
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
      expect(content).toContain('function greet');
    });

    it('should retrieve nested file content', async () => {
      // Search for something in the nested helper file
      const searchResult = await client.search('VERSION', { limit: 10 });
      
      expect(searchResult.result.FileMatches!.length).toBeGreaterThan(0);
      
      // Find the helper.ts match
      const helperMatch = searchResult.result.FileMatches!.find(m => 
        m.FileName.includes('helper.ts')
      );
      
      if (helperMatch) {
        const repoName = helperMatch.Repo ?? helperMatch.Repository ?? '';
        const content = await client.getFileContent(repoName, helperMatch.FileName);
        
        expect(content).toBeDefined();
        expect(content).toContain('VERSION');
        expect(content).toContain('1.0.0');
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      // First get a valid repo name
      const repos = await client.listRepos();
      expect(repos.length).toBeGreaterThan(0);
      
      const repoName = repos[0].name;
      
      // Try to get a non-existent file
      await expect(
        client.getFileContent(repoName, 'nonexistent_file_xyz.ts')
      ).rejects.toThrow();
    });

    it('should throw error for non-existent repository', async () => {
      await expect(
        client.getFileContent('fake-repo-that-does-not-exist', 'sample.ts')
      ).rejects.toThrow();
    });
  });
});
