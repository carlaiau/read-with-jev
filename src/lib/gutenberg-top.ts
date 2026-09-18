import assert from 'node:assert/strict';
export type RankedBook = { gutenbergId: number; rank: number; listing: string; downloads: number };
export function parseTop100(html: string): RankedBook[] {
  const section = html.match(/<h2\b[^>]*id=["']books-last30["'][^>]*>[\s\S]*?<ol>([\s\S]*?)<\/ol>/i);
  assert(section, 'Missing last-30-days book list');
  const books = [...section[1].matchAll(/<a href="\/ebooks\/(\d+)">([\s\S]*?) \((\d+)\)<\/a>/g)].map((m, i) => ({
    gutenbergId: Number(m[1]), rank: i + 1, listing: m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), downloads: Number(m[3]),
  }));
  assert.equal(books.length, 100, 'Expected exactly 100 ranked books');
  assert.equal(new Set(books.map(b => b.gutenbergId)).size, 100, 'Duplicate Gutenberg ID');
  return books;
}
export function sourceMetadata(raw: string) {
  const header = raw.split(/\*\*\* START OF/i)[0].replace(/\r\n?/g, '\n');
  const field = (label: string) => header.match(new RegExp(`^${label}:[ \\t]*(.*(?:\\n[ \\t]+[^\\n]+)*)`, 'mi'))?.[1].replace(/\s+/g, ' ').trim() ?? null;
  return { title: field('Title'), author: field('Author'), language: field('Language'), releaseDate: field('Release date') };
}
