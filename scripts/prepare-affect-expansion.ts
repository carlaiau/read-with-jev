import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {digest,readJson,writeJson} from '../src/lib/io';
import type {AffectData} from '../src/lib/affect';
import {passageEligibility} from '../src/lib/affect-passage';
const output='docs/affect-iteration-7-sample.json';
try{await readFile(output);throw new Error('Sample already frozen');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const excluded=new Set<string>(),sources=[];
for(const name of (await readdir('data/runs')).sort()){
 if(!name.endsWith('.json'))continue;
 const path=`data/runs/${name}`,text=await readFile(path,'utf8'),r=JSON.parse(text) as {datasetHash?:string;documentIds?:string[];responses?:unknown[]};
 if(r.datasetHash!==digest(raw)||!r.documentIds||!r.responses?.length)continue;
 assert(r.documentIds.every(id=>data.documents.some(d=>d.doc_id===id)));
 r.documentIds.forEach(id=>excluded.add(id));sources.push({path,sha256:digest(text),documentIds:r.documentIds});
}
const audit:Record<string,number>={};
const eligible=data.documents.filter(d=>d.split==='dev'&&!excluded.has(d.doc_id)).filter(d=>{const issue=passageEligibility(d);audit[issue??'eligible']=(audit[issue??'eligible']??0)+1;return !issue;});
const groups=[false,true].map(hasCharacters=>{
 const pool=eligible.filter(d=>d.spans.some(s=>s.type==='character')===hasCharacters).sort((a,b)=>digest(`affect-expansion-v1:${a.doc_id}`).localeCompare(digest(`affect-expansion-v1:${b.doc_id}`)));
 return {stratum:hasCharacters?'with-annotated-characters':'without-annotated-characters',eligible:pool.length,documentIds:pool.slice(0,48).map(d=>d.doc_id)};
});
assert(groups.every(g=>g.documentIds.length===48),'Insufficient candidates for predeclared 48 per stratum');
const selectionPath='docs/affect-direct-threshold-selection.json';const selected=await readJson<{directThreshold:number}>(selectionPath);
const manifest={iteration:7,createdAt:new Date().toISOString(),datasetHash:digest(raw),promptHash:digest(await readFile('src/server/affect-passage-request.ts')),thresholdSelectionHash:digest(await readFile(selectionPath)),primaryThreshold:selected.directThreshold,secondaryThresholds:[.25,.75],model:'jev-1.13.0',rule:'Development documents not previously sent to JEV, excluding every same-dataset run with model responses visible at freeze time; earlier full-corpus lexical baseline evaluations may include them. Retain three-sentence/annotation-scope integrity rules. Take first48 by SHA256(affect-expansion-v1:doc_id) separately with/without annotated characters. No score or emotion label used for ordering. Balanced pooled sample is not natural prevalence. Authors may recur. No threshold tuning.',audit,exclusionSources:sources,groups,documentIds:groups.flatMap(g=>g.documentIds)};
await writeJson(output,manifest);console.log(JSON.stringify({path:output,audit,groups:groups.map(g=>({stratum:g.stratum,eligible:g.eligible,selected:g.documentIds.length})),excludedDocuments:excluded.size,threshold:selected.directThreshold},null,2));
