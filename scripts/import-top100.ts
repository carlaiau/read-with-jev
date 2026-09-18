import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parseTop100, sourceMetadata, type RankedBook } from '../src/lib/gutenberg-top';
import { atomicWrite, digest, readJson, writeJson } from '../src/lib/io';
const url = 'https://www.gutenberg.org/browse/scores/top#books-last30';
const snapshotPath = 'library/top100.json';
const refresh = process.argv.includes('--refresh-list');
let snapshot: { schema: number; source: string; fetchedAt: string; pageSha256: string; books: RankedBook[] };
try { snapshot = await readJson(snapshotPath); }
catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; if (!refresh) refreshRequired(); }
function refreshRequired(): never { throw new Error('Run with --refresh-list to create the initial snapshot'); }
if (refresh) {
  const local = process.argv.find(a => a.startsWith('--list-file='))?.slice('--list-file='.length);
  const html = local ? await readFile(local, 'utf8') : await download(url);
  snapshot = { schema: 1, source: url, fetchedAt: new Date().toISOString(), pageSha256: digest(html), books: parseTop100(html) };
  await writeJson(snapshotPath, snapshot);
}
async function download(source: string) {
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) });
  assert(response.ok, `${response.status} downloading ${source}`);
  return response.text();
}
const entries = [];
for (const book of snapshot!.books) {
  const sourceUrl = `https://www.gutenberg.org/cache/epub/${book.gutenbergId}/pg${book.gutenbergId}.txt`;
  try {
    const path = `data/library-sources/${book.gutenbergId}.txt`;
    let raw: string;
    try { raw = await readFile(path, 'utf8'); } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      raw = await download(sourceUrl);
      assert(/\*\*\* START OF/i.test(raw) && /\*\*\* END OF/i.test(raw), 'Missing Gutenberg text markers');
      await atomicWrite(path, raw);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const metadata = sourceMetadata(raw);
    const english = metadata.language?.trim().toLowerCase() === 'english';
    entries.push({ ...book, ...metadata, sourceUrl, sourceSha256: digest(raw), bytes: Buffer.byteLength(raw), status: english ? 'downloaded' : 'excluded-language', castStatus: english ? 'pending' : 'not-applicable' });
    console.log(`${book.rank}/100: ${book.gutenbergId} downloaded`);
  } catch (e) {
    entries.push({ ...book, sourceUrl, status: 'failed', error: (e as Error).message });
    console.error(`${book.gutenbergId}: ${(e as Error).message}`);
  }
  await writeJson('library/top100-import.json', { schema: 1, snapshotSha256: digest(JSON.stringify(snapshot!)), entries });
}
if (entries.some(e => e.status === 'failed')) process.exitCode = 1;
