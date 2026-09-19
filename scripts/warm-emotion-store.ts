// Fills the shared cache for one document so public readers hit it instead of the model.
// Dry run by default; --execute --max-requests N is required before any model call, matching
// the benchmark runner. Warming is prediction caching, never annotation.
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {mapConcurrent} from '../src/lib/concurrency';
import {readingData,readingScores,readingCacheKey,readingModel,diskScores} from '../src/server/reading-emotions';
import {emotionStore,storeScores,emotionStoreEnabled} from '../src/server/emotion-store';

const {values}=parseArgs({options:{document:{type:'string',default:'pride-and-prejudice'},
 concurrency:{type:'string',default:'4'},limit:{type:'string'},
 execute:{type:'boolean',default:false},'max-requests':{type:'string'}}});
assert(emotionStoreEnabled(),'Set DATABASE_URL to a Neon connection string first');
const concurrency=Number(values.concurrency);
assert(Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=8,'Concurrency must be 1-8');
const layer=`document:${values.document}`;
const data=await readingData(layer);
const all=data.plans.flatMap(p=>p.sentences);
const sentences=values.limit?all.slice(0,Number(values.limit)):all;
assert(sentences.length>0,'No sentences to warm');

const sql=emotionStore()!;
const keys=sentences.map(s=>readingCacheKey(data.sourceKey,s));
// Batched lookups instead of one round trip per sentence, chunked to keep request bodies small.
const present=new Set<string>();
for(let i=0;i<keys.length;i+=2000){
 const chunk=keys.slice(i,i+2000);
 const rows=await sql`SELECT cache_key FROM reader_emotion_scores WHERE cache_key = ANY(${chunk}::text[])` as {cache_key:string}[];
 for(const row of rows)present.add(row.cache_key);
}
const missing=sentences.map((sentence,i)=>({sentence,key:keys[i]})).filter(({key})=>!present.has(key));

// Copying the local disk cache into the store costs nothing, so it is never capped and never
// needs --execute. Only sentences that no cache can answer reach the model.
const row=(sentence:typeof sentences[number],key:string,scores:Awaited<ReturnType<typeof readingScores>>)=>
 ({cacheKey:key,layer,sentenceId:sentence.id,sourceKey:data.sourceKey,model:readingModel,scores});
let seeded=0;
const stillMissing:typeof missing=[];
await mapConcurrent(missing,concurrency,async ({sentence,key})=>{
 const scores=await diskScores(key);
 if(!scores){stillMissing.push({sentence,key});return;}
 if(await storeScores(row(sentence,key,scores)))seeded++;
});

const plan={document:values.document,model:readingModel,sourceKey:data.sourceKey,
 sentences:sentences.length,alreadyInStore:sentences.length-missing.length,
 seededFromDisk:seeded,needsModel:stillMissing.length};

if(!values.execute){
 console.log(JSON.stringify({...plan,status:'dry-run',
  next:stillMissing.length?`Re-run with --execute --max-requests ${stillMissing.length} to fill them`:'Nothing left to request'},null,2));
} else if(!stillMissing.length){
 console.log(JSON.stringify({...plan,status:'complete',requested:0},null,2));
} else {
 const cap=Number(values['max-requests']);
 assert(Number.isInteger(cap)&&cap>0,'--execute requires --max-requests with a positive integer');
 const work=stillMissing.slice(0,cap);
 const started=Date.now();
 let requested=0;
 await mapConcurrent(work,concurrency,async ({sentence,key})=>{
  const scores=await readingScores(layer,data.sourceKey,sentence);
  requested++;
  await storeScores(row(sentence,key,scores));
 }).catch(error=>{console.error('Stopped after a failure:',error instanceof Error?error.message:error);});
 console.log(JSON.stringify({...plan,status:'executed',requested,
  skippedOverCap:Math.max(0,stillMissing.length-cap),elapsedMs:Date.now()-started},null,2));
}
