/**
 * MCP Test Client - Subprocess-based client for protocol testing
 * 
 * Spawns the MCP server as a child process and communicates via stdio
 * using JSON-RPC 2.0 protocol.
 */

import { spawn, ChildProcess } from 'node:child_process';
import { createInterface, Interface } from 'node:readline';
import { resolve } from 'node:path';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Subprocess-based MCP client for testing protocol compliance
 */
export class McpTestClient {
  private process: ChildProcess | null = null;
  private readline: Interface | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();
  private serverPath: string;
  private zoektUrl: string;

  constructor(options: { serverPath?: string; zoektUrl?: string } = {}) {
    this.serverPath = options.serverPath ?? resolve(__dirname, '../../dist/index.js');
    this.zoektUrl = options.zoektUrl ?? process.env.ZOEKT_URL ?? 'http://localhost:6070';
  }

  /**
   * Start the MCP server subprocess
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('MCP client already started');
    }

    this.process = spawn('node', [this.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ZOEKT_URL: this.zoektUrl,
        LOG_LEVEL: 'error', // Reduce noise in test output
      },
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error('Failed to create stdio streams');
    }

    // Set up readline for parsing JSON-RPC responses
    this.readline = createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity,
    });

    this.readline.on('line', (line: string) => {
      this.handleLine(line);
    });

    // Handle process errors
    this.process.on('error', (error) => {
      console.error('MCP server process error:', error);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      // Log stderr for debugging but don't fail
      const msg = data.toString().trim();
      if (msg && !msg.includes('"level"')) {
        console.error('MCP server stderr:', msg);
      }
    });

    // Wait for server to be ready (small delay for initialization)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Handle incoming JSON-RPC response line
   */
  private handleLine(line: string): void {
    if (!line.trim()) return;

    try {
      const response = JSON.parse(line) as JsonRpcResponse;
      
      if (response.id !== undefined) {
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      }
    } catch {
      // Not JSON or not a response we care about
    }
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  async sendRequest(method: string, params?: unknown, timeoutMs = 10000): Promise<JsonRpcResponse> {
    if (!this.process?.stdin) {
      throw new Error('MCP client not started');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.process!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Send tools/list request
   */
  async listTools(): Promise<JsonRpcResponse> {
    return this.sendRequest('tools/list');
  }

  /**
   * Send tools/call request
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<JsonRpcResponse> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  /**
   * Stop the MCP server subprocess
   */
  async close(): Promise<void> {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    if (this.process) {
      this.process.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }

    // Reject any pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Client closed'));
      this.pendingRequests.delete(id);
    }
  }
}
