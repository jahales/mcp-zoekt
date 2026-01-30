import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConfig, type McpServerConfig } from '../../src/config.js';

describe('config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('loadConfig', () => {
    it('should require zoektUrl', () => {
      expect(() => loadConfig([])).toThrow(/zoekt.*url.*required/i);
    });

    it('should parse --url flag', () => {
      const config = loadConfig(['--url', 'http://localhost:6070']);
      expect(config.zoektUrl).toBe('http://localhost:6070');
    });

    it('should parse ZOEKT_URL environment variable', () => {
      vi.stubEnv('ZOEKT_URL', 'http://env-url:6070');
      const config = loadConfig([]);
      expect(config.zoektUrl).toBe('http://env-url:6070');
    });

    it('should prefer CLI flag over environment variable', () => {
      vi.stubEnv('ZOEKT_URL', 'http://env-url:6070');
      const config = loadConfig(['--url', 'http://cli-url:6070']);
      expect(config.zoektUrl).toBe('http://cli-url:6070');
    });

    it('should have default transport of stdio', () => {
      const config = loadConfig(['--url', 'http://localhost:6070']);
      expect(config.transport).toBe('stdio');
    });

    it('should parse --transport flag', () => {
      const config = loadConfig(['--url', 'http://localhost:6070', '--transport', 'http']);
      expect(config.transport).toBe('http');
    });

    it('should have default log level of info', () => {
      const config = loadConfig(['--url', 'http://localhost:6070']);
      expect(config.logLevel).toBe('info');
    });

    it('should parse --log-level flag', () => {
      const config = loadConfig(['--url', 'http://localhost:6070', '--log-level', 'debug']);
      expect(config.logLevel).toBe('debug');
    });

    it('should parse --debug flag as shorthand for debug log level', () => {
      const config = loadConfig(['--url', 'http://localhost:6070', '--debug']);
      expect(config.logLevel).toBe('debug');
    });

    it('should have default timeout of 30000ms', () => {
      const config = loadConfig(['--url', 'http://localhost:6070']);
      expect(config.timeoutMs).toBe(30000);
    });

    it('should parse --timeout flag', () => {
      const config = loadConfig(['--url', 'http://localhost:6070', '--timeout', '5000']);
      expect(config.timeoutMs).toBe(5000);
    });

    it('should parse HTTP transport options', () => {
      const config = loadConfig([
        '--url', 'http://localhost:6070',
        '--transport', 'http',
        '--port', '3000',
        '--host', '127.0.0.1',
      ]);
      expect(config.transport).toBe('http');
      expect(config.port).toBe(3000);
      expect(config.host).toBe('127.0.0.1');
    });

    describe('environment variable fallbacks', () => {
      it('should use MCP_TRANSPORT env var when CLI not provided', () => {
        vi.stubEnv('ZOEKT_URL', 'http://localhost:6070');
        vi.stubEnv('MCP_TRANSPORT', 'http');
        const config = loadConfig([]);
        expect(config.transport).toBe('http');
      });

      it('should prefer CLI --transport over MCP_TRANSPORT env var', () => {
        vi.stubEnv('ZOEKT_URL', 'http://localhost:6070');
        vi.stubEnv('MCP_TRANSPORT', 'http');
        const config = loadConfig(['--transport', 'stdio']);
        expect(config.transport).toBe('stdio');
      });

      it('should use LOG_LEVEL env var when CLI not provided', () => {
        vi.stubEnv('ZOEKT_URL', 'http://localhost:6070');
        vi.stubEnv('LOG_LEVEL', 'debug');
        const config = loadConfig([]);
        expect(config.logLevel).toBe('debug');
      });

      it('should prefer CLI --log-level over LOG_LEVEL env var', () => {
        vi.stubEnv('ZOEKT_URL', 'http://localhost:6070');
        vi.stubEnv('LOG_LEVEL', 'error');
        const config = loadConfig(['--log-level', 'warn']);
        expect(config.logLevel).toBe('warn');
      });

      it('should use ZOEKT_TIMEOUT_MS env var when CLI not provided', () => {
        vi.stubEnv('ZOEKT_URL', 'http://localhost:6070');
        vi.stubEnv('ZOEKT_TIMEOUT_MS', '5000');
        const config = loadConfig([]);
        expect(config.timeoutMs).toBe(5000);
      });

      it('should prefer CLI --timeout over ZOEKT_TIMEOUT_MS env var', () => {
        vi.stubEnv('ZOEKT_URL', 'http://localhost:6070');
        vi.stubEnv('ZOEKT_TIMEOUT_MS', '5000');
        const config = loadConfig(['--timeout', '10000']);
        expect(config.timeoutMs).toBe(10000);
      });
    });
  });
});
