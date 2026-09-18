import { evaluatePairs, makePairs, emotions, type AffectData, type AffectDocument, type EvaluationPair } from './affect';
import { highlightEmotions, highlightPairs, targetWindow } from './affect-highlights';

// Max is an aggregation rule, not a calibrated passage probability.
export function passageProjection(doc: AffectDocument, scores: Record<string, number>, goldMode: 'linked' | 'all') {
  const mentions = highlightPairs(doc);
  evaluatePairs(mentions, scores); // Refuse missing, extra, or invalid scores before collapsing.
  const pairs: EvaluationPair[] = highlightEmotions.map(type => ({
    id: `${doc.doc_id}:${type}`, emotion: {type},
    gold: goldMode === 'linked' ? mentions.some(p => p.emotion.type === type && p.gold)
      : doc.spans.some(s => s.type === type),
  }));
  return {pairs, scores: Object.fromEntries(pairs.map(p => [p.id,
    Math.max(...mentions.filter(m => m.emotion.type === p.emotion.type).map(m => scores[m.id])),
  ]))};
}

// Direct passage detection does not require any character annotations.
export function passageEligibility(doc: AffectDocument): string | null {
  makePairs(doc);
  const target = targetWindow(doc);
  if (!target) return 'sentence-segmentation-not-three';
  if (doc.spans.some(s => emotions.includes(s.type) && (s.start < target.start || s.end > target.end))) return 'gold-emotion-outside-derived-target';
  return null;
}
export function passagePairs(doc: AffectDocument): EvaluationPair[] {
  if (passageEligibility(doc)) throw new Error('Ineligible passage document');
  return highlightEmotions.map(type => ({id:`${doc.doc_id}:${type}`,emotion:{type},gold:doc.spans.some(s=>s.type===type)}));
}
export function passageLexicon(doc: AffectDocument, lexicon: AffectData['lexicon']): Record<string,number> {
  const pairs=passagePairs(doc),target=targetWindow(doc)!;
  const words=[...target.text.matchAll(/[a-z]+(?:'[a-z]+)?/gi)].map(m=>m[0].toLowerCase());
  return Object.fromEntries(pairs.map(p=>[p.id,Number(words.some(w=>lexicon[w]?.includes(p.emotion.type)))]));
}
