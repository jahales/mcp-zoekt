/**
 * Unit tests for pagination cursor module
 */

import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  validateCursor,
  hashQuery,
  generateNextCursor,
} from '../../../src/pagination/cursor.js';

describe('cursor', () => {
  describe('encodeCursor', () => {
    it('encodes query, offset, and limit into base64 string', () => {
      const cursor = encodeCursor('test query', 50, 25);
      expect(cursor).toBeTruthy();
      expect(typeof cursor).toBe('string');
      // Should be valid base64
      expect(() => Buffer.from(cursor, 'base64')).not.toThrow();
    });

    it('produces different cursors for different queries', () => {
      const cursor1 = encodeCursor('query1', 0, 30);
      const cursor2 = encodeCursor('query2', 0, 30);
      expect(cursor1).not.toBe(cursor2);
    });

    it('produces different cursors for different offsets', () => {
      const cursor1 = encodeCursor('same query', 0, 30);
      const cursor2 = encodeCursor('same query', 30, 30);
      expect(cursor1).not.toBe(cursor2);
    });
  });

  describe('decodeCursor', () => {
    it('decodes a valid cursor back to its components', () => {
      const original = encodeCursor('test query', 100, 50);
      const decoded = decodeCursor(original);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.queryHash).toBe(hashQuery('test query'));
      expect(decoded?.offset).toBe(100);
      expect(decoded?.limit).toBe(50);
    });

    it('returns null for invalid base64', () => {
      const decoded = decodeCursor('not-valid-base64!!!');
      expect(decoded).toBeNull();
    });

    it('returns null for valid base64 but invalid JSON', () => {
      const invalidJson = Buffer.from('not json').toString('base64');
      const decoded = decodeCursor(invalidJson);
      expect(decoded).toBeNull();
    });

    it('returns null for JSON missing required fields', () => {
      const incomplete = Buffer.from('{"q":"hash"}').toString('base64');
      const decoded = decodeCursor(incomplete);
      expect(decoded).toBeNull();
    });
  });

  describe('validateCursor', () => {
    it('returns valid for cursor matching current query', () => {
      const query = 'sym:handleRequest';
      const cursor = encodeCursor(query, 30, 30);
      
      const result = validateCursor(cursor, query);
      
      expect(result.valid).toBe(true);
      expect(result.cursor).toBeDefined();
      expect(result.cursor?.offset).toBe(30);
    });

    it('returns invalid for cursor with different query', () => {
      const cursor = encodeCursor('original query', 30, 30);
      
      const result = validateCursor(cursor, 'different query');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('returns invalid for malformed cursor', () => {
      const result = validateCursor('garbage', 'any query');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid cursor format');
    });

    it('returns invalid for negative offset', () => {
      // Manually create an invalid cursor with negative offset
      const badCursor = Buffer.from(JSON.stringify({
        q: hashQuery('test'),
        o: -10,
        l: 30,
      })).toString('base64');
      
      const result = validateCursor(badCursor, 'test');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negative offset');
    });

    it('returns invalid for limit exceeding max', () => {
      const cursor = encodeCursor('test', 0, 200);
      
      const result = validateCursor(cursor, 'test', 100);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('limit must be');
    });
  });

  describe('hashQuery', () => {
    it('produces consistent hashes for same query', () => {
      const hash1 = hashQuery('test query');
      const hash2 = hashQuery('test query');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different queries', () => {
      const hash1 = hashQuery('query1');
      const hash2 = hashQuery('query2');
      expect(hash1).not.toBe(hash2);
    });

    it('produces 16-character hex string', () => {
      const hash = hashQuery('any query');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('generateNextCursor', () => {
    it('returns cursor when more results available', () => {
      const nextCursor = generateNextCursor('query', 0, 30, 100);
      
      expect(nextCursor).toBeDefined();
      const decoded = decodeCursor(nextCursor!);
      expect(decoded?.offset).toBe(30);
    });

    it('returns undefined when no more results', () => {
      const nextCursor = generateNextCursor('query', 90, 30, 100);
      
      expect(nextCursor).toBeUndefined();
    });

    it('returns undefined when exactly at end', () => {
      const nextCursor = generateNextCursor('query', 70, 30, 100);
      
      expect(nextCursor).toBeUndefined();
    });

    it('accumulates offset correctly across pages', () => {
      // Simulate paging through results
      const cursor1 = generateNextCursor('query', 0, 30, 250);
      const decoded1 = decodeCursor(cursor1!);
      expect(decoded1?.offset).toBe(30);

      const cursor2 = generateNextCursor('query', 30, 30, 250);
      const decoded2 = decodeCursor(cursor2!);
      expect(decoded2?.offset).toBe(60);
    });
  });
});
