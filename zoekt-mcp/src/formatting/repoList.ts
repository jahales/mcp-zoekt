import type { Repository } from '../zoekt/types.js';

/**
 * Format bytes to human-readable compact string
 */
export function formatBytesCompact(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return unitIndex === 0 ? `${size} ${units[unitIndex]}` : `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format repository list with enriched metadata
 */
export function formatRepoList(
  repos: Repository[],
  filter?: string
): string {
  let output = '## Indexed Repositories\n\n';
  
  const filterNote = filter ? ` matching '${filter}'` : '';
  output += `Found ${repos.length} repositories${filterNote}:\n\n`;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    if (repo) {
      const docCount = repo.documentCount.toLocaleString('en-US');
      const size = formatBytesCompact(repo.contentBytes);
      output += `${i + 1}. **${repo.name}** (${docCount} files, ${size})\n`;

      // Branches with truncated SHAs
      if (repo.branches.length > 0) {
        const branchList = repo.branches
          .map((b) => b.version ? `${b.name}@${b.version.slice(0, 7)}` : b.name)
          .join(', ');
        output += `   Branches: ${branchList}\n`;
      }

      // Symbols and index date
      const symbolIndicator = repo.hasSymbols ? '✅' : '❌';
      const indexDate = repo.indexTime
        ? repo.indexTime.toISOString().slice(0, 10)
        : undefined;
      const datePart = indexDate ? ` | Indexed: ${indexDate}` : '';
      output += `   Symbols: ${symbolIndicator}${datePart}\n`;
    }
  }

  output += `\nTotal: ${repos.length} repositories\n`;
  return output;
}

/**
 * Format empty repository response
 */
export function formatEmptyResponse(filter?: string): string {
  const message = filter
    ? `No repositories found matching '${filter}'.`
    : 'No repositories are currently indexed.';
  return `## Indexed Repositories\n\n${message}`;
}
