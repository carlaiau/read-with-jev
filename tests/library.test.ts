import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { digest } from '../src/lib/io';
import { literalMatches } from '../src/lib/evaluate';
import type { LibraryDocument, LibraryCatalog } from '../src/lib/library-model';
import libraryFunction from '../netlify/functions/library';
import { serveLibrary } from '../src/server/library';
import { removeIllustrations } from '../src/lib/library-prepare';
test('illustration cleanup removes nested captions without removing bracketed prose', () => {
  const source = 'news.\n[Illustration: Bennet\n[_Copyright 1894 by George Allen._]]\n[Illustration]\n[Enter Elizabeth.]';
  assert.equal(removeIllustrations(source), 'news.\n\n\n[Enter Elizabeth.]');
  assert.throws(() => removeIllustrations('prose [Illustration: incomplete'), /Unclosed/);
});
test('Pride and Prejudice chapter boundary has no orphaned illustration brackets', async () => {
  const book = JSON.parse(await readFile('data/library/pride-and-prejudice.json', 'utf8')) as LibraryDocument;
  assert.match(book.text, /daughters married: its solace was visiting and news\.\s+CHAPTER II\./);
  assert(!/^\s*\]+\s*$/m.test(book.text));
});
const request = (query = '', init?: RequestInit) => new Request(`http://localhost/.netlify/functions/library${query}`, init);
test('native Netlify handler serves a small multi-document catalog and exact prepared documents', async () => {
  const response = await libraryFunction(request()); assert.equal(response.status, 200);
  const catalog = await response.json() as LibraryCatalog; assert(catalog.documents.length >= 9); assert.equal(new Set(catalog.documents.map(d=>d.documentId)).size,catalog.documents.length);
  assert(catalog.documents.every(d => d.classification.kind === 'baseline' && !('text' in d)));
  for (const summary of catalog.documents) {
    const res = await libraryFunction(request(`?document=${summary.documentId}`)); assert.equal(res.status, 200);
    let raw = await res.text();
    const transport = JSON.parse(raw);
    if (transport.transport === 'json-parts') {
      const pieces:string[]=[];
      for(let part=0;part<transport.parts;part++){
        const response=await libraryFunction(request(`?document=${summary.documentId}&part=${part}&revision=${transport.revision}`));
        assert.equal(response.status,200);const json=await response.text();assert(Buffer.byteLength(json)<4_500_000);pieces.push(JSON.parse(json));
      }
      raw=pieces.join('');
      assert.equal((await libraryFunction(request(`?document=${summary.documentId}&part=0&revision=stale`))).status,409);
    }
    assert.equal(digest(raw), summary.revision);
    const doc = JSON.parse(raw) as LibraryDocument;
    assert.equal(doc.documentId, summary.documentId); assert.equal(doc.passages.length, summary.passages);
    assert.equal(doc.sections.length, summary.sections); assert.equal(doc.evidence.length, 0);
    assert.equal(doc.classification.kind, 'baseline'); assert(!raw.includes('TYPESAFE_API_KEY')); assert(!raw.includes('*** END OF'));
    assert(Buffer.byteLength(raw) < 30_000_000);
    assert.equal(doc.passages[0].start, 0); assert.equal(doc.passages.at(-1)!.end, doc.text.length);
    for (const [i,p] of doc.passages.entries()) {
      if (i) assert.equal(doc.passages[i-1].end, p.start);
      const section = doc.sections[p.chapter - 1]; assert(p.start >= section.start && p.end <= section.end);
      assert.deepEqual(p.labels, [...literalMatches(doc.text.slice(p.start,p.end),doc.characters)].sort());
    }
    const sectionCounts: Record<string,number> = {'moby-dick':138,'romeo-and-juliet':30,'crime-and-punishment':48};
    if(sectionCounts[doc.documentId]) assert.equal(doc.sections.length,sectionCounts[doc.documentId]);
    if (doc.provenance.segmentation !== 'automatic') assert(!doc.text.slice(0,200).includes('CONTENTS'));
  }
});
test('library rejects unknown IDs, traversal, invalid methods; supports HEAD and ETag validation', async () => {
  assert.equal((await libraryFunction(request('?document=unknown'))).status,404);
  assert.equal((await libraryFunction(request('?document=../../.env'))).status,400);
  assert.equal((await libraryFunction(request('?document='))).status,400);
  assert.equal((await libraryFunction(request('?path=.env'))).status,400);
  assert.equal((await libraryFunction(request('', {method:'POST'}))).status,405);
  const res=await libraryFunction(request('?document=frankenstein'));
  assert(res.headers.get('etag'));
  const cached=await libraryFunction(request('?document=frankenstein',{headers:{'If-None-Match':res.headers.get('etag')!}}));
  assert.equal(cached.status,304); assert.equal(await cached.text(),'');
  const head=await libraryFunction(request('',{method:'HEAD'}));assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await serveLibrary(request(), '/tmp/nonexistent-jev-library-test')).status,503);
});
test('library source locks cover every source and prepared source hashes match', async () => {
  const locks=JSON.parse(await readFile('library/sources.lock.json','utf8'));
  const catalog=JSON.parse(await readFile('data/library/catalog.json','utf8')) as LibraryCatalog;
  for(const item of catalog.documents){const doc=JSON.parse(await readFile(`data/library/${item.documentId}.json`,'utf8'));assert.equal(doc.provenance.sourceSha256,locks[item.documentId].sha256);}
});

test('oversized documents use revision-pinned parts and reconstruct byte-for-byte', async () => {
  const { mkdtemp, rm, writeFile }=await import('node:fs/promises');
  const { join }=await import('node:path');
  const { tmpdir }=await import('node:os');
  const dir=await mkdtemp(join(tmpdir(),'jev-transport-'));
  try{
    const raw=JSON.stringify({documentId:'large',text:'é😀'.repeat(800_000)});
    await writeFile(join(dir,'catalog.json'),JSON.stringify({schema:1,documents:[{documentId:'large'}]}));
    await writeFile(join(dir,'large.json'),raw);
    const manifest=await (await serveLibrary(request('?document=large'),dir)).json();
    assert.equal(manifest.transport,'json-parts');assert.equal(manifest.revision,digest(raw));
    const pieces=[];
    for(let part=0;part<manifest.parts;part++){
      const response=await serveLibrary(request(`?document=large&part=${part}&revision=${manifest.revision}`),dir);
      assert.equal(response.status,200);const body=await response.text();assert(Buffer.byteLength(body)<4_500_000);pieces.push(JSON.parse(body));
    }
    assert.equal(pieces.join(''),raw);
    assert.equal((await serveLibrary(request('?document=large&part=0&revision=stale'),dir)).status,409);
    assert.equal((await serveLibrary(request(`?document=large&part=999&revision=${manifest.revision}`),dir)).status,404);
    assert.equal((await serveLibrary(request('?part=0'),dir)).status,400);
  }finally{await rm(dir,{recursive:true,force:true});}
});
