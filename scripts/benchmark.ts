import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import type { Book, Prediction } from '../src/lib/model';
import { baseline, evaluate } from '../src/lib/evaluate';
import { digest, writeJson } from '../src/lib/io';
import { asPredictions, classify, createClient, createRequest } from '../src/server/jev';

async function main() {
  const { values } = parseArgs({ options: { dataset: { type: 'string', default: 'mentions' }, engine: { type: 'string', default: 'baseline' },
    split: { type: 'string', default: 'dev' }, limit: { type: 'string', default: '12' }, context: { type: 'string', default: 'neighbors' },
    execute: { type: 'boolean', default: false }, 'cache-only': { type: 'boolean', default: false }, 'max-requests': { type: 'string' },
    threshold: { type: 'string', default: '0.5' } } });
  if (!['mentions', 'speaking'].includes(values.dataset!) || !['baseline', 'jev'].includes(values.engine!) || !['dev', 'test'].includes(values.split!) || !['none', 'neighbors'].includes(values.context!)) throw new Error('Invalid benchmark option');
  const limit = Number(values.limit), threshold = Number(values.threshold);
  if (!Number.isInteger(limit) || limit <= 0 || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Invalid limit or threshold');
  const raw = await readFile(`data/processed/${values.dataset}.json`, 'utf8'), book = JSON.parse(raw) as Book;
  const candidates = book.passages.filter(p => p.split === values.split);
  const count = Math.min(limit, candidates.length);
  // Deterministic spread across chapters, not just the book opening.
  const passages = Array.from({ length: count }, (_, i) => candidates[Math.floor(i * candidates.length / count)]);
  const model = process.env.TYPESAFE_MODEL || 'jev-latest';
  const requests = passages.flatMap(p => {
    const batches = [];
    for (let i = 0; i < book.characters.length; i += 8) batches.push({ passage: p, request: createRequest(book, p, book.characters.slice(i, i + 8), values.context === 'neighbors', model) });
    return batches;
  });
  const plan = { dataset: values.dataset, engine: values.engine, split: values.split, context: values.context, model,
    passages: count, pairs: count * book.characters.length, requests: requests.length,
    inputCharacters: requests.reduce((n, r) => n + JSON.stringify(r.request).length, 0),
    pricing: 'No price estimate: provider rates have not been configured. Request cap is not a dollar cap.',
    sourceHash: digest(raw), passageIds: passages.map(p => p.id) };
  if (values.engine === 'jev' && !values.execute && !values['cache-only']) { console.log(JSON.stringify({ mode: 'dry-run', ...plan }, null, 2)); return; }
  const predictions: Prediction[] = [], calls: unknown[] = [];
  const started = Date.now();
  if (values.engine === 'baseline') predictions.push(...baseline(book, passages));
  else {
    const cap = Number(values['max-requests']);
    if (!values['cache-only'] && (!Number.isInteger(cap) || cap < requests.length)) throw new Error(`Set --max-requests to at least ${requests.length} for this run, or reduce --limit`);
    const client = values['cache-only'] ? undefined : createClient();
    for (const { passage, request } of requests) {
      const result = await classify(request, plan.sourceHash, !!values['cache-only'], client);
      predictions.push(...asPredictions(passage.id, result.scores));
      calls.push({ passageId: passage.id, cacheKey: result.key, cacheHit: result.cached, response: result.response });
    }
  }
  const metrics = evaluate(book, passages, predictions, threshold);
  const path = `data/runs/${values.dataset}-${values.engine}-${values.split}-${Date.now()}.json`;
  await writeJson(path, { status: 'complete', ...plan, elapsedMs: Date.now() - started, metrics, predictions, calls });
  console.log(JSON.stringify({ path, ...metrics, perCharacter: undefined }, null, 2));
}
main().catch(error => {
  // SDK errors can include request bodies; never print secrets or provider responses.
  console.error(error instanceof Error && error.constructor === Error ? error.message : `Benchmark failed (${error?.constructor?.name ?? 'unknown error'}). No completed run written.`);
  process.exitCode = 1;
});
