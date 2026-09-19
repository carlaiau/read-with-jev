import {sentenceSegmentationVersion} from '../lib/reader-sentences';
import {readFile} from 'node:fs/promises';
import {noul} from '@typesafe-ai/sdk';
import type {Book} from '../lib/model';
import {readingPlans,readingEmotions,readingRequestConcurrency,validEmotionScores,readingThreshold,type ReadingSentence,type EmotionScores} from '../lib/reading-emotions';
import {digest,readJson,writeJson} from '../lib/io';
import {createClient,validateAnswers} from './jev';
import {passageInstructions} from './affect-passage-request';
export const readingModel='jev-1.13.0';
const books=new Map<string,Promise<Awaited<ReturnType<typeof load>>>>();
/** A deploy ships only the reader lexicon; a full local affect pass satisfies this too. */
async function affectLexicon(){
 for(const path of ['data/processed/reader-lexicon.json','data/processed/affect.json']){
  try{return (await readJson<{lexicon:Record<string,string[]>}>(path)).lexicon;}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 }
 throw new ReadingError('Emotion vocabulary is unavailable. Run `npm run reader:lexicon` on the server.',503);
}
async function load(layer:string){
 let path=`data/processed/${layer}.json`;
 if(layer.startsWith('document:')){
  const id=layer.slice(9),catalog=await readJson<{documents:{documentId:string}[]}>('data/library/catalog.json');
  if(!catalog.documents.some(d=>d.documentId===id))throw new ReadingError('Unknown document.',404);
  path=`data/library/${id}.json`;
 }
 const raw=await readFile(path,'utf8'),book=JSON.parse(raw) as Book;
 const associations=await affectLexicon();
 const plans=readingPlans(book),words=new Set(plans.flatMap(p=>[...p.text.matchAll(/[a-z]+(?:'[a-z]+)?/gi)].map(m=>m[0].toLowerCase())));
 const lexicon=Object.fromEntries(Object.entries(associations).filter(([word])=>words.has(word)));
 return {sourceKey:digest(JSON.stringify({raw,displayVersion:2,sentenceSegmentationVersion,icu:process.versions.icu,model:readingModel,instructions:passageInstructions,lexicon})),plans,lexicon,model:readingModel,threshold:readingThreshold};
}
export function validReadingSource(value:unknown):value is string {return typeof value==='string'&&(['mentions','speaking'].includes(value)||/^document:[a-z0-9-]{1,80}$/.test(value));}
export function readingData(layer:string){
 if(!validReadingSource(layer))throw new Error('Invalid edition');
 let promise=books.get(layer);if(!promise){promise=load(layer);books.set(layer,promise);promise.catch(()=>books.delete(layer));}return promise;
}
export function readingRequest(s:ReadingSentence){return {model:readingModel,state:{precedingContext:s.precedingContext,target:s.target,followingContext:s.followingContext},questions:Object.fromEntries(readingEmotions.map((e,i)=>[`q${i}`,noul(`Emotion: ${e}.\n${passageInstructions}`)]))};}
const active=new Map<string,Promise<EmotionScores>>();let inFlight=0;
export class ReadingError extends Error {constructor(message:string,public status:number){super(message);}}
export async function readingScores(sourceKey:string,sentence:ReadingSentence):Promise<EmotionScores>{
 const request=readingRequest(sentence),key=digest(JSON.stringify({task:'reader-sentence-emotions-v1',sourceKey,request}));
 const path=`data/cache/reader-emotions-${key}.json`;
 try{const cached=await readJson<{scores:unknown}>(path);if(!validEmotionScores(cached.scores))throw new ReadingError('Cached analysis is invalid.',503);return cached.scores;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(active.has(key))return active.get(key)!;
 if(!process.env.TYPESAFE_API_KEY)throw new ReadingError('JEV is not configured on this server. NRC underlines are still available.',503);
 if(inFlight>=readingRequestConcurrency)throw new ReadingError('JEV is busy. Retry in a moment.',429);
 const task=(async()=>{inFlight++;try{
  const response=await createClient().systemOne(request),answers=validateAnswers(response,Object.keys(request.questions));
  const scores=Object.fromEntries(readingEmotions.map((e,i)=>[e,answers[`q${i}`]])) as EmotionScores;
  await writeJson(path,{task:'reader-sentence-emotions-v1',sourceKey,key,createdAt:new Date().toISOString(),request,response,scores});return scores;
 }finally{inFlight--;}})();active.set(key,task);try{return await task;}finally{active.delete(key);}
}
