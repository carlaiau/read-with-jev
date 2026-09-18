import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { baseline, evaluatePairs, makePairs, type AffectData, type AffectDocument } from '../src/lib/affect';
const document: AffectDocument = { doc_id: 'synthetic', author: 'Fixture', book_title: 'Synthetic unit fixture, not evaluation gold', split: 'dev', text: 'Ann fears Bob.',
  spans: [
    { annotation_id: 'a', type: 'character', text: 'Ann', start: 0, end: 3 },
    { annotation_id: 'e', type: 'fear', text: 'fears', start: 4, end: 9 },
    { annotation_id: 'b', type: 'character', text: 'Bob', start: 10, end: 13 },
  ], relations: [{ type: 'experiencer', source_annotation_id: 'e', target_annotation_id: 'a' }, { type: 'target', source_annotation_id: 'e', target_annotation_id: 'b' }] };

test('affect relations distinguish experiencer from target and preserve tied baseline candidates', () => {
  const pairs = makePairs(document);
  assert.deepEqual(pairs.map(p => p.gold), [true, false]);
  assert.deepEqual(pairs.map(p => baseline(p, document, 'nearest', {})), [1, 1]);
  assert.deepEqual(pairs.map(p => baseline(p, document, 'nrc-nearest', {})), [0, 0]);
  const scores = Object.fromEntries(pairs.map(p => [p.id, 1]));
  assert.equal(evaluatePairs(pairs, scores).micro.f1, 2 / 3);
  delete scores[pairs[0].id];
  assert.throws(() => evaluatePairs(pairs, scores), /Incomplete/);
  assert.throws(() => evaluatePairs(pairs, Object.fromEntries(pairs.map(p => [p.id, NaN]))), /Invalid probability/);
});

test('affect pair preparation fails on shifted offsets and dangling edges', () => {
  const shifted = structuredClone(document); shifted.spans[0].start = 1;
  assert.throws(() => makePairs(shifted), /Offset mismatch/);
  const dangling = structuredClone(document); dangling.relations[0].target_annotation_id = 'missing';
  assert.throws(() => makePairs(dangling), /Dangling/);
});

test('XML adapter preserves Unicode offsets and quarantines source mismatch', () => {
  execFileSync('python3', ['-c', `
import importlib.util, xml.etree.ElementTree as ET
spec = importlib.util.spec_from_file_location('affect', 'scripts/prepare-affect.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
x = ET.fromstring('<document doc_id="fixture" author="Fixture"><text>😀 Ann</text><adjudicated><spans><span annotation_id="a" type="character" cbegin="2" cend="5">Ann</span></spans><relations/></adjudicated></document>')
d, issues = m.parse_document(x)
assert issues == [] and d['spans'][0]['start'] == 3 and d['spans'][0]['end'] == 6
x.find('./adjudicated/spans/span').text = 'Bob'
assert m.parse_document(x)[1][0]['reason'] == 'span-offset-mismatch'
`]);
});

test('prepared affect data preserves author isolation, exact offsets and source pins', () => {
  const data = JSON.parse(readFileSync('data/processed/affect.json', 'utf8')) as AffectData;
  assert.equal(data.documents.length, 1569);
  const authors = new Map<string, string>();
  const ids = new Set<string>();
  for (const doc of data.documents) {
    assert(!ids.has(doc.doc_id)); ids.add(doc.doc_id);
    assert(!authors.has(doc.author) || authors.get(doc.author) === doc.split); authors.set(doc.author, doc.split);
    makePairs(doc);
  }
  assert.equal(data.sources.reman.sha256, '8f459b868ee77accb59b8b96566e1a263dd748492dd5af8b17feb512b928f8f8');
});
