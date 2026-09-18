/** Increment when boundary rules change: reader caches must not reuse old fragments. */
export const sentenceSegmentationVersion='paragraph-aware-en-v1';
export type SentenceRange={start:number;end:number};

/**
 * Segment an offset-preserving shadow of the display text. Gutenberg's single
 * newlines are typesetting wraps; blank lines still delimit paragraphs/dialogue.
 * Mask common name prefixes and initials for boundary detection only. Returned
 * offsets always slice the untouched display text, including its whitespace.
 */
export function readerSentenceRanges(text:string):SentenceRange[]{
 const ranges:SentenceRange[]=[];
 const paragraphEnds=[...text.matchAll(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/g)].map(m=>m.index!+m[0].length);
 if(paragraphEnds.at(-1)!==text.length)paragraphEnds.push(text.length);
 const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
 let paragraphStart=0;
 for(const paragraphEnd of paragraphEnds){
  const original=text.slice(paragraphStart,paragraphEnd);
  const shadow=original.replace(/[\r\n\u2028]/g,' ')
   .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Hon|St|Capt|Col|Gen|Lt|Sgt|Maj|Messrs|Mmes|Mme|Mlle)\.(?=\s+["“‘']?\p{L})/giu,m=>m.slice(0,-1)+'x')
   .replace(/\b[A-Z]\.(?=\s+(?:[A-Z]\.|[A-Z][a-z]))/g,m=>m[0]+'x');
  for(const part of segmenter.segment(shadow)){
   const start=paragraphStart+part.index,end=start+part.segment.length;
   // Attach whitespace-only tails rather than submitting empty model targets.
   if(!text.slice(start,end).trim()&&ranges.length)ranges[ranges.length-1].end=end;
   else if(end>start)ranges.push({start,end});
  }
  paragraphStart=paragraphEnd;
 }
 return ranges;
}
