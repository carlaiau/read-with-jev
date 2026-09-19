import {sentenceSegmentationVersion} from '../lib/reader-sentences';
import {readFile} from 'node:fs/promises';
import {noul} from '@typesafe-ai/sdk';
import type {Book} from '../lib/model';
import {readingPlans,readingEmotions,readingRequestConcurrency,validEmotionScores,readingThreshold,type ReadingSentence,type EmotionScores} from '../lib/reading-emotions';
import {digest,readJson,writeJson} from '../lib/io';
import {createClient,validateAnswers} from './jev';
import {passageInstructions} from './affect-passage-request';
import {storedScores,storeScores,acquireModelSlot,releaseModelSlot} from './emotion-store';
export const readingModel='jev-1.13.0';
const books=new Map<string,Promise<Awaited<ReturnType<typeof load>>>>();
async function load(layer:string){
 let path=`data/processed/${layer}.json`;
 if(layer.startsWith('document:')){
  const id=layer.slice(9),catalog=await readJson<{documents:{documentId:string}[]}>('data/library/catalog.json');
  if(!catalog.documents.some(d=>d.documentId===id))throw new ReadingError('Unknown document.',404);
  path=`data/library/${id}.json`;
 }
 const raw=await readFile(path,'utf8'),book=JSON.parse(raw) as Book;
 const plans=readingPlans(book);
 // displayVersion 3 drops the NRC lexicon from the served payload and from this fingerprint.
 return {sourceKey:digest(JSON.stringify({raw,displayVersion:3,sentenceSegmentationVersion,icu:process.versions.icu,model:readingModel,instructions:passageInstructions})),plans,model:readingModel,threshold:readingThreshold};
}
export function validReadingSource(value:unknown):value is string {return typeof value==='string'&&(['mentions','speaking'].includes(value)||/^document:[a-z0-9-]{1,80}$/.test(value));}
export function readingData(layer:string){
 if(!validReadingSource(layer))throw new Error('Invalid edition');
 let promise=books.get(layer);if(!promise){promise=load(layer);books.set(layer,promise);promise.catch(()=>books.delete(layer));}return promise;
}
export function readingRequest(s:ReadingSentence){return {model:readingModel,state:{precedingContext:s.precedingContext,target:s.target,followingContext:s.followingContext},questions:Object.fromEntries(readingEmotions.map((e,i)=>[`q${i}`,noul(`Emotion: ${e}.\n${passageInstructions}`)]))};}
const active=new Map<string,Promise<EmotionScores>>();let inFlight=0;
export class ReadingError extends Error {constructor(message:string,public status:number){super(message);}}
export const readingCachePath=(key:string)=>`data/cache/reader-emotions-${key}.json`;
/** The local cache is free to read and free to copy into the shared store. */
export async function diskScores(key:string):Promise<EmotionScores|undefined>{
 try{
  const cached=await readJson<{scores:unknown}>(readingCachePath(key));
  if(!validEmotionScores(cached.scores))throw new ReadingError('Cached analysis is invalid.',503);
  return cached.scores;
 }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return undefined;}
}
export function readingCacheKey(sourceKey:string,sentence:ReadingSentence){
 return digest(JSON.stringify({task:'reader-sentence-emotions-v1',sourceKey,request:readingRequest(sentence)}));
}
/**
 * Read-through: in-flight promise, local disk, then the shared store, and only then the model.
 * The shared store is what makes a second reader of the same chapter free.
 */
export async function readingScores(layer:string,sourceKey:string,sentence:ReadingSentence):Promise<EmotionScores>{
 const request=readingRequest(sentence),key=readingCacheKey(sourceKey,sentence);
 const path=readingCachePath(key);
 if(active.has(key))return active.get(key)!;
 const local=await diskScores(key);if(local)return local;
 const shared=await storedScores(key);if(shared)return shared;
 if(!process.env.TYPESAFE_API_KEY)throw new ReadingError('JEV is not configured on this server.',503);
 if(inFlight>=readingRequestConcurrency)throw new ReadingError('JEV is busy. Retry in a moment.',429);
 const task=(async()=>{inFlight++;let lease;try{
  // inFlight bounds this process; the lease bounds every instance at once. With no store to
  // ask, the per-process bound is the only one, which is the local-development case.
  lease=await acquireModelSlot();
  if(lease==='busy')throw new ReadingError('JEV is busy across this deployment. Retry in a moment.',429);
  const response=await createClient().systemOne(request),answers=validateAnswers(response,Object.keys(request.questions));
  const scores=Object.fromEntries(readingEmotions.map((e,i)=>[e,answers[`q${i}`]])) as EmotionScores;
  await storeScores({cacheKey:key,layer,sentenceId:sentence.id,sourceKey,model:readingModel,scores});
  // A read-only serverless filesystem must not fail a call the model has already answered and billed.
  try{await writeJson(path,{task:'reader-sentence-emotions-v1',sourceKey,key,createdAt:new Date().toISOString(),request,response,scores});}
  catch(error){console.warn('Reader emotion cache write failed; the score is still served.',error);}
  return scores;
 }finally{inFlight--;if(lease&&lease!=='busy')await releaseModelSlot(lease);}})();active.set(key,task);try{return await task;}finally{active.delete(key);}
}
