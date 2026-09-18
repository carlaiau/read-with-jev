import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import curated from '../library/documents.json';
let imported: DocumentSpec[] = [];
try { imported = JSON.parse(await readFile('library/top100-documents.json', 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
const specs: DocumentSpec[] = [...curated as DocumentSpec[], ...imported];
import type { DocumentSpec, LibraryCatalog } from '../src/lib/library-model';
import { prepareLibraryDocument } from '../src/lib/library-prepare';
import { digest, writeJson, atomicWrite } from '../src/lib/io';
const refresh = process.argv.includes('--update-source-lock');
let locks: Record<string, { url: string; sha256: string }> = {};
try { locks = JSON.parse(await readFile('library/sources.lock.json', 'utf8')); } catch (e) { if (!refresh || (e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
const catalog: LibraryCatalog = { schema: 1, documents: [] };
if (imported.length) {
  const manifest = JSON.parse(await readFile('library/top100-import.json', 'utf8'));
  catalog.importStatus = {english: manifest.publication.english ?? manifest.entries.filter((e: {status:string}) => e.status === 'downloaded').length, ready: manifest.publication.ready, pending: manifest.publication.pending, excluded: manifest.entries.filter((e: {status:string}) => e.status === 'excluded-language').length};
}
await mkdir('data/library-sources', { recursive: true });
for (const spec of specs as DocumentSpec[]) {
  assert(/^[a-z0-9-]+$/.test(spec.id));
  const file = `data/library-sources/${spec.gutenbergId ?? spec.id}.txt`;
  let raw: string;
  try { raw = await readFile(file, 'utf8'); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    const response = await fetch(spec.sourceUrl, { signal: AbortSignal.timeout(60000) });
    assert(response.ok, `Download failed for ${spec.id}: ${response.status}`); raw = await response.text();
    await atomicWrite(file, raw);
  }
  const sha256 = digest(raw);
  if (refresh) locks[spec.id] = { url: spec.sourceUrl, sha256 };
  else { assert.equal(locks[spec.id]?.url, spec.sourceUrl, 'Unpinned source'); assert.equal(locks[spec.id]?.sha256, sha256, `Source changed for ${spec.id}; review before refreshing the lock`); }
  const book = prepareLibraryDocument(spec, raw, sha256);
  const json = JSON.stringify(book); assert(Buffer.byteLength(json) < 30_000_000, 'Document exceeds library document budget');
  await atomicWrite(`data/library/${spec.id}.json`, json);
  catalog.documents.push({ documentId: spec.id, title: book.title, author: book.author, year: book.year, source: book.source, classification: book.classification, passages: book.passages.length, characters: book.characters.length, sections: book.sections.length, revision: digest(json) });
  console.log(`${book.title}: ${book.passages.length} passages, ${book.sections.length} sections, ${Buffer.byteLength(json)} bytes`);
}
if (refresh) await writeJson('library/sources.lock.json', locks);
await writeJson('data/library/catalog.json', catalog);
