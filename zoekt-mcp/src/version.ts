import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Resolves to the package root from both src/ (tsx) and dist/ (compiled).
const pkg = require('../package.json') as { version?: string };

/** Package version, single source of truth for all user-visible version strings. */
export const VERSION: string = pkg.version ?? '0.0.0';
