/**
 * Helper utilities
 */

export const VERSION = '1.0.0';

export function formatMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export const SPECIAL_CHARS = 'Test with "quotes" and \'apostrophes\'';
