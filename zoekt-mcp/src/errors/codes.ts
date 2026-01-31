/**
 * Structured error handling for Zoekt MCP tools
 * 
 * Provides error codes, enhanced error messages with hints,
 * and pattern matching for common Zoekt errors.
 */

/** Machine-readable error codes for programmatic handling */
export type ErrorCode = 'UNAVAILABLE' | 'QUERY_ERROR' | 'TIMEOUT' | 'NOT_FOUND';

/** Structured error response with actionable hints */
export interface StructuredError {
  /** Machine-readable error code */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Actionable suggestion for resolution */
  hint?: string;
  /** Additional error context */
  details?: Record<string, unknown>;
}

/** Valid Zoekt query fields for error hints */
const VALID_QUERY_FIELDS = [
  'file:', 'f:',
  'repo:', 'r:',
  'lang:', 'l:',
  'branch:', 'b:',
  'sym:',
  'content:', 'c:',
  'case:',
  'type:', 't:',
  'archived:', 'a:',
  'fork:',
  'public:',
  'regex:',
];

/**
 * Enhance a raw error with structured information and actionable hints
 */
export function enhanceError(error: unknown): StructuredError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Check for regex syntax errors
  if (isRegexError(lowerMessage)) {
    return {
      code: 'QUERY_ERROR',
      message,
      hint: 'Check regex syntax. Use /pattern/ for regex patterns, or "text" for literal text. ' +
            'Common issues: unescaped special characters (.*+?^$[]{}|\\), unbalanced parentheses.',
      details: { errorType: 'regex_syntax' },
    };
  }

  // Check for unknown field errors
  const unknownField = extractUnknownField(message);
  if (unknownField) {
    return {
      code: 'QUERY_ERROR',
      message,
      hint: `Unknown query field "${unknownField}". Valid fields: ${VALID_QUERY_FIELDS.join(', ')}`,
      details: { errorType: 'unknown_field', field: unknownField },
    };
  }

  // Check for timeout errors
  if (isTimeoutError(lowerMessage)) {
    return {
      code: 'TIMEOUT',
      message,
      hint: 'Search timed out. Try: (1) more specific query terms, (2) add repo: or file: filters, ' +
            '(3) use lang: to limit language scope, (4) reduce result limit.',
      details: { errorType: 'timeout' },
    };
  }

  // Check for unavailable/connection errors
  if (isUnavailableError(lowerMessage)) {
    return {
      code: 'UNAVAILABLE',
      message,
      hint: 'Zoekt backend is not reachable. Verify zoekt-webserver is running and accessible.',
      details: { errorType: 'connection' },
    };
  }

  // Check for not found errors
  if (isNotFoundError(lowerMessage)) {
    return {
      code: 'NOT_FOUND',
      message,
      hint: 'The requested resource was not found. Verify the repository name and file path are correct.',
      details: { errorType: 'not_found' },
    };
  }

  // Default: return as query error
  return {
    code: 'QUERY_ERROR',
    message,
    hint: 'Check query syntax. See Zoekt documentation for supported operators and fields.',
    details: { errorType: 'unknown' },
  };
}

/**
 * Format a structured error for MCP response
 */
export function formatStructuredError(error: StructuredError): string {
  let output = `**Error [${error.code}]**: ${error.message}`;
  if (error.hint) {
    output += `\n\n**Hint**: ${error.hint}`;
  }
  return output;
}

/**
 * Check if error message indicates a regex syntax error
 */
function isRegexError(message: string): boolean {
  const regexPatterns = [
    'regexp',
    'regex',
    'parse error',
    'invalid pattern',
    'unterminated',
    'unbalanced',
    'missing )',
    'missing ]',
    'bad escape',
    'invalid escape',
  ];
  return regexPatterns.some(pattern => message.includes(pattern));
}

/**
 * Extract unknown field name from error message
 */
function extractUnknownField(message: string): string | null {
  // Match patterns like "unknown field: xyz" or "invalid field 'xyz'"
  const patterns = [
    /unknown (?:field|operator)[:\s]+["']?(\w+)["']?/i,
    /invalid (?:field|operator)[:\s]+["']?(\w+)["']?/i,
    /unrecognized (?:field|operator)[:\s]+["']?(\w+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if error message indicates a timeout
 */
function isTimeoutError(message: string): boolean {
  return message.includes('timeout') || 
         message.includes('timed out') ||
         message.includes('deadline exceeded');
}

/**
 * Check if error message indicates backend unavailable
 */
function isUnavailableError(message: string): boolean {
  const patterns = [
    'unavailable',
    'connection refused',
    'econnrefused',
    'enotfound',
    'network error',
    'fetch failed',
    'cannot connect',
  ];
  return patterns.some(pattern => message.includes(pattern));
}

/**
 * Check if error message indicates not found
 */
function isNotFoundError(message: string): boolean {
  return message.includes('not found') || 
         message.includes('404') ||
         message.includes('no such file');
}
