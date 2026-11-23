/**
 * Integration tests for error handling
 * 
 * Tests error conditions like unavailable backend and timeouts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ZoektClient, ZoektError } from '../../src/zoekt/client.js';

describe('Error Handling Integration', () => {
  describe('Unavailable Backend', () => {
    it('should throw UNAVAILABLE error when backend is not running', async () => {
      // Create client pointing to non-existent server
      const client = new ZoektClient('http://localhost:59999', 5000);
      
      try {
        await client.search('test', { limit: 10 });
        expect.fail('Expected ZoektError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZoektError);
        expect((error as ZoektError).code).toBe('UNAVAILABLE');
      }
    });

    it('should include helpful message in unavailable error', async () => {
      const client = new ZoektClient('http://localhost:59999', 5000);
      
      try {
        await client.search('test', { limit: 10 });
        expect.fail('Expected ZoektError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZoektError);
        expect((error as ZoektError).message).toMatch(/unavailable|connection|refused/i);
      }
    });
  });

  describe('Timeout Handling', () => {
    // Accepts connections and never answers, so a request to it can only time out.
    let silentServer: Server;
    let silentUrl: string;

    beforeAll(async () => {
      silentServer = createServer(() => {});
      await new Promise<void>((resolve) => silentServer.listen(0, '127.0.0.1', resolve));
      silentUrl = `http://127.0.0.1:${(silentServer.address() as AddressInfo).port}`;
    });

    afterAll(() => {
      silentServer.closeAllConnections();
      silentServer.close();
    });

    it('should throw TIMEOUT error when request times out', async () => {
      const client = new ZoektClient(silentUrl, 100);

      await expect(client.search('test', { limit: 10 })).rejects.toMatchObject({
        name: 'ZoektError',
        code: 'TIMEOUT',
      });
    });
  });

  describe('ZoektError Properties', () => {
    it('should have correct error structure for UNAVAILABLE', async () => {
      const client = new ZoektClient('http://localhost:59999', 5000);
      
      try {
        await client.listRepos();
        expect.fail('Expected ZoektError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ZoektError);
        const zoektError = error as ZoektError;
        
        expect(zoektError.name).toBe('ZoektError');
        expect(zoektError.code).toBe('UNAVAILABLE');
        expect(zoektError.message).toBeDefined();
      }
    });
  });
});
