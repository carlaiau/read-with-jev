import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { parseLiteral } from '../src/lib/literals';
import { literalMatches, evaluate } from '../src/lib/evaluate';
import { attachLabels, buildPassages } from '../src/lib/passages';
import { createRequest, validateAnswers } from '../src/server/jev';
import { readJson } from '../src/lib/io';
import type { Book } from '../src/lib/model';
import { chapterActivity } from '../app/reader-charts';

test('character sparklines measure actual chapter coverage', () => {
  const book = { passages: [{ chapter: 1, labels: ['a'] }, { chapter: 1, labels: ['b'] }, { chapter: 2, labels: ['b'] }] } as unknown as Book;
  const values = chapterActivity(book, ['a']);
  assert.equal(values.length, 61);
  assert.equal(values[0], 0.5); assert.equal(values[1], 0); assert.equal(values[60], 0);
});

test('PDNC literals parse nested lists, sets, apostrophes and escapes without executing code', () => {
  assert.deepEqual(parseLiteral(`[['Mr. Bennet'], ["Mr. Collins' Father", 'line\\nnext']]`), [['Mr. Bennet'], ["Mr. Collins' Father", 'line\nnext']]);
  assert.deepEqual(parseLiteral("{'Jane', 'Lizzy'}"), ['Jane', 'Lizzy']);
  assert.throws(() => parseLiteral("__import__('os').system('echo unsafe')"));
  assert.throws(() => parseLiteral('[1] trailing'));
});

test('literal baseline handles names inside longer names and rejects ambiguous aliases', () => {
  const cast = [{ id: 'father', name: 'Mr Bennet', aliases: ['Mr. Bennet', 'Bennet'] },
    { id: 'mother', name: 'Mrs Bennet', aliases: ['Mrs. Bennet', 'Bennet'] }, { id: 'ann', name: 'Ann', aliases: ['Ann'] }];
  assert.deepEqual([...literalMatches('Mrs . Bennet visited Anne.', cast)], ['mother']);
  assert.deepEqual([...literalMatches('Bennet', cast)], []);
});

test('passages partition text and context never crosses chapter boundaries', () => {
  const text = 'Jane left.\nDarcy stayed.\nJane spoke.';
  const passages = buildPassages(text, [[0, 10], [11, 24], [25, text.length]], [0, 25], 1);
  assert.equal(passages[0].start, 0); assert.equal(passages.at(-1)!.end, text.length);
  assert(passages.filter(p => p.chapter === 1).every(p => p.contextEnd <= 25));
  assert.equal(passages.at(-1)!.contextStart, 25);
  attachLabels(passages, [{ characterId: 'jane', span: [0, 4] }]);
  assert.deepEqual(passages[0].labels, ['jane']); assert.deepEqual(passages[1].labels, []);
});

test('metric calculation rejects missing pairs instead of interpreting failures as negatives', () => {
  const book: Book = { schema: 1, id: 'mentions', title: 'Test', layer: 'mentions', source: 'test', text: '', passages: [], evidence: [], provenance: {}, characters: [{ id: 'a', name: 'A', aliases: [] }, { id: 'b', name: 'B', aliases: [] }] };
  const passages = [{ id: 'p', labels: ['a'] }] as Book['passages'];
  assert.throws(() => evaluate(book, passages, []));
  const predictions = [{ passageId: 'p', characterId: 'a', probability: 1 }, { passageId: 'p', characterId: 'b', probability: 1 }];
  const result = evaluate(book, passages, predictions);
  assert.equal(result.micro.precision, 0.5); assert.equal(result.micro.recall, 1); assert.equal(result.brier, 0.5);
  assert.throws(() => evaluate(book, passages, [predictions[0], predictions[0]]));
});

test('official JS SDK serializes the typed request and supports Noul responses', async () => {
  const book = { id: 'mentions', text: 'Jane spoke.', characters: [{ id: 'jane', name: 'Jane', aliases: ['Jane'] }] } as Book;
  const p = { start: 0, end: 11, contextStart: 0, contextEnd: 11, labels: ['SECRET_GOLD'] } as Book['passages'][number];
  const request = createRequest(book, p, book.characters, true, 'jev-latest');
  assert(!JSON.stringify(request).includes('SECRET_GOLD'));
  let called = false;
  const client = new TypeSafeClient({ apiKey: 'test-only', retry: { maxRetries: 0 }, logLevel: 'off', fetch: async (url, options) => {
    called = true; assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    const body = JSON.parse(options!.body as string); assert.equal(body.questions.jane.type, 'noul');
    return new Response(JSON.stringify({ model: 'test-model', answers: { jane: { type: 'noul', noul: 0.9 } } }), { headers: { 'Content-Type': 'application/json' } });
  } });
  const response = await client.systemOne(request);
  assert(called); assert.deepEqual(validateAnswers(response, ['jane']), { jane: 0.9 });
  assert.throws(() => validateAnswers({ model: 'm', answers: { jane: { type: 'noul', noul: NaN } } }, ['jane']));
  assert.throws(() => validateAnswers({ model: 'm', answers: {} }, ['jane']));
});

test('prepared real corpora have complete text coverage, in-range evidence, and isolated chapter splits', async () => {
  for (const id of ['mentions', 'speaking']) {
    const book = await readJson<Book>(`data/processed/${id}.json`);
    assert.equal(new Set(book.passages.map(p => p.chapter)).size, 61);
    assert.equal(book.passages[0].start, 0); assert.equal(book.passages.at(-1)!.end, book.text.length);
    book.passages.slice(1).forEach((p, i) => assert.equal(p.start, book.passages[i].end));
    const characters = new Set(book.characters.map(c => c.id));
    for (const e of book.evidence) { assert(characters.has(e.characterId)); assert(e.span[0] >= 0 && e.span[1] <= book.text.length && e.span[1] > e.span[0]); }
    for (let chapter = 1; chapter <= 61; chapter++) assert.equal(new Set(book.passages.filter(p => p.chapter === chapter).map(p => p.split)).size, 1);
    assert(book.passages.every(p => p.contextStart <= p.start && p.contextEnd >= p.end));
  }
});


test('explicit mention prompt preserves target and context boundaries without gold leakage', () => {
  const book = { id: 'mentions', text: 'Before.Target.After.', characters: [{ id: 'a', name: 'Alice', aliases: ['Alice', 'Ally'] }] } as Book;
  const passage = { start: 7, end: 14, contextStart: 0, contextEnd: 20, labels: ['SECRET_GOLD'] } as Book['passages'][number];
  const original = createRequest(book, passage, book.characters, true, 'jev-1.13.0');
  const revised = createRequest(book, passage, book.characters, true, 'jev-1.13.0', 'explicit-mentions');
  assert.deepEqual(revised.state, original.state);
  assert.equal(revised.state.target, 'Target.');
  assert.equal(revised.state.precedingContext, 'Before.');
  assert.equal(revised.state.followingContext, 'After.');
  assert(!JSON.stringify(revised).includes('SECRET_GOLD'));
  assert.match(String(revised.questions.a.instructions), /Ally/);
  assert(revised.questions.a.criteria?.true);
  const withoutContext = createRequest(book, passage, book.characters, false, 'jev-1.13.0', 'explicit-mentions');
  assert.equal(withoutContext.state.target, 'Target.');
  assert.equal(withoutContext.state.precedingContext, '');
  assert.equal(withoutContext.state.followingContext, '');
  assert.throws(() => createRequest({ ...book, id: 'speaking' }, passage, book.characters, true, 'jev-1.13.0', 'explicit-mentions'));
});


test('book metadata changes only the state metadata and is optional', () => {
  const book = { id: 'mentions', text: 'Jane spoke.', characters: [{ id: 'jane', name: 'Jane', aliases: ['Jane'] }] } as Book;
  const passage = { start: 0, end: 11, contextStart: 0, contextEnd: 11 } as Book['passages'][number];
  const original = createRequest(book, passage, book.characters, true, 'jev-1.13.0');
  const enriched = createRequest(book, passage, book.characters, true, 'jev-1.13.0', 'original', { title: 'Pride and Prejudice', author: 'Jane Austen' });
  assert.deepEqual(enriched.questions, original.questions);
  const { book: metadata, ...state } = enriched.state;
  assert.deepEqual(state, original.state);
  assert.deepEqual(metadata, { title: 'Pride and Prejudice', author: 'Jane Austen' });
  assert(!('book' in original.state));
});
