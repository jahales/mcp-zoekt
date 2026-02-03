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
    it('encodes query and offset into base64 string', () => {
      const cursor = encodeCursor('test query', 50);
      expect(cursor).toBeTruthy();
      expect(typeof cursor).toBe('string');
      // Should be valid base64
      expect(() => Buffer.from(cursor, 'base64')).not.toThrow();
    });

    it('produces different cursors for different queries', () => {
      const cursor1 = encodeCursor('query1', 0);
      const cursor2 = encodeCursor('query2', 0);
      expect(cursor1).not.toBe(cursor2);
    });

    it('produces different cursors for different offsets', () => {
      const cursor1 = encodeCursor('same query', 0);
      const cursor2 = encodeCursor('same query', 30);
      expect(cursor1).not.toBe(cursor2);
    });
  });

  describe('decodeCursor', () => {
    it('decodes a valid cursor back to its components', () => {
      const original = encodeCursor('test query', 100);
      const decoded = decodeCursor(original);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.queryHash).toBe(hashQuery('test query'));
      expect(decoded?.offset).toBe(100);
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

    // T030: Backward compatibility test - old cursor format with limit field
    it('decodes legacy cursor with limit field (ignores limit)', () => {
      // Legacy format includes l (limit) field
      const legacyCursor = Buffer.from(JSON.stringify({
        q: hashQuery('test query'),
        o: 50,
        l: 30, // Legacy limit field - should be ignored
      })).toString('base64');
      
      const decoded = decodeCursor(legacyCursor);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.queryHash).toBe(hashQuery('test query'));
      expect(decoded?.offset).toBe(50);
      // limit should not be present in new format
      expect((decoded as Record<string, unknown>)?.limit).toBeUndefined();
    });
  });

  describe('validateCursor', () => {
    it('returns valid for cursor matching current query', () => {
      const query = 'sym:handleRequest';
      const cursor = encodeCursor(query, 30);
      
      const result = validateCursor(cursor, query);
      
      expect(result.valid).toBe(true);
      expect(result.cursor).toBeDefined();
      expect(result.cursor?.offset).toBe(30);
    });

    it('returns invalid for cursor with different query', () => {
      const cursor = encodeCursor('original query', 30);
      
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
      })).toString('base64');
      
      const result = validateCursor(badCursor, 'test');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negative offset');
    });

    // T028, T029: Test that changing limit between pages works
    it('allows changing limit between pages (cursor created with any limit)', () => {
      // Simulate: page 1 with limit=30, page 2 with limit=50
      const query = 'sym:handleRequest';
      const cursor = encodeCursor(query, 30); // Created from page 1
      
      // Should validate successfully regardless of new limit value
      const result = validateCursor(cursor, query);
      
      expect(result.valid).toBe(true);
      expect(result.cursor?.offset).toBe(30);
    });

    it('allows decreasing limit between pages', () => {
      // Simulate: page 1 with limit=100, page 2 with limit=10
      const query = 'test query';
      const cursor = encodeCursor(query, 100); // Offset from page 1 with limit=100
      
      const result = validateCursor(cursor, query);
      
      expect(result.valid).toBe(true);
      expect(result.cursor?.offset).toBe(100);
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

  // US1 Edge Case Tests (T016-T020)
  describe('edge cases', () => {
    // T016: Empty cursor string
    it('returns null for empty cursor string', () => {
      const decoded = decodeCursor('');
      expect(decoded).toBeNull();
    });

    // T017: Non-base64 cursor
    it('returns null for non-base64 cursor with special chars', () => {
      const decoded = decodeCursor('!!!@@@###$$$');
      expect(decoded).toBeNull();
    });

    // T018: Non-JSON payload
    it('returns null for base64 encoded non-JSON string', () => {
      const nonJson = Buffer.from('this is not json at all').toString('base64');
      const decoded = decodeCursor(nonJson);
      expect(decoded).toBeNull();
    });

    // T019: Missing required fields
    it('returns null for cursor missing queryHash', () => {
      const missingHash = Buffer.from(JSON.stringify({ o: 10 })).toString('base64');
      const decoded = decodeCursor(missingHash);
      expect(decoded).toBeNull();
    });

    it('returns null for cursor missing offset', () => {
      const missingOffset = Buffer.from(JSON.stringify({ q: 'abc123' })).toString('base64');
      const decoded = decodeCursor(missingOffset);
      expect(decoded).toBeNull();
    });

    it('returns null for cursor with wrong field types', () => {
      const wrongTypes = Buffer.from(JSON.stringify({ q: 123, o: 'not a number' })).toString('base64');
      const decoded = decodeCursor(wrongTypes);
      expect(decoded).toBeNull();
    });

    // T020: Negative offset validation
    it('validateCursor rejects negative offset with clear error', () => {
      const badCursor = Buffer.from(JSON.stringify({
        q: hashQuery('query'),
        o: -5,
      })).toString('base64');
      
      const result = validateCursor(badCursor, 'query');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid cursor: negative offset');
    });

    // T034: Zero offset (first page)
    it('accepts zero offset as valid first page cursor', () => {
      const cursor = encodeCursor('query', 0);
      const result = validateCursor(cursor, 'query');
      
      expect(result.valid).toBe(true);
      expect(result.cursor?.offset).toBe(0);
    });

    // T032: Large offset
    it('accepts large offset values', () => {
      const cursor = encodeCursor('query', 270);
      const result = validateCursor(cursor, 'query');
      
      expect(result.valid).toBe(true);
      expect(result.cursor?.offset).toBe(270);
    });

    // T033: Offset exceeding total - handled by generateNextCursor
    it('generateNextCursor returns undefined when offset exceeds total', () => {
      const nextCursor = generateNextCursor('query', 500, 30, 100);
      expect(nextCursor).toBeUndefined();
    });
  });

  // T013, T015: Multi-page pagination scenarios
  describe('multi-page pagination', () => {
    it('supports complete multi-page navigation', () => {
      const query = 'sym:test';
      const totalResults = 75;
      const limit = 30;
      
      // Page 1: offset 0
      const cursor1 = generateNextCursor(query, 0, limit, totalResults);
      expect(cursor1).toBeDefined();
      const decoded1 = decodeCursor(cursor1!);
      expect(decoded1?.offset).toBe(30);
      
      // Page 2: offset 30
      const cursor2 = generateNextCursor(query, 30, limit, totalResults);
      expect(cursor2).toBeDefined();
      const decoded2 = decodeCursor(cursor2!);
      expect(decoded2?.offset).toBe(60);
      
      // Page 3: offset 60, only 15 results remain
      const cursor3 = generateNextCursor(query, 60, limit, totalResults);
      expect(cursor3).toBeUndefined(); // No more pages
    });

    it('returns no nextCursor when all results fit on one page', () => {
      const query = 'small result set';
      const totalResults = 10;
      const limit = 30;
      
      const nextCursor = generateNextCursor(query, 0, limit, totalResults);
      expect(nextCursor).toBeUndefined();
    });

    // T014: Query mismatch
    it('rejects cursor from different query with clear message', () => {
      const cursor = encodeCursor('original query', 30);
      
      const result = validateCursor(cursor, 'completely different query');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cursor does not match current query. Cursors are only valid for the same query.');
    });
  });
});
