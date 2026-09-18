import { evaluatePairs, type AffectDocument, type EvaluationPair } from './affect';
import { highlightEmotions, highlightPairs } from './affect-highlights';

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
