/**
 * Unit tests for error enhancement module
 */

import { describe, it, expect } from 'vitest';
import { enhanceError, formatStructuredError } from '../../../src/errors/codes.js';

describe('error codes', () => {
  describe('enhanceError', () => {
    describe('regex errors', () => {
      it('detects regexp error and provides hint', () => {
        const error = new Error('regexp: missing closing bracket');
        const result = enhanceError(error);
        
        expect(result.code).toBe('QUERY_ERROR');
        expect(result.hint).toContain('regex syntax');
        expect(result.details?.errorType).toBe('regex_syntax');
      });

      it('detects parse error in pattern', () => {
        const error = new Error('parse error in pattern: unbalanced parentheses');
        const result = enhanceError(error);
        
        expect(result.code).toBe('QUERY_ERROR');
        expect(result.hint).toContain('regex');
      });

      it('detects unterminated pattern', () => {
        const error = new Error('unterminated character class');
        const result = enhanceError(error);
        
        expect(result.code).toBe('QUERY_ERROR');
        expect(result.hint).toContain('regex');
      });
    });

    describe('unknown field errors', () => {
      it('detects unknown field and lists valid fields', () => {
        const error = new Error('unknown field: filee');
        const result = enhanceError(error);
        
        expect(result.code).toBe('QUERY_ERROR');
        expect(result.hint).toContain('file:');
        expect(result.hint).toContain('repo:');
        expect(result.details?.field).toBe('filee');
      });

      it('detects invalid operator', () => {
        const error = new Error("invalid operator 'langugage'");
        const result = enhanceError(error);
        
        expect(result.code).toBe('QUERY_ERROR');
        expect(result.hint).toContain('lang:');
      });
    });

    describe('timeout errors', () => {
      it('detects timeout and suggests refinement', () => {
        const error = new Error('search timed out after 30000ms');
        const result = enhanceError(error);
        
        expect(result.code).toBe('TIMEOUT');
        expect(result.hint).toContain('more specific');
        expect(result.hint).toContain('repo:');
      });

      it('detects deadline exceeded', () => {
        const error = new Error('deadline exceeded');
        const result = enhanceError(error);
        
        expect(result.code).toBe('TIMEOUT');
      });
    });

    describe('unavailable errors', () => {
      it('detects connection refused', () => {
        const error = new Error('ECONNREFUSED');
        const result = enhanceError(error);
        
        expect(result.code).toBe('UNAVAILABLE');
        expect(result.hint).toContain('zoekt-webserver');
      });

      it('detects network error', () => {
        const error = new Error('network error: cannot connect to host');
        const result = enhanceError(error);
        
        expect(result.code).toBe('UNAVAILABLE');
      });

      it('detects fetch failed', () => {
        const error = new Error('fetch failed');
        const result = enhanceError(error);
        
        expect(result.code).toBe('UNAVAILABLE');
      });
    });

    describe('not found errors', () => {
      it('detects file not found', () => {
        const error = new Error('file not found: src/main.ts');
        const result = enhanceError(error);
        
        expect(result.code).toBe('NOT_FOUND');
        expect(result.hint).toContain('repository name');
      });

      it('detects 404', () => {
        const error = new Error('404: resource not available');
        const result = enhanceError(error);
        
        expect(result.code).toBe('NOT_FOUND');
      });
    });

    describe('unknown errors', () => {
      it('falls back to QUERY_ERROR for unknown patterns', () => {
        const error = new Error('something completely unexpected');
        const result = enhanceError(error);
        
        expect(result.code).toBe('QUERY_ERROR');
        expect(result.details?.errorType).toBe('unknown');
      });

      it('handles non-Error objects', () => {
        const result = enhanceError('just a string');
        
        expect(result.message).toBe('just a string');
        expect(result.code).toBe('QUERY_ERROR');
      });
    });
  });

  describe('formatStructuredError', () => {
    it('formats error with code and message', () => {
      const error = enhanceError(new Error('test error'));
      const formatted = formatStructuredError(error);
      
      expect(formatted).toContain('**Error');
      expect(formatted).toContain('test error');
    });

    it('includes hint when present', () => {
      const error = enhanceError(new Error('regexp: bad pattern'));
      const formatted = formatStructuredError(error);
      
      expect(formatted).toContain('**Hint**');
      expect(formatted).toContain('regex');
    });

    it('formats all error codes correctly', () => {
      const codes = ['UNAVAILABLE', 'QUERY_ERROR', 'TIMEOUT', 'NOT_FOUND'];
      
      for (const code of codes) {
        const error = {
          code: code as 'UNAVAILABLE' | 'QUERY_ERROR' | 'TIMEOUT' | 'NOT_FOUND',
          message: 'test',
        };
        const formatted = formatStructuredError(error);
        expect(formatted).toContain(`[${code}]`);
      }
    });
  });
});
