/**
 * Integration tests for MCP protocol compliance
 * 
 * Tests the MCP server via subprocess stdio communication.
 * Validates JSON-RPC message flow and protocol compliance.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpTestClient } from '../helpers/mcp-test-client.js';

describe('MCP Protocol Integration', () => {
  let client: McpTestClient;

  beforeAll(async () => {
    client = new McpTestClient();
    await client.start();
  });

  afterAll(async () => {
    await client.close();
  });

  describe('tools/list', () => {
    it('should return list of available tools', async () => {
      const response = await client.listTools();
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      const result = response.result as { tools: Array<{ name: string }> };
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
    });

    it('should include search tool in list', async () => {
      const response = await client.listTools();
      
      const result = response.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);
      
      expect(toolNames).toContain('search');
    });

    it('should include list_repos tool in list', async () => {
      const response = await client.listTools();
      
      const result = response.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);
      
      expect(toolNames).toContain('list_repos');
    });

    it('should include file_content tool in list', async () => {
      const response = await client.listTools();
      
      const result = response.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);
      
      expect(toolNames).toContain('file_content');
    });

    it('should have exactly 7 tools', async () => {
      const response = await client.listTools();
      
      const result = response.result as { tools: Array<{ name: string }> };
      // Original 3 + 4 new tools: search_symbols, search_files, find_references, get_health
      expect(result.tools.length).toBe(7);
    });
  });

  describe('tools/call - search', () => {
    it('should execute search and return results', async () => {
      const response = await client.callTool('search', { query: 'function' });
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      const result = response.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toContain('sample.ts');
    });

    it('should return content with text type', async () => {
      const response = await client.callTool('search', { query: 'function' });
      
      const result = response.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
      expect(result.isError).toBeFalsy();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });
  });

  describe('tools/call - list_repos', () => {
    it('should execute list_repos and return results', async () => {
      const response = await client.callTool('list_repos', {});
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      const result = response.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toContain('test-repo');
    });
  });

  describe('tools/call - file_content', () => {
    it('should require repository and path parameters', async () => {
      const response = await client.callTool('file_content', {});
      
      // Older SDKs reject invalid arguments as a JSON-RPC error, newer ones as an isError result.
      const result = response.result as { content?: Array<{ text: string }>; isError?: boolean } | undefined;
      const message = response.error?.message ?? (result?.isError ? result.content?.[0]?.text : undefined);
      expect(message).toMatch(/invalid arguments/i);
      expect(message).toContain('repository');
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid tool', async () => {
      const response = await client.callTool('nonexistent_tool', {});
      
      // Should have an error in the response
      expect(response.error || (response.result as { isError?: boolean })?.isError).toBeTruthy();
    });
  });
});
