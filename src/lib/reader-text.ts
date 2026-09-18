import type {Book} from './model';
/** Display-only detokenization. Never use this text for source offsets or inference. */
export function readerText(source: string, tokenized: boolean): string {
  const text = source.replace(/\b(?:CHAPTER|Chapter)\s+[IVXLCDM]+\b\s*\.?/, '').trim();
  if (!tokenized) return text;
  return text
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/([“‘(])[ \t]+/g, '$1')
    .replace(/[ \t]+([”’)])/g, '$1')
    .replace(/(\p{L})[ \t]*[’'][ \t]+(s|t|re|ve|ll|d|m)\b/gu, '$1’$2')
    .replace(/(\p{L})[ \t]*-[ \t]*(?=\p{L})/gu, '$1-');
}

/** Gutenberg's paired underscores denote emphasis, not printable characters. */
export function readerSegments(source: string, tokenized: boolean): { text: string; emphasis: boolean }[] {
  const text = readerText(source, tokenized);
  const segments: { text: string; emphasis: boolean }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/_([^_]+)_/g)) {
    segments.push({ text: text.slice(cursor, match.index), emphasis: false });
    segments.push({ text: match[1].trim(), emphasis: true });
    cursor = match.index + match[0].length;
  }
  segments.push({ text: text.slice(cursor), emphasis: false });
  return segments;
}

/** Remove a separately rendered library heading without changing source coordinates. */
export function readerPassageText(book:Book & {sections?:{index:number;title:string}[]},index:number):string {
 const p=book.passages[index];let text=book.text.slice(p.start,p.end);
 if(book.sections&&(index===0||book.passages[index-1].chapter!==p.chapter)){
  const title=book.sections.find(s=>s.index===p.chapter)?.title??`Chapter ${p.chapter}`;
  const heading=text.match(/^\s*([^\n]+)(?:\n|$)/);
  if(heading?.[1].trim()===title)text=text.slice(heading[0].length);
 }
 return text;
}
