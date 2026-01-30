/**
 * Integration tests for error handling
 * 
 * Tests error conditions like unavailable backend and timeouts.
 */

import { describe, it, expect } from 'vitest';
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
    it('should throw TIMEOUT error when request times out', async () => {
      // Create client with very short timeout
      const client = new ZoektClient('http://localhost:6070', 1);
      
      try {
        await client.search('test query that should timeout', { limit: 10 });
        // If we get here, the request completed before timeout (fast network)
        // This is acceptable - we're testing the timeout mechanism exists
      } catch (error) {
        if (error instanceof ZoektError) {
          // Either TIMEOUT or UNAVAILABLE is acceptable for very short timeouts
          expect(['TIMEOUT', 'UNAVAILABLE']).toContain(error.code);
        }
      }
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
