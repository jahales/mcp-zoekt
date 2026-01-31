import { describe, it, expect } from 'vitest';
import { createLogger } from '../../src/logger.js';

describe('logger', () => {
  describe('createLogger', () => {
    it('should create a logger with default info level', () => {
      const logger = createLogger('info');
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
    });

    it('should create a logger with debug level', () => {
      const logger = createLogger('debug');
      expect(logger.level).toBe('debug');
    });

    it('should create a logger with warn level', () => {
      const logger = createLogger('warn');
      expect(logger.level).toBe('warn');
    });

    it('should create a logger with error level', () => {
      const logger = createLogger('error');
      expect(logger.level).toBe('error');
    });

    it('should have child logger capability', () => {
      const logger = createLogger('info');
      const childLogger = logger.child({ module: 'test' });
      expect(childLogger).toBeDefined();
    });
  });
});
