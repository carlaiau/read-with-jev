// Fills the shared cache so public readers hit it instead of the model.
// Copying local data/cache/ answers into the store is free and always runs. Sentences that no
// cache can answer need an explicit --execute --max-requests N, matching the benchmark runner.
// Warming is prediction caching, never annotation.
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {mapConcurrent} from '../src/lib/concurrency';
import {readJson} from '../src/lib/io';
import {readingData,readingScores,readingCacheKey,readingModel,diskScores} from '../src/server/reading-emotions';
import {emotionStore,storeScores,emotionStoreEnabled} from '../src/server/emotion-store';
import type {LibraryCatalog} from '../src/lib/library-model';

const {values}=parseArgs({options:{document:{type:'string',default:'pride-and-prejudice'},
 concurrency:{type:'string',default:'4'},limit:{type:'string'},
 execute:{type:'boolean',default:false},'max-requests':{type:'string'}}});
assert(emotionStoreEnabled(),'Set DATABASE_URL to a Neon connection string first');
const concurrency=Number(values.concurrency);
assert(Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=32,'Concurrency must be 1-32');
// readingScores refuses rather than queues once its per-process ceiling is reached, so a bulk
// run has to raise that ceiling to match its own parallelism.
if(!process.env.JEV_SERVER_CONCURRENCY)process.env.JEV_SERVER_CONCURRENCY=String(concurrency);
// The shared store is the destination; a quarter of a million local copies would cost gigabytes.
if(!process.env.JEV_SKIP_DISK_CACHE)process.env.JEV_SKIP_DISK_CACHE='1';

/** A busy signal is backpressure, not a failure: wait and try again rather than abandoning the run. */
async function withRetry<T>(work:()=>Promise<T>,attempts=6):Promise<T>{
 for(let attempt=0;;attempt++){
  try{return await work();}
  catch(error){
   const status=(error as {status?:number}).status;
   if(attempt>=attempts-1||(status!==429&&status!==503))throw error;
   await new Promise(resolve=>setTimeout(resolve,Math.min(8000,300*2**attempt)+Math.random()*250));
  }
 }
}
const cap=values.execute?Number(values['max-requests']):0;
if(values.execute)assert(Number.isInteger(cap)&&cap>0,'--execute requires --max-requests with a positive integer');

const catalog=await readJson<LibraryCatalog>('data/library/catalog.json');
const documents=values.document==='all'?catalog.documents.map(d=>d.documentId):[values.document];
assert(documents.every(id=>catalog.documents.some(d=>d.documentId===id)),`Unknown document: ${values.document}`);
const sql=emotionStore()!;
let remaining=cap;
const startedAll=Date.now();
let completed=0;
type DocumentReport={documentId:string;sentences:number;alreadyInStore:number;seededFromDisk:number;needsModel:number;requested:number;errors:number;failed:boolean};
const report:DocumentReport[]=[];

for(const documentId of documents){
 const layer=`document:${documentId}`;
 const data=await readingData(layer);
 const all=data.plans.flatMap(p=>p.sentences);
 const sentences=values.limit?all.slice(0,Number(values.limit)):all;
 const keys=sentences.map(s=>readingCacheKey(data.sourceKey,s));
 // Batched lookups instead of one round trip per sentence, chunked to keep request bodies small.
 const present=new Set<string>();
 for(let i=0;i<keys.length;i+=2000){
  const chunk=keys.slice(i,i+2000);
  const rows=await sql`SELECT cache_key FROM reader_emotion_scores WHERE cache_key = ANY(${chunk}::text[])` as {cache_key:string}[];
  for(const row of rows)present.add(row.cache_key);
 }
 const missing=sentences.map((sentence,i)=>({sentence,key:keys[i]})).filter(({key})=>!present.has(key));
 const row=(sentence:typeof sentences[number],key:string,scores:Awaited<ReturnType<typeof readingScores>>)=>
  ({cacheKey:key,layer,sentenceId:sentence.id,sourceKey:data.sourceKey,model:readingModel,scores});

 let seeded=0;
 const needsModel:typeof missing=[];
 await mapConcurrent(missing,concurrency,async ({sentence,key})=>{
  const scores=await diskScores(key);
  if(!scores){needsModel.push({sentence,key});return;}
  if(await storeScores(row(sentence,key,scores)))seeded++;
 });

 let requested=0,errors=0,failed=false;
 if(values.execute&&remaining>0&&needsModel.length){
  const work=needsModel.slice(0,remaining);
  let consecutive=0;
  await mapConcurrent(work,concurrency,async ({sentence,key})=>{
   try{
    const scores=await withRetry(()=>readingScores(layer,data.sourceKey,sentence));
    await storeScores(row(sentence,key,scores));
    requested++;consecutive=0;
    completed++;
    if(requested%250===0)console.error(JSON.stringify({documentId,requested,of:work.length,
     // Rate is across the whole run, not this document, so it stays comparable between books.
     ratePerSecond:+(completed/((Date.now()-startedAll)/1000)).toFixed(2),
     elapsedMin:+((Date.now()-startedAll)/60000).toFixed(1)}));
   }catch(error){
    errors++;consecutive++;
    // One bad sentence is noise; a wall of them means the key, the model or the network is
    // gone, and continuing would just burn through the corpus failing.
    if(consecutive>=25)throw new Error(`${documentId}: 25 consecutive failures, last: ${error instanceof Error?error.message:error}`);
   }
  }).catch(error=>{failed=true;console.error('Aborted:',error instanceof Error?error.message:error);});
  remaining-=requested;
 }
 const entry:DocumentReport={documentId,sentences:sentences.length,alreadyInStore:sentences.length-missing.length,
  seededFromDisk:seeded,needsModel:needsModel.length-requested,requested,errors,failed};
 report.push(entry);
 console.error(JSON.stringify(entry));
 if(failed)break;
}

const total=(field:keyof DocumentReport)=>report.reduce((n,r)=>n+Number(r[field]),0);
console.log(JSON.stringify({model:readingModel,documents:report.length,
 status:values.execute?'executed':'dry-run',
 sentences:total('sentences'),alreadyInStore:total('alreadyInStore'),seededFromDisk:total('seededFromDisk'),
 requested:total('requested'),errors:total('errors'),stillNeedsModel:total('needsModel'),
 elapsedMin:+((Date.now()-startedAll)/60000).toFixed(1),
 next:total('needsModel')?`Re-run with --execute --max-requests ${total('needsModel')}`:'Fully warmed',
 perDocument:report},null,2));
