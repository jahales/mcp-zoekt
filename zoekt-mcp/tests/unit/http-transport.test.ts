/**
 * Unit tests for the HTTP/SSE transport session routing.
 *
 * These exercise the real server over loopback HTTP but need no Zoekt backend:
 * `initialize` and `tools/list` are answered by the MCP server itself. The
 * point is to lock in per-session routing so a regression to "last connection
 * wins" (the bug this replaced) can't pass CI.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer as createNetServer } from 'node:net';
import { createMcpServer, startServer, type RunningServer } from '../../src/server.js';
import { createLogger } from '../../src/logger.js';
import type { McpServerConfig } from '../../src/config.js';

const logger = createLogger('error');

/** Grab an OS-assigned free port so parallel test files don't collide. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function makeConfig(port: number): McpServerConfig {
  return {
    zoektUrl: 'http://127.0.0.1:1', // never contacted by initialize/tools/list
    transport: 'http',
    port,
    host: '127.0.0.1',
    logLevel: 'error',
    timeoutMs: 2000,
  };
}

interface SseClient {
  sessionId: string;
  endpoint: string;
  messages: Array<Record<string, unknown>>;
  waitFor: (predicate: (msg: Record<string, unknown>) => boolean) => Promise<Record<string, unknown>>;
  abort: () => void;
}

/** Open an SSE connection and start draining events in the background. */
async function openSse(base: string): Promise<SseClient> {
  const controller = new AbortController();
  const res = await fetch(`${base}/sse`, {
    signal: controller.signal,
    headers: { Accept: 'text/event-stream' },
  });
  if (!res.body) {
    throw new Error('SSE response had no body');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  const messages: Array<Record<string, unknown>> = [];
  const waiters: Array<{ predicate: (m: Record<string, unknown>) => boolean; resolve: (m: Record<string, unknown>) => void }> = [];
  let resolveEndpoint!: (v: string) => void;
  const endpointPromise = new Promise<string>((r) => { resolveEndpoint = r; });

  void (async () => {
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const evt of events) {
          const lines = evt.split('\n');
          const eventType = lines.find((l) => l.startsWith('event:'))?.slice('event:'.length).trim();
          const data = lines.find((l) => l.startsWith('data:'))?.slice('data:'.length).trim();
          if (!data) continue;
          if (eventType === 'endpoint') {
            resolveEndpoint(data);
            continue;
          }
          try {
            const msg = JSON.parse(data) as Record<string, unknown>;
            messages.push(msg);
            for (let i = waiters.length - 1; i >= 0; i--) {
              const waiter = waiters[i];
              if (waiter && waiter.predicate(msg)) {
                waiter.resolve(msg);
                waiters.splice(i, 1);
              }
            }
          } catch {
            // Non-JSON data event; ignore.
          }
        }
      }
    } catch {
      // Reader aborted on teardown.
    }
  })();

  const endpoint = await endpointPromise;
  const sessionId = new URL(endpoint, base).searchParams.get('sessionId');
  if (!sessionId) {
    throw new Error(`endpoint event had no sessionId: ${endpoint}`);
  }

  return {
    sessionId,
    endpoint,
    messages,
    waitFor: (predicate) =>
      new Promise((resolve, reject) => {
        const existing = messages.find(predicate);
        if (existing) {
          resolve(existing);
          return;
        }
        // Fail fast: if a response is misrouted it never arrives here, so bound
        // the wait rather than hanging until the whole test times out.
        const timer = setTimeout(
          () => reject(new Error(`timed out waiting for a matching SSE message on session ${sessionId}`)),
          4000
        );
        waiters.push({
          predicate,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        });
      }),
    abort: () => controller.abort(),
  };
}

function post(base: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
};

describe('HTTP/SSE transport', () => {
  let running: RunningServer | undefined;

  afterEach(async () => {
    if (running) {
      await running.close();
      running = undefined;
    }
  });

  it('routes /messages to the session in the query param, even for an older connection', async () => {
    const port = await freePort();
    const config = makeConfig(port);
    const base = `http://127.0.0.1:${port}`;
    running = await startServer(() => createMcpServer(config, logger), config, logger);

    // Open session 1 first, then session 2. The old bug routed every POST to
    // the most recently opened session (s2), so s1 could never be driven.
    const s1 = await openSse(base);
    const s2 = await openSse(base);
    expect(s1.sessionId).not.toBe(s2.sessionId);

    expect((await post(base, s1.endpoint, INITIALIZE)).status).toBe(202);
    await s1.waitFor((m) => m.id === 1);
    await post(base, s1.endpoint, { jsonrpc: '2.0', method: 'notifications/initialized' });

    expect((await post(base, s1.endpoint, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).status).toBe(202);
    const listMsg = await s1.waitFor((m) => m.id === 2);

    const result = listMsg.result as { tools: Array<{ name: string }> };
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'file_content',
      'find_references',
      'get_health',
      'list_repos',
      'search',
      'search_files',
      'search_symbols',
    ]);

    // s2 must not have received s1's response.
    expect(s2.messages.find((m) => m.id === 2)).toBeUndefined();

    s1.abort();
    s2.abort();
  }, 20000);

  it('rejects /messages posts with a missing or unknown sessionId', async () => {
    const port = await freePort();
    const config = makeConfig(port);
    const base = `http://127.0.0.1:${port}`;
    running = await startServer(() => createMcpServer(config, logger), config, logger);

    const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    expect((await post(base, '/messages', body)).status).toBe(400);
    expect((await post(base, '/messages?sessionId=not-a-real-session', body)).status).toBe(404);
  }, 20000);
});
