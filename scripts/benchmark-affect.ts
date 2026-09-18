import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createAffectRequest, type AffectPrompt } from '../src/server/affect-request';
import { makePairs, baseline, evaluatePairs, type AffectData } from '../src/lib/affect';
import { digest, readJson, writeJson } from '../src/lib/io';
import { createClient, validateAnswers } from '../src/server/jev';

const { values } = parseArgs({ options: {
  engine: { type: 'string', default: 'nearest' }, limit: { type: 'string', default: '12' }, split: { type: 'string', default: 'dev' },
  'exclude-authors-from': { type: 'string' },
  prompt: { type: 'string', default: 'v2' }, offset: { type: 'string', default: '0' }, model: { type: 'string' },
  execute: { type: 'boolean', default: false }, 'max-requests': { type: 'string', default: '0' }, 'cache-only': { type: 'boolean', default: false },
} });
const engine = values.engine!;
assert(['nearest', 'preceding', 'all', 'nrc-nearest', 'jev'].includes(engine), 'Unknown engine');
assert(['dev', 'test'].includes(values.split!), 'Unknown split');
const limit = Number(values.limit), cap = Number(values['max-requests']), offset = Number(values.offset);
assert(Number.isSafeInteger(offset) && offset >= 0, 'Invalid offset');
assert(['v1', 'v2', 'v3'].includes(values.prompt!), 'Unknown prompt');
const prompt = values.prompt as AffectPrompt;
assert(Number.isSafeInteger(limit) && limit > 0 && Number.isSafeInteger(cap) && cap >= 0, 'Invalid limit/cap');
assert(!(values.execute && values['cache-only']), 'Choose execute or cache-only');
const raw = await readFile('data/processed/affect.json', 'utf8');
const data = JSON.parse(raw) as AffectData;
const excludedAuthors = new Set<string>();
if (values['exclude-authors-from']) {
  const manifest = await readJson<{datasetHash: string; documentIds: string[]}>(values['exclude-authors-from']);
  assert.equal(manifest.datasetHash, digest(raw), 'Exclusion manifest dataset differs');
  for (const id of manifest.documentIds) {
    const d = data.documents.find(d => d.doc_id === id); assert(d, 'Unknown excluded document');
    excludedAuthors.add(d.author);
  }
}
const available = data.documents.filter(d => d.split === values.split && !excludedAuthors.has(d.author) && makePairs(d).length).sort((a,b) => digest(a.doc_id).localeCompare(digest(b.doc_id)));
const documents = available.slice(offset, offset + limit);
assert(documents.length, 'No eligible documents');
const pairs = documents.flatMap(makePairs);
const model = values.model ?? process.env.TYPESAFE_MODEL ?? 'jev-latest';
// Gold emotion spans/types and character mentions are supplied inputs in this conditional task.
// No relation edges, modifier labels, author names, or book titles enter the model state.
const jobs = documents.flatMap(document => {
  const ps = makePairs(document); const jobs = [];
  for (let i = 0; i < ps.length; i += 8) {
    const chunk = ps.slice(i, i + 8);
    const request = createAffectRequest(document, chunk, model, prompt);
    jobs.push({ documentId: document.doc_id, chunk, request });
  }
  return jobs;
});
const plan = { task: 'REMAN supplied-emotion-and-character experiencer relation classification v1', engine, split: values.split,
  prompt: engine === 'jev' ? prompt : null, offset, excludedAuthors: [...excludedAuthors].sort(),
  datasetHash: digest(raw), sourceHashes: data.sources, documents: documents.length, eligibleDocuments: available.length, pairs: pairs.length,
  requests: engine === 'jev' ? jobs.length : 0, model: engine === 'jev' ? model : null, documentIds: documents.map(d => d.doc_id),
  caveat: 'Conditional mention-level attribution of annotated expressions, including negated/hypothetical emotion. Not actual felt emotion, extraction, full character coreference, or an emotional arc.' };
if (engine === 'jev' && !values.execute && !values['cache-only']) {
  console.log(JSON.stringify({ ...plan, status: 'dry-run', inputCharacters: jobs.reduce((n,j) => n + JSON.stringify(j.request).length, 0) }, null, 2));
} else {
  if (engine === 'jev' && values.execute) assert(jobs.length <= cap, `Planned ${jobs.length} requests exceeds cap ${cap}`);
  const client = engine === 'jev' && values.execute ? createClient() : undefined;
  const scores: Record<string, number> = {}; const responses = []; const start = Date.now();
  if (engine === 'jev') {
    for (const job of jobs) {
      const key = digest(JSON.stringify({ taskVersion: 1, datasetHash: plan.datasetHash, request: job.request }));
      const path = `data/cache/affect-${key}.json`;
      let response: unknown, cached = true;
      try { response = await readJson(path); }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        assert(client, `Missing cache ${key}`); cached = false;
        response = await client.systemOne(job.request);
        validateAnswers(response, Object.keys(job.request.questions));
        await writeJson(path, response);
      }
      const answers = validateAnswers(response, Object.keys(job.request.questions));
      job.chunk.forEach((p,j) => { scores[p.id] = answers[`q${j}`]; });
      responses.push({ key, cached, request: job.request, response });
    }
  } else {
    for (const document of documents) for (const pair of makePairs(document)) scores[pair.id] = baseline(pair, document, engine, data.lexicon);
  }
  const eightPairs = pairs.filter(p => p.emotion.type !== 'other-emotion');
  const linkedExpressions = new Set(pairs.filter(p => p.gold).map(p => `${p.documentId}:${p.emotion.annotation_id}`));
  const linkedPairs = pairs.filter(p => linkedExpressions.has(`${p.documentId}:${p.emotion.annotation_id}`));
  const metrics = { ...evaluatePairs(pairs, scores), linkedExpressionsOnly: evaluatePairs(linkedPairs, Object.fromEntries(linkedPairs.map(p => [p.id, scores[p.id]]))), nrcEightOnly: evaluatePairs(eightPairs, Object.fromEntries(eightPairs.map(p => [p.id, scores[p.id]]))) };
  const report = { ...plan, startedAt: new Date(start).toISOString(), callsMade: responses.filter(r => !r.cached).length, codeHashes: Object.fromEntries(await Promise.all(['scripts/benchmark-affect.ts', 'src/server/affect-request.ts', 'src/lib/affect.ts'].map(async p => [p, digest(await readFile(p))]))), status: 'complete', elapsedMs: Date.now() - start, metrics, scores, responses };
  const path = `data/runs/affect-${engine}-${values.split}-${documents.length}-${digest(JSON.stringify(plan)).slice(0,12)}-${start}.json`;
  await writeJson(path, report);
  console.log(JSON.stringify({ path, documents: documents.length, pairs: pairs.length, callsMade: report.callsMade, micro: metrics.micro, linkedExpressionsOnly: metrics.linkedExpressionsOnly.micro }, null, 2));
}
