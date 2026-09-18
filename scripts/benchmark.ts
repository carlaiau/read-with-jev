import { mapConcurrent } from '../src/lib/concurrency';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import type { Book, Prediction } from '../src/lib/model';
import { baseline, evaluate } from '../src/lib/evaluate';
import { digest, writeJson } from '../src/lib/io';
import { asPredictions, classify, createClient, createRequest } from '../src/server/jev';

async function main() {
  const { values } = parseArgs({ options: { book: { type: 'string', default: 'pride-and-prejudice' }, concurrency: { type: 'string', default: '8' }, dataset: { type: 'string', default: 'mentions' }, engine: { type: 'string', default: 'baseline' },
    split: { type: 'string', default: 'dev' }, limit: { type: 'string', default: '12' }, context: { type: 'string', default: 'neighbors' },
    execute: { type: 'boolean', default: false }, 'cache-only': { type: 'boolean', default: false }, 'max-requests': { type: 'string' },
    'book-context': { type: 'boolean', default: false }, prompt: { type: 'string', default: 'original' }, threshold: { type: 'string', default: '0.5' } } });
  if (!['mentions', 'speaking'].includes(values.dataset!) || !['baseline', 'jev'].includes(values.engine!) || !['dev', 'test', 'all'].includes(values.split!) || !['none', 'neighbors'].includes(values.context!)) throw new Error('Invalid benchmark option');
  if (!['original', 'explicit-mentions'].includes(values.prompt!)) throw new Error('Invalid prompt');
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Concurrency must be 1–32');
  if (!['pride-and-prejudice', 'siddhartha', 'animal-farm'].includes(values.book!)) throw new Error('Invalid book');
  if (values.book !== 'pride-and-prejudice' && values.dataset !== 'mentions') throw new Error('Only mentions are available for this book');
  const artifact = values.book === 'pride-and-prejudice' ? values.dataset : values.book;
  const limit = Number(values.limit), threshold = Number(values.threshold);
  if (!Number.isInteger(limit) || limit <= 0 || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Invalid limit or threshold');
  const raw = await readFile(`data/processed/${artifact}.json`, 'utf8'), book = JSON.parse(raw) as Book;
  if (values['book-context'] && book.title !== 'Pride and Prejudice') throw new Error('Author metadata must be verified for this book');
  const bookContext = values['book-context'] ? { title: book.title, author: 'Jane Austen' } : undefined;
  const candidates = book.passages.filter(p => values.split === 'all' || p.split === values.split);
  const count = Math.min(limit, candidates.length);
  // Deterministic spread across chapters, not just the book opening.
  const passages = Array.from({ length: count }, (_, i) => candidates[Math.floor(i * candidates.length / count)]);
  const model = process.env.TYPESAFE_MODEL || 'jev-latest';
  const requests = passages.flatMap(p => {
    const batches = [];
    for (let i = 0; i < book.characters.length; i += 8) batches.push({ passage: p, request: createRequest(book, p, book.characters.slice(i, i + 8), values.context === 'neighbors', model, values.prompt as 'original' | 'explicit-mentions', bookContext) });
    return batches;
  });
  const plan = { book: values.book, concurrency, dataset: values.dataset, engine: values.engine, split: values.split, context: values.context, model, prompt: values.prompt, bookContext,
    passages: count, pairs: count * book.characters.length, requests: requests.length,
    inputCharacters: requests.reduce((n, r) => n + JSON.stringify(r.request).length, 0),
    pricing: 'User-supplied rate: $42 per billion input tokens; output free. Request cap is not a dollar cap.',
    sourceHash: digest(raw), passageIds: passages.map(p => p.id) };
  if (values.engine === 'jev' && !values.execute && !values['cache-only']) { console.log(JSON.stringify({ mode: 'dry-run', ...plan }, null, 2)); return; }
  const predictions: Prediction[] = [], calls: unknown[] = [];
  const started = Date.now();
  if (values.engine === 'baseline') predictions.push(...baseline(book, passages));
  else {
    const cap = Number(values['max-requests']);
    if (!values['cache-only'] && (!Number.isInteger(cap) || cap < requests.length)) throw new Error(`Set --max-requests to at least ${requests.length} for this run, or reduce --limit`);
    const client = values['cache-only'] ? undefined : createClient();
    const run = async ({ passage, request }: typeof requests[number]) => {
      const result = await classify(request, plan.sourceHash, !!values['cache-only'], client);
      return { predictions: asPredictions(passage.id, result.scores), call: { passageId: passage.id, cacheKey: result.key, cacheHit: result.cached, response: result.response } };
    };
    // Validate the first request before starting the concurrent pool. No automatic retries.
    const results = requests.length ? [await run(requests[0]), ...await mapConcurrent(requests.slice(1), concurrency, run)] : [];
    for (const result of results) { predictions.push(...result.predictions); calls.push(result.call); }

  }
  const metrics = evaluate(book, passages, predictions, threshold);
  const path = `data/runs/${values.book === 'pride-and-prejudice' ? '' : values.book + '-'}${values.dataset}-${values.engine}-${values.split}-${Date.now()}.json`;
  await writeJson(path, { status: 'complete', ...plan, elapsedMs: Date.now() - started, metrics, predictions, calls });
  console.log(JSON.stringify({ path, ...metrics, perCharacter: undefined }, null, 2));
}
main().catch(error => {
  // SDK errors can include request bodies; never print secrets or provider responses.
  console.error(error instanceof Error && error.constructor === Error ? error.message : `Benchmark failed (${error?.constructor?.name ?? 'unknown error'}). No completed run written.`);
  process.exitCode = 1;
});
