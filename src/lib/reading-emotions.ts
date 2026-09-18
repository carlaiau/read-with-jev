import {readerSentenceRanges} from './reader-sentences';
import type {Book} from './model';
import {readerSegments,readerPassageText} from './reader-text';
export const readingEmotions=['anger','anticipation','disgust','fear','joy','sadness','surprise','trust'] as const;
export type ReadingEmotion=typeof readingEmotions[number];
export type EmotionScores=Record<ReadingEmotion,number>;
export const emotionColors:Record<ReadingEmotion,string>={anger:'#a33b39',anticipation:'#8a6217',disgust:'#546c32',fear:'#775193',joy:'#946318',sadness:'#316e99',surprise:'#a14b75',trust:'#287365'};
export const readingThreshold=.75;
export const readingRequestConcurrency=6;
export const readingScrollDelayMs=50;
export type ReadingSentence={id:string;start:number;end:number;target:string;precedingContext:string;followingContext:string};
export type ReadingPlan={id:string;text:string;emphasis:{start:number;end:number}[];sentences:ReadingSentence[]};
export type EmotionMetadata={sourceKey:string;plans:ReadingPlan[];lexicon:Record<string,string[]>;jevAvailable:boolean;model:string;threshold:number};
/** All ranges are in the displayed edition, never source annotation coordinates. */
export function readingPlans(book:Book & {textFormat?:'plain'|'tokenized';sections?:{index:number;title:string}[]}):ReadingPlan[]{
 const plans=book.passages.map((p,index)=>{
  let text='';const emphasis:{start:number;end:number}[]=[];
  for(const part of readerSegments(readerPassageText(book,index),book.textFormat?book.textFormat==='tokenized':book.id==='mentions')){const start=text.length;text+=part.text;if(part.emphasis)emphasis.push({start,end:text.length});}
  const sentences=readerSentenceRanges(text).map(({start,end})=>({id:`${p.id}:${start}`,start,end,target:text.slice(start,end),precedingContext:'',followingContext:''}));
  return {id:p.id,text,emphasis,sentences};
 });
 for(let i=0;i<plans.length;i++)for(let j=0;j<plans[i].sentences.length;j++){
  const s=plans[i].sentences[j];
  s.precedingContext=plans[i].sentences[j-1]?.target??(i>0&&book.passages[i-1].chapter===book.passages[i].chapter?plans[i-1].sentences.at(-1)?.target??'':'');
  s.followingContext=plans[i].sentences[j+1]?.target??(i+1<plans.length&&book.passages[i+1].chapter===book.passages[i].chapter?plans[i+1].sentences[0]?.target??'':'');
 }
 return plans;
}
export function lexicalRanges(text:string,lexicon:Record<string,string[]>,emotion:ReadingEmotion){
 return [...text.matchAll(/[a-z]+(?:'[a-z]+)?/gi)].filter(m=>lexicon[m[0].toLowerCase()]?.includes(emotion)).map(m=>({start:m.index!,end:m.index!+m[0].length}));
}
export function validEmotionScores(value:unknown):value is EmotionScores{
 if(!value||typeof value!=='object')return false;const scores=value as Record<string,unknown>;
 return Object.keys(scores).length===8&&readingEmotions.every(e=>typeof scores[e]==='number'&&Number.isFinite(scores[e])&&scores[e]>=0&&scores[e]<=1);
}
