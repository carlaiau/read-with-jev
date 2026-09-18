import type { Passage, Span } from './model';

export function buildPassages(text: string, units: Span[], chapterStarts: number[], targetWords = 350): Passage[] {
  const result: Passage[] = [];
  for (let chapter = 0; chapter < chapterStarts.length; chapter++) {
    const begin = chapterStarts[chapter], end = chapterStarts[chapter + 1] ?? text.length;
    const parts = units.filter(([s]) => s >= begin && s < end);
    let start = begin, words = 0;
    for (let index = 0; index < parts.length; index++) {
      const [s, e] = parts[index];
      words += text.slice(s, e).split(/\s+/).filter(Boolean).length;
      if (words < targetWords && index < parts.length - 1) continue;
      const finish = index === parts.length - 1 ? end : e;
      const previous = [...text.slice(begin, start).matchAll(/\S+/g)].slice(-300);
      const following = [...text.slice(finish, end).matchAll(/\S+/g)].slice(0, 300);
      result.push({ id: `p${result.length}`, chapter: chapter + 1, start, end: finish,
        contextStart: previous.length ? begin + previous[0].index! : start,
        contextEnd: following.length ? finish + following.at(-1)!.index! + following.at(-1)![0].length : finish,
        split: (chapter + 1) % 5 === 0 ? 'test' : 'dev', labels: [] });
      start = finish; words = 0;
    }
  }
  return result;
}

export function attachLabels(passages: Passage[], evidence: { characterId: string; span: Span }[]) {
  for (const p of passages) {
    p.labels = [...new Set(evidence.filter(e => e.span[0] < p.end && e.span[1] > p.start).map(e => e.characterId))].sort();
  }
}
