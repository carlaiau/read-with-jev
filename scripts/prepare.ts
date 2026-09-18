import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import type { Book, Character, Span } from '../src/lib/model';
import { digest, readJson, writeJson } from '../src/lib/io';
import { parseLiteral } from '../src/lib/literals';
import { attachLabels, buildPassages } from '../src/lib/passages';

type Gold = { doc_key: string; characters: { name: string; mentions: Span[] }[] };
type TokenSource = { doc_key: string; sentences: string[][] };
const manifest = await readJson<{ sources: { path: string; sha256: string }[] }>('data/raw/manifest.json');
for (const file of manifest.sources) assert.equal(digest(await readFile(file.path)), file.sha256, `Source changed: ${file.path}`);
async function novel<T extends { doc_key: string }>(path: string): Promise<T> {
  const result = (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as T).find(d => d.doc_key === 'pride_and_prejudice_1342');
  assert(result, `Missing Pride and Prejudice in ${path}`); return result;
}
const rows = parse(await readFile('data/raw/pdnc/character_info.csv'), { columns: true }) as Record<string, string>[];
const pdncCast: Character[] = rows.map(row => {
  const aliases = parseLiteral(row.Aliases);
  assert(Array.isArray(aliases) && aliases.every(x => typeof x === 'string'));
  return { id: `pdnc-${row['Character ID']}`, name: row['Main Name'], aliases: [...new Set([row['Main Name'], ...aliases])] };
});
// Explicit identity mapping only, never learned from held-out mention spans.
const equivalent: Record<string, string> = {
  'Mr Bennet': 'Mr. Bennet', 'Mrs Bennet': 'Mrs. Bennet', 'Mr William Collins': 'Mr. Collins',
  'Mr Gardiner': 'Mr. Gardiner', 'Charles Bingley': 'Mr. Bingley', 'Caroline Bingley': 'Miss Bingley',
  'Mr Philips': 'Mr. Philips', 'Jane Bennet': 'Jane', 'Georgiana Darcy': 'Miss Darcy',
  'Elizabeth Bennet': 'Elizabeth', 'Mrs Gardiner': 'Mrs. Gardiner',
  'Lady Catherine de Bourgh': 'Lady Catherine De Bourgh', 'Miss de Bourgh': 'Anne De Bourgh',
  'Maria Lucas': 'Maria', 'Lydia Bennet': 'Lydia', 'Catherine Bennet': 'Kitty',
  'Mary King': 'Miss King', 'Mrs Philips': 'Mrs. Philips', 'Mary Bennet': 'Mary', 'Mr. Denny': 'Mr. Denney',
};
const gold = await novel<Gold>('data/raw/bookcoref/test.jsonl');
const source = await novel<TokenSource>('data/raw/bookcoref/maverick_xl.jsonl');
const crosscheck = await novel<TokenSource>('data/raw/bookcoref/booknlp.jsonl');
assert.deepEqual(source.sentences, crosscheck.sentences, 'Released input tokens disagree');
let text = '';
const tokenSpans: Span[] = [], sentenceSpans: Span[] = [];
for (const sentence of source.sentences) {
  const begin = text.length;
  for (const token of sentence) {
    if (text.length > begin) text += ' ';
    const start = text.length; text += token; tokenSpans.push([start, text.length]);
  }
  sentenceSpans.push([begin, text.length]); text += '\n';
}
const cast: Character[] = gold.characters.map((c, index) => {
  const match = pdncCast.find(p => p.name === (equivalent[c.name] ?? c.name));
  // Two obvious source-registry ambiguities are excluded from classifier aliases.
  const aliases = (match?.aliases ?? []).filter(a => a !== 'Bennet' && !(c.name === 'Charlotte Lucas' && a === 'Lady Lucas'));
  return { id: `bc-${index}`, name: c.name, aliases: [...new Set([c.name, ...aliases])] };
});
const mentionEvidence: Book['evidence'] = gold.characters.flatMap((c, index) => c.mentions.map(([start, end]) => {
  assert(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start && end < tokenSpans.length, 'Gold span out of bounds');
  return { characterId: cast[index].id, span: [tokenSpans[start][0], tokenSpans[end][1]] as Span };
}));

function segment(text: string, units: Span[]) {
  const starts = [...text.matchAll(/\b(?:CHAPTER|Chapter)\s+[IVXLCDM]+\b/g)].map(m => m.index!);
  assert.equal(starts.length, 61, 'Expected 61 chapter boundaries');
  assert.equal(starts[0], 0);
  const splitUnits: Span[] = units.flatMap(([s, e]) => {
    const points = [s, ...starts.filter(x => x > s && x < e), e];
    return points.slice(0, -1).map((p, i) => [p, points[i + 1]] as Span);
  });
  const passages = buildPassages(text, splitUnits, starts);
  assert.equal(passages[0].start, 0);
  assert.equal(passages.at(-1)!.end, text.length);
  passages.slice(1).forEach((p, i) => assert.equal(p.start, passages[i].end));
  return passages;
}
const mentions: Book = { schema: 1, id: 'mentions', title: 'Pride and Prejudice', layer: 'Mentioned · BookCoref gold',
  source: 'https://huggingface.co/datasets/sapienzanlp/bookcoref', text, characters: cast,
  passages: segment(text, sentenceSpans), evidence: mentionEvidence,
  provenance: { manifest, gold: 'Official human-annotated test.jsonl character mentions; inclusive token endpoints converted to half-open UTF-16.',
    text: 'Identical sentences in two authors’ released evaluation artifacts. Predicted clusters/characters discarded.', tokenCount: tokenSpans.length,
    aliases: 'PDNC registry with explicit identity mapping; ambiguous Bennet and Charlotte/Lady Lucas alias excluded.',
    split: 'Project development split: every fifth chapter held out. Original BookCoref test novel repurposed; not an untouched benchmark test.' } };
attachLabels(mentions.passages, mentions.evidence);

const pdncText = await readFile('data/raw/pdnc/novel_text.txt', 'utf8');
const quotes = parse(await readFile('data/raw/pdnc/quotation_info.csv'), { columns: true }) as Record<string, string>[];
const quoteEvidence: Book['evidence'] = [];
// PDNC calls these byte spans. Verify the actual offset convention against EVERY subquotation.
const cpToUtf16 = [0]; for (const c of pdncText) cpToUtf16.push(cpToUtf16.at(-1)! + c.length);
const byteToUtf16 = new Map<number, number>([[0, 0]]); let byte = 0, utf16 = 0;
for (const c of pdncText) { byte += Buffer.byteLength(c); utf16 += c.length; byteToUtf16.set(byte, utf16); }
const conversions: Record<string, (n: number) => number | undefined> = {
  'utf16': n => n, 'codepoint': n => cpToUtf16[n], 'utf8': n => byteToUtf16.get(n),
};
const parsed = quotes.map(q => {
  const spans = parseLiteral(q.quoteByteSpans) as Span[], parts = parseLiteral(q.subQuotationList) as string[];
  assert.equal(spans.length, parts.length); return { q, spans, parts };
});
const valid = Object.entries(conversions).filter(([, convert]) => parsed.every(({ spans, parts }) => spans.every(([s, e], i) => {
  const start = convert(s), end = convert(e);
  return start !== undefined && end !== undefined && pdncText.slice(start, end).trim() === parts[i].trim();
})));
assert(valid.length, 'No offset convention matches every PDNC subquotation after trimming edge whitespace');
const [offsetConvention, convert] = valid[0];
const whitespaceAdjustments: { quoteId: string; original: Span; adjusted: Span }[] = [];
for (const { q, spans } of parsed) {
  const speaker = pdncCast.find(c => c.name === q.speaker);
  assert(speaker, `Unresolved speaker: ${q.speaker}`);
  for (const [s, e] of spans) {
    const original: Span = [convert(s)!, convert(e)!];
    const fragment = pdncText.slice(...original);
    const adjusted: Span = [original[0] + fragment.length - fragment.trimStart().length, original[1] - fragment.length + fragment.trimEnd().length];
    if (original[0] !== adjusted[0] || original[1] !== adjusted[1]) whitespaceAdjustments.push({ quoteId: q.quoteID, original, adjusted });
    quoteEvidence.push({ characterId: speaker.id, span: adjusted });
  }
}
const paragraphs: Span[] = [...pdncText.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g)].map(m => [m.index!, m.index! + m[0].length]);
const speaking: Book = { schema: 1, id: 'speaking', title: 'Pride and Prejudice', layer: 'Speaking · PDNC gold',
  source: 'https://github.com/Priya22/project-dialogism-novel-corpus', text: pdncText, characters: pdncCast,
  passages: segment(pdncText, paragraphs), evidence: quoteEvidence,
  provenance: { manifest, offsetConvention, equivalentOffsetConventions: valid.map(([name]) => name), quotations: quotes.length,
    verifiedSubquotations: quoteEvidence.length, whitespaceAdjustments, scope: 'Annotated quotation speaker; not exhaustive physical presence.',
    alignment: 'PDNC native edition. No cross-edition offset alignment with BookCoref is claimed.' } };
attachLabels(speaking.passages, speaking.evidence);
await writeJson('data/processed/mentions.json', mentions);
await writeJson('data/processed/speaking.json', speaking);
await writeJson('data/processed/summary.json', [mentions, speaking].map(b => ({ id: b.id, characters: b.characters.length, passages: b.passages.length,
  evidenceSpans: b.evidence.length, devPassages: b.passages.filter(p => p.split === 'dev').length, testPassages: b.passages.filter(p => p.split === 'test').length })));
console.log(await readFile('data/processed/summary.json', 'utf8'));
