/**
 * Zoekt health check utility for integration tests
 */

/**
 * Wait for Zoekt webserver to become available
 * @param url - Zoekt webserver URL
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @throws Error if Zoekt is not available within timeout
 */
export async function waitForZoekt(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Zoekt returned status ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `Zoekt not available at ${url} after ${timeoutMs}ms. Last error: ${lastError?.message ?? 'unknown'}`
  );
}

/**
 * Check if Zoekt is currently available (non-blocking)
 * @param url - Zoekt webserver URL
 * @returns true if Zoekt responds successfully
 */
export async function isZoektAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the Zoekt URL from environment or default
 */
export function getZoektUrl(): string {
  return process.env.ZOEKT_URL ?? 'http://localhost:6070';
}
