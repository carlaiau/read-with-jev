import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {digest,readJson,writeJson} from '../src/lib/io';
import {type AffectData} from '../src/lib/affect';
import {highlightEligibility,highlightEmotions} from '../src/lib/affect-highlights';
import {passageRequest} from '../src/server/affect-passage-request';
import {createClient,validateAnswers} from '../src/server/jev';
const {values}=parseArgs({options:{cohort:{type:'string',default:'0'},execute:{type:'boolean',default:false},'cache-only':{type:'boolean',default:false},'max-requests':{type:'string',default:'0'}}});
const cohort=Number(values.cohort),cap=Number(values['max-requests']);assert([0,1,2].includes(cohort));assert(Number.isSafeInteger(cap)&&cap>=0);assert(!(values.execute&&values['cache-only']));
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const manifest=await readJson<{datasetHash:string;results:{documentIds:string[]}[]}>('docs/affect-iteration-5-results.json');assert.equal(digest(raw),manifest.datasetHash);
const docs=manifest.results[cohort].documentIds.map(id=>{const d=data.documents.find(d=>d.doc_id===id);assert(d&&d.split==='dev');assert.equal(highlightEligibility(d),null);return d;});
assert.equal(new Set(docs.map(d=>d.doc_id)).size,docs.length);
const jobs=docs.map(doc=>({doc,request:passageRequest(doc,'jev-1.13.0')}));
const plan={task:'REMAN direct passage eight emotions v1',prompt:'passage-v1',model:'jev-1.13.0',cohort,split:'dev',datasetHash:digest(raw),sourceHashes:data.sources,documentIds:docs.map(d=>d.doc_id),requests:jobs.length,nodeVersion:process.version,icuVersion:process.versions.icu};
if(!values.execute&&!values['cache-only'])console.log(JSON.stringify({...plan,status:'dry-run'},null,2));
else {
 if(values.execute)assert(jobs.length<=cap,'Request cap exceeded');
 const client=values.execute?createClient():undefined,scores:Record<string,number>={},responses=[];const start=Date.now();
 for(const job of jobs){
  const key=digest(JSON.stringify({task:plan.task,datasetHash:plan.datasetHash,request:job.request})),path=`data/cache/affect-passage-${key}.json`;
  let response:unknown,cached=true;
  try{response=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;assert(client,`Missing cache ${key}`);cached=false;response=await client.systemOne(job.request);validateAnswers(response,Object.keys(job.request.questions));await writeJson(path,response);}
  const answers=validateAnswers(response,Object.keys(job.request.questions));highlightEmotions.forEach((e,i)=>scores[`${job.doc.doc_id}:${e}`]=answers[`q${i}`]);responses.push({key,cached,request:job.request,response});
  if(responses.length%8===0)console.log(`Completed ${responses.length}/${jobs.length} requests`);
 }
 const path=`data/runs/affect-passage-${cohort}-${start}.json`;
 await writeJson(path,{...plan,status:'complete',startedAt:new Date(start).toISOString(),elapsedMs:Date.now()-start,callsMade:responses.filter(r=>!r.cached).length,scores,responses,
 codeHashes:Object.fromEntries(await Promise.all(['scripts/benchmark-affect-passage.ts','src/server/affect-passage-request.ts'].map(async p=>[p,digest(await readFile(p))])))});
 console.log(JSON.stringify({path,callsMade:responses.filter(r=>!r.cached).length},null,2));
}
