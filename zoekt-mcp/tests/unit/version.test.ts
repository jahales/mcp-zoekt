/**
 * Unit tests for version resolution
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../../src/version.js';

describe('VERSION', () => {
  it('resolves from package.json, not the hardcoded fallback', () => {
    const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

    expect(VERSION).toBe(pkg.version);
    expect(VERSION).not.toBe('0.0.0');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
