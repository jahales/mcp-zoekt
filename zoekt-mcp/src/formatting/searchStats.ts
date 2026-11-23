import type { SearchStats } from '../zoekt/types.js';

/**
 * Format Zoekt's match and file totals for a search.
 */
export function formatSearchStats(stats: SearchStats): string {
  const durationMs = stats.Duration / 1_000_000; // nanoseconds to ms
  let output = `Stats: ${stats.MatchCount} matches in ${stats.FileCount} files (${durationMs.toFixed(0)}ms)\n`;
  // Zoekt stops a shard at ShardMaxMatchCount and abandons the remaining
  // shards past TotalMaxMatchCount or on timeout, reporting what it skipped.
  if (stats.FilesSkipped || stats.ShardsSkipped) {
    output += 'These totals are lower bounds: Zoekt stopped early at a match limit or timeout.\n';
  }
  return output;
}
