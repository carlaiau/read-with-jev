import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makePairs, evaluatePairs, type AffectData, type Pair } from '../src/lib/affect';
import { digest, readJson } from '../src/lib/io';

type Run = { engine: string; prompt?: string; model: string | null; datasetHash: string; documentIds: string[]; scores: Record<string, number>; callsMade: number; elapsedMs: number; codeHashes?: Record<string, string>; responses: { cached: boolean; response: { model: string; usage?: { input_tokens: number; output_tokens: number } } }[] };
const paths = process.argv.slice(2);
assert(paths.length >= 2, 'Pass at least two explicit run JSON paths; first is the comparison baseline');
const runs = await Promise.all(paths.map(p => readJson<Run>(p)));
const raw = await readFile('data/processed/affect.json', 'utf8');
const data = JSON.parse(raw) as AffectData;
for (const r of runs) {
  assert.equal(r.datasetHash, digest(raw), 'Dataset mismatch');
  assert.deepEqual(r.documentIds, runs[0].documentIds, 'Samples differ');
}
const documents = runs[0].documentIds.map(id => {
  const d = data.documents.find(d => d.doc_id === id); assert(d, 'Missing document'); return d;
});
const pairs = documents.flatMap(makePairs);
const authors = [...new Set(documents.map(d => d.author))].sort();
const authorOf = new Map(documents.map(d => [d.doc_id, d.author]));
const linked = new Set(pairs.filter(p => p.gold).map(p => `${p.documentId}:${p.emotion.annotation_id}`));
const subsets = { strict: pairs, linkedExpressionsOnly: pairs.filter(p => linked.has(`${p.documentId}:${p.emotion.annotation_id}`)) };
let seed = 20260919;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
// Resample whole authors, paired across models. Report percentile intervals for F1 differences.
const resamples = Array.from({ length: 2000 }, () => authors.map(() => Math.floor(random() * authors.length)));
function deltas(subset: Pair[], a: Run, b: Run) {
  const counts = (r: Run) => authors.map(author => {
    const counts = [0, 0, 0];
    for (const p of subset.filter(p => authorOf.get(p.documentId) === author)) {
      const predicted = r.scores[p.id] >= .5;
      if (p.gold && predicted) counts[0]++; else if (!p.gold && predicted) counts[1]++; else if (p.gold) counts[2]++;
    }
    return counts;
  });
  const ca = counts(a), cb = counts(b);
  const f1 = (counts: number[][], sample: number[]) => {
    const sum = sample.reduce((acc, i) => acc.map((v,j) => v + counts[i][j]), [0,0,0]);
    return 2 * sum[0] / (2 * sum[0] + sum[1] + sum[2] || 1);
  };
  const distribution = resamples.map(sample => f1(cb, sample) - f1(ca, sample)).sort((a,b) => a-b);
  const full = authors.map((_,i) => i);
  return { deltaF1: f1(cb, full) - f1(ca, full), percentile95: [distribution[49], distribution[1949]] };
}
const label = (r: Run) => r.engine === 'jev' ? `jev-${r.prompt ?? 'v1'}` : r.engine;
const output = {
  datasetHash: digest(raw), documentIds: runs[0].documentIds, documents: documents.length, authors: authors.length,
  uncertainty: '2000 paired author-cluster bootstrap resamples, seed 20260919, fixed threshold .5; development estimates, not held-out evidence',
  runs: runs.map((r,i) => ({ path: paths[i], label: label(r), requestedModel: r.model, returnedModels: [...new Set(r.responses.map(x => x.response.model))],
    callsMade: r.callsMade, elapsedMs: r.elapsedMs, codeHashes: r.codeHashes,
    usage: { inputTokens: r.responses.reduce((n,x) => n + (x.response.usage?.input_tokens ?? 0), 0), outputTokens: r.responses.reduce((n,x) => n + (x.response.usage?.output_tokens ?? 0), 0) },
    metrics: Object.fromEntries(Object.entries(subsets).map(([name, subset]) => [name, evaluatePairs(subset, Object.fromEntries(subset.map(p => [p.id, r.scores[p.id]])))])),
  })),
  comparisons: runs.flatMap((a,i) => runs.slice(i+1).map(b => ({ baseline: label(a), candidate: label(b),
    subsets: Object.fromEntries(Object.entries(subsets).map(([name, subset]) => [name, deltas(subset,a,b)])) }))),
};
// Validate full matrices too: subset filtering must not hide missing/extra predictions.
for (const r of runs) evaluatePairs(pairs, r.scores);
console.log(JSON.stringify(output, null, 2));
