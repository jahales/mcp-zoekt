/**
 * Sample module with searchable functions
 */

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export async function processData(items: string[]): Promise<number> {
  const results = items.map(item => item.length);
  return results.reduce((a, b) => a + b, 0);
}

export class DataProcessor {
  private data: string[] = [];

  add(item: string): void {
    this.data.push(item);
  }

  get count(): number {
    return this.data.length;
  }
}
