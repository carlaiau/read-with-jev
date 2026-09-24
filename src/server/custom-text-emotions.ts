import {digest} from '../lib/io';
import {customTextLimit} from '../lib/custom-text';
import {readingEmotions,readingRequestConcurrency,type EmotionScores,type ReadingSentence} from '../lib/reading-emotions';
import {sentenceSegmentationVersion} from '../lib/reader-sentences';
import {createClient,validateAnswers} from './jev';
import {readingModel,readingRequest,ReadingError} from './reading-emotions';
import {acquireModelSlot,releaseModelSlot} from './emotion-store';
import {reserveGuestCall,storedCustomScore,storeCustomScore} from './custom-text-store';

export type CustomSentenceRequest=Pick<ReadingSentence,'target'|'precedingContext'|'followingContext'>;
export function validCustomSentenceRequest(value:unknown):value is CustomSentenceRequest{
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 return ['target','precedingContext','followingContext'].every(k=>typeof v[k]==='string')&&
  (v.target as string).trim().length>0&&(v.target as string).length<=customTextLimit&&
  (v.precedingContext as string).length<=customTextLimit&&(v.followingContext as string).length<=customTextLimit&&
  (v.target as string).length+(v.precedingContext as string).length+(v.followingContext as string).length<=customTextLimit;
}
export function customEmotionKey(sentence:CustomSentenceRequest):string{
 const request=readingRequest({id:'custom',start:0,end:sentence.target.length,...sentence});
 return digest(JSON.stringify({task:'custom-sentence-emotions-v1',segmentation:sentenceSegmentationVersion,icu:process.versions.icu,model:readingModel,request}));
}
const active=new Map<string,Promise<{scores:EmotionScores;remaining?:number}>>();let inFlight=0;
export async function customEmotionScores(scope:string,sentence:CustomSentenceRequest,guestId?:string):Promise<{scores:EmotionScores;remaining?:number}>{
 const key=customEmotionKey(sentence),activeKey=`${scope}:${key}`;
 if(active.has(activeKey))return active.get(activeKey)!;
 const task=(async()=>{
  const cached=await storedCustomScore(scope,key);if(cached)return {scores:cached};
  if(!process.env.TYPESAFE_API_KEY)throw new ReadingError('JEV is not configured on this server.',503);
  const processLimit=Number(process.env.JEV_SERVER_CONCURRENCY);
  if(inFlight>=(Number.isInteger(processLimit)&&processLimit>0?processLimit:readingRequestConcurrency))throw new ReadingError('JEV is busy. Retry in a moment.',429);
  let lease;inFlight++;
  try{
   lease=await acquireModelSlot();if(lease==='busy')throw new ReadingError('JEV is busy. Retry in a moment.',429);
   const used=guestId?await reserveGuestCall(guestId):undefined;
   if(used===null)throw new ReadingError('Your guest analysis allowance is used. Sign in to continue.',403);
   const request=readingRequest({id:'custom',start:0,end:sentence.target.length,...sentence});
   const response=await createClient().systemOne(request),answers=validateAnswers(response,Object.keys(request.questions));
   const scores=Object.fromEntries(readingEmotions.map((e,i)=>[e,answers[`q${i}`]])) as EmotionScores;
   await storeCustomScore(scope,key,scores);
   return {scores,...(used?{remaining:1_000-used}:{})};
  }finally{inFlight--;if(lease&&lease!=='busy')await releaseModelSlot(lease);}
 })();
 active.set(activeKey,task);try{return await task;}finally{active.delete(activeKey);}
}
