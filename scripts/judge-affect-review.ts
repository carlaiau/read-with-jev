import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {readJson,digest,writeJson} from '../src/lib/io';
import {mapConcurrent} from '../src/lib/concurrency';
import {judgeRequest,parseJudgeResponse,type JudgeItem} from '../src/server/affect-judge';
const {values}=parseArgs({options:{execute:{type:'boolean',default:false},'cache-only':{type:'boolean',default:false},limit:{type:'string',default:'40'},'max-requests':{type:'string',default:'0'}}});
const limit=Number(values.limit),cap=Number(values['max-requests']);assert(Number.isSafeInteger(limit)&&limit>=1&&limit<=40);assert(Number.isSafeInteger(cap)&&cap>=0);assert(!(values.execute&&values['cache-only']));
const packetPath='data/runs/affect-expansion-review-A.json',packetRaw=await readFile(packetPath,'utf8');
const packet=JSON.parse(packetRaw) as {status:string;instructions:string;items:JudgeItem[]};
assert.equal(packet.status,'unreviewed-not-gold');assert.equal(packet.items.length,40);assert.equal(new Set(packet.items.map(i=>i.id)).size,40);
const audit=await readJson<{review:{packetHashes:string[]}}>('docs/affect-iteration-8-results.json');assert.equal(digest(packetRaw),audit.review.packetHashes[0]);
const jobs=packet.items.slice(0,limit).map(item=>({item,request:judgeRequest(item,packet.instructions)}));
const plan={task:'Blinded automated literary emotion review',status:'model-judgments-not-gold',model:'gpt-5.6-sol',reasoning:'medium',packetPath,packetHash:digest(packetRaw),items:jobs.length,maxOutputTokensPerCall:3000,concurrency:2};
if(!values.execute&&!values['cache-only'])console.log(JSON.stringify({...plan,dryRun:true},null,2));
else {
 if(values.execute){assert(jobs.length<=cap,'Request cap exceeded');assert(process.env.OPENAI_API_KEY,'OPENAI_API_KEY is missing');}
 let completed=0;const start=Date.now();
 const results=await mapConcurrent(jobs,2,async({item,request})=>{
  const key=digest(JSON.stringify({packetHash:plan.packetHash,request})),path=`data/cache/affect-openai-judge-${key}.json`;let response:unknown,cached=true;
  try{response=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;assert(values.execute,'Missing judge cache');cached=false;
   const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(120000)});
   if(!res.ok)throw new Error(`OpenAI HTTP ${res.status}; request ${res.headers.get('x-request-id')??'unknown'}`);
   response=await res.json();await writeJson(path,response);
  }
  const judgment=parseJudgeResponse(response,item);completed++;console.log(`Judged ${completed}/${jobs.length}`);
  return {id:item.id,key,cached,request,response,judgment};
 });
 const path=`data/runs/affect-openai-judge-${limit}-${start}.json`;
 await writeJson(path,{...plan,startedAt:new Date(start).toISOString(),elapsedMs:Date.now()-start,callsMade:results.filter(r=>!r.cached).length,codeHashes:Object.fromEntries(await Promise.all(['scripts/judge-affect-review.ts','src/server/affect-judge.ts'].map(async p=>[p,digest(await readFile(p))]))),results});
 console.log(JSON.stringify({path,callsMade:results.filter(r=>!r.cached).length,status:plan.status}));
}
