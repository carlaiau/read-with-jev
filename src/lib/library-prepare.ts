import assert from 'node:assert/strict';
import { literalMatches } from './evaluate';
import { digest } from './io';
import { buildPassages } from './passages';
import type { Span } from './model';
import type { DocumentSpec, LibraryDocument } from './library-model';
const siddharthaHeadings = ['THE SON OF THE BRAHMAN', 'WITH THE SAMANAS', 'GOTAMA', 'AWAKENING', 'KAMALA', 'WITH THE CHILDLIKE PEOPLE', 'SANSARA', 'BY THE RIVER', 'THE FERRYMAN', 'THE SON', 'OM', 'GOVINDA'];
export function prepareLibraryDocument(spec: DocumentSpec, raw: string, sha256: string): LibraryDocument {
  let text = raw.replace(/\r\n?/g, '\n'), textFormat: LibraryDocument['textFormat'] = 'plain';
  if (spec.format === 'bookcoref-text') {
    const source = raw.trim().split('\n').map(line => JSON.parse(line)).find(r => r.doc_key === 'animal_farm_0');
    assert(source?.sentences, 'Missing released Animal Farm text');
    text = source.sentences.map((s: string[]) => s.join(' ')).join('\n') + '\n'; textFormat = 'tokenized';
  } else {
    const start = text.match(/^\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*\*\*\*[^\n]*\n/m);
    const end = text.match(/^\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*\*\*\*/m);
    assert(start && end && end.index! > start.index!, 'Gutenberg body markers missing');
    text = text.slice(start.index! + start[0].length, end.index);
    const anchors: Record<string, RegExp> = {
      'pride-and-prejudice': /^It is a truth universally acknowledged/m,
      'siddhartha': /^THE SON OF THE BRAHMAN\s*$/gm,
      'moby-dick': /^[ \t]*ETYMOLOGY\.[ \t]*$/gm,
      'frankenstein': /^Letter 1\s*$/gm,
      'alice-in-wonderland': /^CHAPTER I\.\s*$/gm,
      'crime-and-punishment': /^PART I\s*$/gm,
      'sherlock-holmes': /^I\. A SCANDAL IN BOHEMIA\s*$/gm,
      'romeo-and-juliet': /^THE PROLOGUE\.?[ \t]*$/gm,
    };
    const expression = anchors[spec.id]; assert(expression, 'Document needs a verified body anchor');
    const matches = [...text.matchAll(new RegExp(expression.source, 'gm'))]; assert(matches.length, `No body anchor for ${spec.id}`);
    text = text.slice(matches.at(-1)!.index).trim();
    if (spec.id === 'pride-and-prejudice') text = 'CHAPTER I.\n\n' + text;
    text = text.replace(/\[Illustration[\s\S]*?\]/gi, '').replace(/\n{4,}/g, '\n\n\n');
  }
  const headingPatterns: Record<string, RegExp> = {
    'pride-and-prejudice': /^(?:CHAPTER|Chapter)\s+[IVXLCDM]+\.?[^\n]*$/gm,
    'siddhartha': new RegExp(`^(?:${siddharthaHeadings.join('|')})$`, 'gm'),
    'animal-farm': /\bChapter [IVXLCDM]+ \./g,
    'moby-dick': /^(?:CHAPTER \d+\.[^\n]*|ETYMOLOGY\.|EXTRACTS[^\n]*|Epilogue)\s*$/gm,
    'frankenstein': /^(?:Letter|Chapter) \d+\s*$/gm,
    'alice-in-wonderland': /^CHAPTER [IVXLCDM]+\.\s*$/gm,
    'crime-and-punishment': /^(?:PART [IVXLCDM]+|CHAPTER [IVXLCDM]+|EPILOGUE|[IVX]+)\s*$/gm,
    'sherlock-holmes': /^[IVXLCDM]+\. [A-Z][A-Z’'\- ]+\s*$/gm,
    'romeo-and-juliet': /^(?:THE PROLOGUE\.?|ACT [IVX]+|SCENE [IVX]+\.[^\n]*|Scene [IVX]+\.[^\n]*)\s*$/gm,
  };
  const headings = [...text.matchAll(headingPatterns[spec.id])].map(m => ({ start: m.index!, title: m[0].trim().replace(/\s+/g, ' ') }));
  assert(headings.length && headings[0].start === 0, `Body must begin at a section: ${spec.id}`);
  const expected: Record<string, number> = { 'pride-and-prejudice': 61, siddhartha: 12, 'animal-farm': 10, frankenstein: 28, 'alice-in-wonderland': 12, 'sherlock-holmes': 12 };
  if (expected[spec.id]) assert.equal(headings.length, expected[spec.id], `Unexpected section count: ${spec.id}`);
  const sections = headings.map((h, i) => ({ index: i + 1, ...h, end: headings[i + 1]?.start ?? text.length }));
  const paragraphs: Span[] = [...text.matchAll(textFormat === 'tokenized' ? /[^\n]+/g : /\S[\s\S]*?(?=\n\s*\n|$)/g)].map(m => [m.index!, m.index! + m[0].length]);
  const starts = headings.map(h => h.start);
  const units: Span[] = paragraphs.flatMap(([s, e]) => { const pts = [s, ...starts.filter(x => x > s && x < e), e]; return pts.slice(0, -1).map((p, i) => [p, pts[i + 1]] as Span); });
  const passages = buildPassages(text, units, starts);
  for (const p of passages) p.labels = [...literalMatches(text.slice(p.start, p.end), spec.characters)].sort();
  assert.equal(passages[0].start, 0); assert.equal(passages.at(-1)!.end, text.length);
  passages.slice(1).forEach((p, i) => assert.equal(p.start, passages[i].end));
  return { schema: 1, id: 'mentions', documentId: spec.id, title: spec.title, author: spec.author, year: spec.year, textFormat, layer: 'Baseline · name matches', source: spec.sourcePage,
    text, characters: spec.characters, passages, sections, evidence: [],
    classification: { kind: 'baseline', method: 'literal-name-matching', version: 1, registryHash: digest(JSON.stringify(spec.characters)), coverage: spec.registryNote },
    provenance: { sourceUrl: spec.sourceUrl, sourceSha256: sha256, textSha256: digest(text), offsets: 'Half-open UTF-16 in this normalized edition', transformation: 'Normalize newlines, strip Gutenberg wrapper and front matter using verified body anchors; remove illustration captions. Animal Farm uses released tokens only.', annotationStatus: 'No gold labels used. Passage labels are deterministic name/alias matches, not physical presence or resolved pronouns.', rights: spec.format === 'bookcoref-text' ? 'BookCoref release: CC BY-NC-SA 4.0; research use. Underlying text rights depend on jurisdiction.' : 'Project Gutenberg edition; retain source attribution and consult its terms.' } };
}
