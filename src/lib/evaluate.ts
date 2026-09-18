import type { Book, Character, Passage, Prediction } from './model';

const normalize = (text: string) => text.toLocaleLowerCase('en').replace(/\./g, '').replace(/\s+/g, ' ').trim();
export function literalMatches(text: string, cast: Character[]): Set<string> {
  const normalized = normalize(text);
  const entries = cast.flatMap(c => [...new Set(c.aliases.map(normalize))].map(alias => ({ id: c.id, alias })));
  const owners = new Map<string, Set<string>>();
  for (const e of entries) owners.set(e.alias, new Set([...(owners.get(e.alias) ?? []), e.id]));
  const matches: { start: number; end: number; id: string }[] = [];
  for (const { alias, id } of entries) {
    if (!alias || owners.get(alias)!.size !== 1) continue;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
    for (const m of normalized.matchAll(regex)) matches.push({ start: m.index!, end: m.index! + m[0].length, id });
  }
  // Prefer the full name to an overlapping surname assigned to a different character.
  matches.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const kept: typeof matches = [];
  for (const m of matches) if (!kept.some(k => k.start < m.end && k.end > m.start)) kept.push(m);
  return new Set(kept.map(m => m.id));
}

export function baseline(book: Book, passages: Passage[]): Prediction[] {
  return passages.flatMap(p => {
    const matches = literalMatches(book.text.slice(p.start, p.end), book.characters);
    return book.characters.map(c => ({ passageId: p.id, characterId: c.id, probability: Number(matches.has(c.id)) }));
  });
}

function rates(tp: number, fp: number, fn: number) {
  const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
  return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
}

export function evaluate(book: Book, passages: Passage[], predictions: Prediction[], threshold = 0.5) {
  if (!passages.length) throw new Error('Cannot evaluate an empty sample');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Invalid threshold');
  const indexed = new Map<string, number>();
  for (const p of predictions) {
    const key = `${p.passageId}/${p.characterId}`;
    if (indexed.has(key) || !Number.isFinite(p.probability) || p.probability < 0 || p.probability > 1) throw new Error('Duplicate or invalid prediction');
    indexed.set(key, p.probability);
  }
  if (indexed.size !== passages.length * book.characters.length) throw new Error('Prediction matrix is incomplete or contains extra pairs');
  let tp = 0, fp = 0, fn = 0, squaredError = 0;
  const perCharacter = book.characters.map(c => {
    let ctp = 0, cfp = 0, cfn = 0, support = 0;
    for (const p of passages) {
      const score = indexed.get(`${p.id}/${c.id}`);
      if (score === undefined) throw new Error('Missing expected prediction');
      const gold = p.labels.includes(c.id), predicted = score >= threshold;
      support += Number(gold); ctp += Number(gold && predicted); cfp += Number(!gold && predicted); cfn += Number(gold && !predicted);
      squaredError += (score - Number(gold)) ** 2;
    }
    tp += ctp; fp += cfp; fn += cfn;
    return { id: c.id, name: c.name, support, tp: ctp, fp: cfp, fn: cfn, ...rates(ctp, cfp, cfn) };
  });
  const supported = perCharacter.filter(c => c.support > 0);
  return { passages: passages.length, pairs: indexed.size, threshold, micro: { tp, fp, fn, ...rates(tp, fp, fn) },
    macroF1: supported.length ? supported.reduce((n, c) => n + c.f1, 0) / supported.length : null,
    supportedCharacters: supported.length, brier: squaredError / indexed.size, perCharacter };
}
