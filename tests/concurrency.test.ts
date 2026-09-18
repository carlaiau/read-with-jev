import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapConcurrent } from '../src/lib/concurrency';
import { readJson } from '../src/lib/io';
import type { Book } from '../src/lib/model';
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
test('worker pool bounds parallelism and preserves results despite completion order', async () => {
  let active = 0, maximum = 0;
  const results = await mapConcurrent([30, 5, 10, 1, 5], 3, async (ms, index) => {
    maximum = Math.max(maximum, ++active); await pause(ms); active--; return index;
  });
  assert.equal(maximum, 3); assert.equal(active, 0); assert.deepEqual(results, [0, 1, 2, 3, 4]);
});
test('worker failure stops new scheduling and drains in-flight work', async () => {
  const started: number[] = []; let active = 0;
  await assert.rejects(mapConcurrent([0, 1, 2, 3, 4], 2, async index => {
    started.push(index); active++;
    try { await pause(index === 0 ? 1 : 20); if (index === 0) throw new Error('provider failure'); return index; }
    finally { active--; }
  }), /provider failure/);
  assert.deepEqual(started, [0, 1]); assert.equal(active, 0);
  await assert.rejects(mapConcurrent([], 0, async () => 1), /Concurrency/);
});
test('new book imports cover source text and keep context inside chapters', async () => {
  for (const [slug, chapters, characters] of [['siddhartha', 12, 9], ['animal-farm', 10, 20]] as const) {
    const book = await readJson<Book>(`data/processed/${slug}.json`);
    assert.equal(book.characters.length, characters);
    const starts = book.provenance.chapterStarts as number[];
    assert.equal(starts.length, chapters);
    assert.equal(book.passages[0].start, 0); assert.equal(book.passages.at(-1)!.end, book.text.length);
    book.passages.forEach((p, i) => {
      if (i) assert.equal(p.start, book.passages[i - 1].end);
      assert(p.contextStart >= starts[p.chapter - 1]); assert(p.contextEnd <= (starts[p.chapter] ?? book.text.length));
      assert(p.start <= p.end && p.contextStart <= p.start && p.contextEnd >= p.end);
      assert.deepEqual(p.labels, [...new Set(book.evidence.filter(e => e.span[0] < p.end && e.span[1] > p.start).map(e => e.characterId))].sort());
    });
    for (const e of book.evidence) { assert(book.characters.some(c => c.id === e.characterId)); assert(e.span[0] >= 0 && e.span[1] <= book.text.length && e.span[0] < e.span[1]); }
  }
});
