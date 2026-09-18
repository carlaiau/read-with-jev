import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Book, Span } from '../src/lib/model';
import { digest, readJson, writeJson } from '../src/lib/io';
import { attachLabels, buildPassages } from '../src/lib/passages';
type Row = { doc_key: string; sentences?: string[][]; characters: { name: string; mentions: Span[] }[] };
const manifest = await readJson<{ sources: { path: string; sha256: string }[] }>('data/raw/manifest.json');
for (const file of manifest.sources) assert.equal(digest(await readFile(file.path)), file.sha256);
const rows = async (name: string): Promise<Row[]> => (await readFile(`data/raw/bookcoref/${name}`, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
const [gold, first, second] = await Promise.all([rows('test.jsonl'), rows('maverick_xl.jsonl'), rows('booknlp.jsonl')]);
// Fixed registry aliases, not extracted from gold mention spans. Shared by both methods.
const aliases: Record<string, string[]> = {
  Gotama: ['Buddha'], 'The Samanas': ['Samanas'],
  'Old Major': ['Major', 'Willingdon Beauty'], 'The Dogs': ['dogs'], 'The Hens': ['hens'],
  'The Sheep': ['sheep'], 'The Cat': ['cat'], 'Mr. Pilkington': ['Pilkington'],
  'Mr. Frederick': ['Frederick'], 'Mr. Whymper': ['Whymper'],
};
const headings = ['THE SON OF THE BRAHMAN', 'WITH THE SAMANAS', 'GOTAMA', 'AWAKENING', 'KAMALA', 'WITH THE CHILDLIKE PEOPLE', 'SANSARA', 'BY THE RIVER', 'THE FERRYMAN', 'THE SON', 'OM', 'GOVINDA'];
for (const spec of [{ slug: 'siddhartha', key: 'siddhartha_2500', title: 'Siddhartha', author: 'Hermann Hesse', chapters: 12 }, { slug: 'animal-farm', key: 'animal_farm_0', title: 'Animal Farm', author: 'George Orwell', chapters: 10 }]) {
  const g = gold.find(r => r.doc_key === spec.key)!;
  const a = first.find(r => r.doc_key === spec.key)!, b = second.find(r => r.doc_key === spec.key)!;
  assert(g && a?.sentences && b?.sentences, `Missing source for ${spec.key}`);
  assert.deepEqual(a.sentences, b.sentences, 'Released text disagreement');
  if (g.sentences) assert.deepEqual(g.sentences, a.sentences, 'Gold text disagrees');
  let text = ''; const tokenSpans: Span[] = [], units: Span[] = [];
  for (const sentence of a.sentences) { const begin = text.length;
    for (const token of sentence) { if (text.length > begin) text += ' '; const start = text.length; text += token; tokenSpans.push([start, text.length]); }
    units.push([begin, text.length]); text += '\n';
  }
  const starts = spec.slug === 'animal-farm'
    ? [...text.matchAll(/\bChapter\s+[IVXLCDM]+\b/g)].map(m => m.index!)
    : headings.map(heading => { const matches = [...text.matchAll(new RegExp(`(?:^|\\n) *${heading} *\\n`, 'g'))]; assert.equal(matches.length, 1, `Heading ${heading}`); return matches[0].index!; });
  assert.equal(starts.length, spec.chapters); starts[0] = 0; // Preserve opening dedication without shifting gold offsets.
  assert(starts.every((n, i) => !i || n > starts[i - 1]));
  const splitUnits: Span[] = units.flatMap(([s, e]) => { const points = [s, ...starts.filter(x => x > s && x < e), e]; return points.slice(0, -1).map((p, i) => [p, points[i + 1]] as Span); });
  const characters = g.characters.map((c, i) => ({ id: `bc-${i}`, name: c.name, aliases: [...new Set([c.name, ...(aliases[c.name] ?? [])])] }));
  const evidence = g.characters.flatMap((c, i) => c.mentions.map(([s, e]) => { assert(Number.isInteger(s) && Number.isInteger(e) && s >= 0 && e >= s && e < tokenSpans.length); return { characterId: characters[i].id, span: [tokenSpans[s][0], tokenSpans[e][1]] as Span }; }));
  const passages = buildPassages(text, splitUnits, starts); attachLabels(passages, evidence);
  assert.equal(passages[0].start, 0); assert.equal(passages.at(-1)!.end, text.length);
  passages.slice(1).forEach((p, i) => assert.equal(p.start, passages[i].end));
  const book: Book = { schema: 1, id: 'mentions', title: spec.title, layer: 'Mentioned · BookCoref gold', source: 'https://huggingface.co/datasets/sapienzanlp/bookcoref', text, characters, passages, evidence,
    provenance: { manifest, author: spec.author, document: spec.key, tokenCount: tokenSpans.length, chapterStarts: starts, gold: 'Official gold character mentions; inclusive token endpoints converted to half-open UTF-16.', text: 'Matching released sentence arrays; prediction labels discarded. Embedded gold sentences also checked when available.', aliases: 'Fixed names and explicit registry aliases in scripts/prepare-books.ts, not mined from mention spans.', evaluation: 'Entire novel used for transfer evaluation with the frozen Pride and Prejudice prompt. Per-chapter dev/test fields are retained for compatibility, not tuning on these books.' } };
  await writeJson(`data/processed/${spec.slug}.json`, book);
  console.log(JSON.stringify({ book: spec.title, passages: passages.length, characters: characters.length, evidence: evidence.length, chapters: starts.length }));
}
