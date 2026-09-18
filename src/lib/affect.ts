import assert from 'node:assert/strict';
export type AffectSpan = { annotation_id: string; type: string; text: string; start: number; end: number; modifier?: string };
export type AffectDocument = { doc_id: string; author: string; book_title: string; text: string; split: 'dev' | 'test'; spans: AffectSpan[]; relations: { type: string; source_annotation_id: string; target_annotation_id: string }[] };
export type AffectData = { version: number; sources: Record<string, { url: string; sha256: string }>; documents: AffectDocument[]; lexicon: Record<string, string[]> };
export const emotions = ['anger', 'anticipation', 'disgust', 'fear', 'joy', 'sadness', 'surprise', 'trust', 'other-emotion'];
export type Pair = { id: string; documentId: string; emotion: AffectSpan; character: AffectSpan; gold: boolean };

export function makePairs(document: AffectDocument): Pair[] {
  const ids = new Set<string>();
  for (const span of document.spans) {
    assert(!ids.has(span.annotation_id), 'Duplicate span ID'); ids.add(span.annotation_id);
    assert(Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= document.text.length, 'Invalid offsets');
    assert.equal(document.text.slice(span.start, span.end), span.text, 'Offset mismatch');
  }
  for (const relation of document.relations) assert(ids.has(relation.source_annotation_id) && ids.has(relation.target_annotation_id), 'Dangling relation');
  return document.spans.filter(s => emotions.includes(s.type)).flatMap(emotion => document.spans.filter(s => s.type === 'character').map(character => ({
    id: `${document.doc_id}:${emotion.annotation_id}:${character.annotation_id}`, documentId: document.doc_id, emotion, character,
    gold: document.relations.some(r => r.type === 'experiencer' && r.source_annotation_id === emotion.annotation_id && r.target_annotation_id === character.annotation_id),
  })));
}
const gap = (a: AffectSpan, b: AffectSpan) => Math.max(0, a.start - b.end, b.start - a.end);
export function baseline(pair: Pair, document: AffectDocument, engine: string, lexicon: AffectData['lexicon']): number {
  if (engine === 'all') return 1;
  if (engine === 'preceding') {
    const before = document.spans.filter(s => s.type === 'character' && s.end <= pair.emotion.start);
    if (!before.length) return baseline(pair, document, 'nearest', lexicon);
    return Number(pair.character.end === Math.max(...before.map(s => s.end)));
  }
  const nearest = Math.min(...document.spans.filter(s => s.type === 'character').map(s => gap(pair.emotion, s)));
  if (gap(pair.emotion, pair.character) !== nearest) return 0;
  if (engine === 'nrc-nearest') {
    const words = pair.emotion.text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
    return Number(words.some(w => lexicon[w]?.includes(pair.emotion.type)));
  }
  assert.equal(engine, 'nearest'); return 1;
}
export function evaluatePairs(pairs: Pair[], scores: Record<string, number>, threshold = 0.5) {
  assert(Number.isFinite(threshold) && threshold >= 0 && threshold <= 1, 'Invalid threshold');
  assert.equal(new Set(pairs.map(p => p.id)).size, pairs.length, 'Duplicate pair IDs');
  assert.deepEqual(Object.keys(scores).sort(), pairs.map(p => p.id).sort(), 'Incomplete or unexpected predictions');
  const count = (subset: Pair[]) => {
    let tp = 0, fp = 0, fn = 0, tn = 0, brier = 0;
    for (const p of subset) {
      const score = scores[p.id]; assert(Number.isFinite(score) && score >= 0 && score <= 1, 'Invalid probability');
      const predicted = score >= threshold;
      if (p.gold && predicted) tp++; else if (p.gold) fn++; else if (predicted) fp++; else tn++;
      brier += (score - Number(p.gold)) ** 2;
    }
    return { pairs: subset.length, support: tp + fn, tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : 0,
      recall: tp + fn ? tp / (tp + fn) : 0, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0, brier: subset.length ? brier / subset.length : null };
  };
  const perEmotion = Object.fromEntries(emotions.map(e => [e, count(pairs.filter(p => p.emotion.type === e))]));
  const supported = Object.values(perEmotion).filter(x => x.support);
  return { micro: count(pairs), macroF1: supported.length ? supported.reduce((s, x) => s + x.f1, 0) / supported.length : null, perEmotion };
}
