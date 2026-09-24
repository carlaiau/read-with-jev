import {readerSentenceRanges} from './reader-sentences';

export const customTextLimit=20_000;
export const guestCallLimit=1_000;

/** Only saved-text paths may survive an account redirect. */
export function savedTextReturnPath(value:unknown):string|null{
 return typeof value==='string'&&/^\/your-text\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:null;
}

export type CustomSentence={start:number;end:number;target:string;precedingContext:string;followingContext:string;key:string};
export type CustomTextSummary={id:string;title:string;revision:number;createdAt:string;updatedAt:string};
export type CustomTextDocument=CustomTextSummary&{body:string};

/** The key is browser-local; the server stores only its cryptographic request digest. */
export function customSentenceKey(target:string,precedingContext:string,followingContext:string):string{
 return JSON.stringify([target,precedingContext,followingContext]);
}

export function customSentences(text:string):CustomSentence[]{
 const ranges=readerSentenceRanges(text).filter(({start,end})=>text.slice(start,end).trim());
 return ranges.map(({start,end},index)=>{
  const target=text.slice(start,end);
  const precedingContext=ranges[index-1]?text.slice(ranges[index-1].start,ranges[index-1].end):'';
  const followingContext=ranges[index+1]?text.slice(ranges[index+1].start,ranges[index+1].end):'';
  return {start,end,target,precedingContext,followingContext,key:customSentenceKey(target,precedingContext,followingContext)};
 });
}
