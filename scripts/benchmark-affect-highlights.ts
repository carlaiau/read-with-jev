import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {digest,readJson,writeJson} from '../src/lib/io';
import {evaluatePairs,type AffectData} from '../src/lib/affect';
import {highlightEligibility,highlightPairs,highlightBaseline} from '../src/lib/affect-highlights';
import {highlightRequest} from '../src/server/affect-highlight-request';
import {createClient,validateAnswers} from '../src/server/jev';
const {values} = parseArgs({options:{
  prompt:{type:'string',default:'v1'},
  threshold:{type:'string',default:'0.5'},'exclude-authors-from':{type:'string'},
  engine:{type:'string',default:'nrc-nearest'},limit:{type:'string',default:'64'},offset:{type:'string',default:'0'},
  model:{type:'string',default:'jev-1.13.0'},execute:{type:'boolean',default:false},'cache-only':{type:'boolean',default:false},'max-requests':{type:'string',default:'0'},
}});
assert(['v1','v2'].includes(values.prompt!),'Unknown prompt');
const prompt=values.prompt as 'v1'|'v2';
const threshold=Number(values.threshold);assert(Number.isFinite(threshold)&&threshold>0&&threshold<1,'Invalid threshold');
const engine=values.engine!,limit=Number(values.limit),offset=Number(values.offset),cap=Number(values['max-requests']);
assert(['jev','none','nrc-passage','nrc-nearest','nrc-preceding'].includes(engine));
assert(Number.isSafeInteger(limit)&&limit>0&&Number.isSafeInteger(offset)&&offset>=0&&Number.isSafeInteger(cap)&&cap>=0);
assert(!(values.execute&&values['cache-only']));
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const excludedAuthors=new Set<string>();
if(values['exclude-authors-from']){
 const manifest=await readJson<{datasetHash:string;documentIds:string[]}>(values['exclude-authors-from']);assert.equal(manifest.datasetHash,digest(raw),'Exclusion manifest dataset differs');
 for(const id of manifest.documentIds){const d=data.documents.find(d=>d.doc_id===id);assert(d,'Unknown excluded document');excludedAuthors.add(d.author);}
}
const audit:Record<string,number>={};
const eligible=data.documents.filter(d=>d.split==='dev'&&!excludedAuthors.has(d.author)).filter(d=>{const issue=highlightEligibility(d);audit[issue??'eligible']=(audit[issue??'eligible']??0)+1;return !issue;}).sort((a,b)=>digest(a.doc_id).localeCompare(digest(b.doc_id)));
const docs=eligible.slice(offset,offset+limit);assert(docs.length);
const pairs=docs.flatMap(highlightPairs);
const jobs=docs.flatMap(doc=>{const ps=highlightPairs(doc);const jobs=[];for(let i=0;i<ps.length;i+=8){const chunk=ps.slice(i,i+8);jobs.push({chunk,request:highlightRequest(doc,chunk,values.model!,prompt)});}return jobs;});
const plan={task:'REMAN character-mention by eight emotions, no supplied emotion spans, v1',engine,prompt:engine==='jev'?`highlight-${prompt}`:null,
  split:'dev',offset,threshold,excludedAuthors:[...excludedAuthors].sort(),datasetHash:digest(raw),sourceHashes:data.sources,documentIds:docs.map(d=>d.doc_id),documents:docs.length,pairs:pairs.length,
  model:engine==='jev'?values.model:null,requests:engine==='jev'?jobs.length:0,audit,nodeVersion:process.version,icuVersion:process.versions.icu,
  caveat:'Oracle character mentions, automatically segmented middle-sentence target checked against gold scope. Emotion association includes negated/hypothetical/remembered expression. Missing corpus links score negative; not exhaustive felt-emotion gold.'};
if(engine==='jev'&&!values.execute&&!values['cache-only'])console.log(JSON.stringify({...plan,status:'dry-run'},null,2));
else {
  if(engine==='jev'&&values.execute)assert(jobs.length<=cap,`Planned ${jobs.length} requests exceeds cap ${cap}`);
  const client=engine==='jev'&&values.execute?createClient():undefined;
  const scores:Record<string,number>={};const responses=[];const start=Date.now();
  for(const job of engine==='jev'?jobs:[]) {
    const key=digest(JSON.stringify({task:'highlight-v1',datasetHash:plan.datasetHash,request:job.request}));const path=`data/cache/affect-highlight-${key}.json`;
    let response:unknown,cached=true;
    try{response=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;assert(client,`Missing cache ${key}`);cached=false;response=await client.systemOne(job.request);validateAnswers(response,Object.keys(job.request.questions));await writeJson(path,response);}
    const answers=validateAnswers(response,Object.keys(job.request.questions));job.chunk.forEach((p,i)=>scores[p.id]=answers[`q${i}`]);responses.push({key,cached,request:job.request,response});
  }
  if(engine!=='jev')for(const doc of docs)for(const pair of highlightPairs(doc))scores[pair.id]=highlightBaseline(doc,pair,engine,data.lexicon);
  const metrics=evaluatePairs(pairs,scores,threshold);
  const report={...plan,status:'complete',startedAt:new Date(start).toISOString(),elapsedMs:Date.now()-start,callsMade:responses.filter(x=>!x.cached).length,
    codeHashes:Object.fromEntries(await Promise.all(['scripts/benchmark-affect-highlights.ts','src/lib/affect-highlights.ts','src/server/affect-highlight-request.ts'].map(async p=>[p,digest(await readFile(p))]))),metrics,scores,responses};
  const path=`data/runs/affect-highlight-${engine}-${docs.length}-${digest(JSON.stringify(plan)).slice(0,12)}-${start}.json`;await writeJson(path,report);console.log(JSON.stringify({path,micro:metrics.micro,macroF1:metrics.macroF1,callsMade:report.callsMade},null,2));
}
