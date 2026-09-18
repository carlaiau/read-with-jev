import { emotions, makePairs, type AffectDocument, type AffectSpan, type EvaluationPair, type AffectData } from './affect';
export const highlightEmotions = emotions.filter(e => e !== 'other-emotion');
export type HighlightPair = EvaluationPair & { documentId: string; character: AffectSpan };
export function targetWindow(doc: AffectDocument) {
  const segments = [...new Intl.Segmenter('en', {granularity:'sentence'}).segment(doc.text)];
  if (segments.length !== 3) return null;
  const target = segments[1];
  return { start: target.index, end: target.index + target.segment.length, text: target.segment };
}
export function highlightEligibility(doc: AffectDocument): string | null {
  makePairs(doc); // Fail closed on source-offset or relation integrity problems.
  const target = targetWindow(doc);
  if (!target) return 'sentence-segmentation-not-three';
  if (!doc.spans.some(s => s.type === 'character')) return 'no-supplied-character';
  if (doc.spans.some(s => emotions.includes(s.type) && (s.start < target.start || s.end > target.end))) return 'gold-emotion-outside-derived-target';
  return null;
}
export function highlightPairs(doc: AffectDocument): HighlightPair[] {
  if (highlightEligibility(doc)) throw new Error('Ineligible highlight document');
  const spans = new Map(doc.spans.map(s => [s.annotation_id, s]));
  return doc.spans.filter(s => s.type === 'character').flatMap(character => highlightEmotions.map(type => ({
    id: `${doc.doc_id}:${character.annotation_id}:${type}`, documentId: doc.doc_id, character, emotion: {type},
    gold: doc.relations.some(r => r.type === 'experiencer' && r.target_annotation_id === character.annotation_id && spans.get(r.source_annotation_id)?.type === type),
  })));
}
export function highlightBaseline(doc: AffectDocument, pair: HighlightPair, engine: string, lexicon: AffectData['lexicon']) {
  if (engine === 'none') return 0;
  const target = targetWindow(doc)!;
  const characters = doc.spans.filter(s => s.type === 'character');
  const hits = [...target.text.matchAll(/[a-z]+(?:'[a-z]+)?/gi)].filter(m => lexicon[m[0].toLowerCase()]?.includes(pair.emotion.type));
  return Number(hits.some(hit => {
    if (engine === 'nrc-passage') return true;
    const start = target.start + hit.index!, end = start + hit[0].length;
    if (engine === 'nrc-preceding') {
      const before = characters.filter(c => c.end <= start);
      if (before.length) return pair.character.end === Math.max(...before.map(c => c.end));
    } else if (engine !== 'nrc-nearest') throw new Error('Unknown baseline');
    const gap = (c: AffectSpan) => Math.max(0, c.start - end, start - c.end);
    return gap(pair.character) === Math.min(...characters.map(gap));
  }));
}
