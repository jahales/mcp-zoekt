/**
 * Unit tests for get_health tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGetHealthHandler, buildHealthStatus } from '../../../src/tools/get-health.js';
import type { Logger } from '../../../src/logger.js';
import type { ZoektClient } from '../../../src/zoekt/client.js';

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: () => mockLogger,
  level: 'info',
} as unknown as Logger;

// Mock Zoekt client
const createMockClient = () => ({
  search: vi.fn(),
  listRepos: vi.fn(),
  getFileContent: vi.fn(),
  checkHealth: vi.fn(),
  getStats: vi.fn(),
});

describe('get_health tool', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
  });

  describe('buildHealthStatus', () => {
    it('returns healthy status when both checks pass', () => {
      const healthResult = { healthy: true };
      const statsResult = {
        repositoryCount: 10,
        documentCount: 1000,
        indexBytes: 5000000,
        contentBytes: 10000000,
        shardCount: 12,
      };

      const status = buildHealthStatus(healthResult, statsResult, '1.0.0');

      expect(status.status).toBe('healthy');
      expect(status.zoektReachable).toBe(true);
      expect(status.indexStats).toEqual(statsResult);
    });

    it('returns unhealthy status when health check fails', () => {
      const healthResult = { healthy: false, error: 'Connection failed' };
      const statsResult = null;

      const status = buildHealthStatus(healthResult, statsResult, '1.0.0');

      expect(status.status).toBe('unhealthy');
      expect(status.zoektReachable).toBe(false);
      expect(status.errorMessage).toBe('Connection failed');
    });

    it('returns degraded status when healthy but stats unavailable', () => {
      const healthResult = { healthy: true };
      const statsResult = null;

      const status = buildHealthStatus(healthResult, statsResult, '1.0.0');

      expect(status.status).toBe('degraded');
      expect(status.zoektReachable).toBe(true);
      expect(status.indexStats).toBeUndefined();
    });

    it('includes server version', () => {
      const healthResult = { healthy: true };
      const statsResult = {
        repositoryCount: 5,
        documentCount: 500,
        indexBytes: 1000000,
        contentBytes: 2000000,
        shardCount: 6,
      };

      const status = buildHealthStatus(healthResult, statsResult, '2.0.0');

      expect(status.serverVersion).toBe('2.0.0');
    });
  });

  describe('createGetHealthHandler', () => {
    it('returns healthy response when Zoekt is available', async () => {
      mockClient.checkHealth.mockResolvedValue({ healthy: true });
      mockClient.getStats.mockResolvedValue({
        repositoryCount: 10,
        documentCount: 1000,
        indexBytes: 5000000,
        contentBytes: 10000000,
        shardCount: 12,
      });

      const handler = createGetHealthHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({});

      expect(result.content).toHaveLength(1);
      const text = (result.content[0] as { text: string }).text;
      expect(text.toLowerCase()).toContain('healthy');
      expect(text).toContain('10 repositories');
      expect(text).toContain('1,000 documents');
      expect(text).toContain('12 shards');
    });

    it('returns unhealthy response when Zoekt unavailable', async () => {
      mockClient.checkHealth.mockResolvedValue({ healthy: false, error: 'ECONNREFUSED' });
      mockClient.getStats.mockRejectedValue(new Error('Connection refused'));

      const handler = createGetHealthHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({});

      expect(result.content).toHaveLength(1);
      const text = (result.content[0] as { text: string }).text;
      expect(text.toLowerCase()).toContain('unhealthy');
      expect(text).toContain('ECONNREFUSED');
    });

    it('returns degraded when health OK but stats fail', async () => {
      mockClient.checkHealth.mockResolvedValue({ healthy: true });
      mockClient.getStats.mockRejectedValue(new Error('Stats query failed'));

      const handler = createGetHealthHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({});

      expect(result.content).toHaveLength(1);
      const text = (result.content[0] as { text: string }).text;
      expect(text.toLowerCase()).toContain('degraded');
    });

    it('formats bytes in human-readable format', async () => {
      mockClient.checkHealth.mockResolvedValue({ healthy: true });
      mockClient.getStats.mockResolvedValue({
        repositoryCount: 10,
        documentCount: 50000,
        indexBytes: 1073741824,  // 1 GB
        contentBytes: 5368709120,  // 5 GB
        shardCount: 55,
      });

      const handler = createGetHealthHandler(mockClient as unknown as ZoektClient, mockLogger);
      const result = await handler({});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toMatch(/1(\.\d+)?\s*GB/i);  // Index size
      expect(text).toMatch(/5(\.\d+)?\s*GB/i);  // Content size
    });

    it('logs health check operations', async () => {
      mockClient.checkHealth.mockResolvedValue({ healthy: true });
      mockClient.getStats.mockResolvedValue({
        repositoryCount: 5,
        documentCount: 500,
        indexBytes: 1000000,
        contentBytes: 2000000,
        shardCount: 7,
      });

      const handler = createGetHealthHandler(mockClient as unknown as ZoektClient, mockLogger);
      await handler({});

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
});
