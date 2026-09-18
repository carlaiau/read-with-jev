import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest,readJson,writeJson} from '../src/lib/io';
import {evaluatePairs,type AffectData,type EvaluationPair} from '../src/lib/affect';
import {highlightPairs,highlightBaseline} from '../src/lib/affect-highlights';
import {passageProjection} from '../src/lib/affect-passage';
type Run={task:string;status:string;prompt:string;model:string;split:string;cohort:number;datasetHash:string;documentIds:string[];scores:Record<string,number>;callsMade:number;responses:{cached:boolean;response:{model:string;usage?:{input_tokens:number;output_tokens:number}}}[]};
type Selection={datasetHash:string;directRunHash:string;projectedRunHash:string;directThreshold:number;projectedThreshold:number};
const paths=process.argv.slice(2);assert([1,3].includes(paths.length),'Pass selection run only to freeze thresholds, then all three direct runs to evaluate');
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const previous=await readJson<{datasetHash:string;inputs:{path:string;sha256:string}[];results:{documentIds:string[]}[]}>('docs/affect-iteration-5-results.json');assert.equal(previous.datasetHash,digest(raw));
const runs=await Promise.all(paths.map(p=>readJson<Run>(p)));
const sources=await Promise.all(previous.inputs.map(async input=>{assert.equal(digest(await readFile(input.path)),input.sha256);return readJson<Run>(input.path);}));
const seenAuthors=new Set<string>(),seenDocs=new Set<string>();
const cohorts=runs.map((run,i)=>{
 assert.equal(run.task,'REMAN direct passage eight emotions v1');assert.equal(run.status,'complete');assert.equal(run.prompt,'passage-v1');assert.equal(run.model,'jev-1.13.0');assert.equal(run.split,'dev');assert.equal(run.cohort,i);assert.equal(run.datasetHash,digest(raw));assert.deepEqual(run.documentIds,previous.results[i].documentIds);assert.deepEqual(run.documentIds,sources[i].documentIds);
 const docs=run.documentIds.map(id=>{const d=data.documents.find(d=>d.doc_id===id);assert(d&&d.split==='dev');assert(!seenDocs.has(id));seenDocs.add(id);return d;});
 const authors=new Set(docs.map(d=>d.author));for(const a of authors){assert(!seenAuthors.has(a),'Author overlap');seenAuthors.add(a);}
 evaluatePairs(docs.flatMap(highlightPairs),sources[i].scores);
 const projections=docs.map(d=>passageProjection(d,Object.fromEntries(highlightPairs(d).map(p=>[p.id,sources[i].scores[p.id]])),'all'));
 const pairs=projections.flatMap(p=>p.pairs),projected=Object.assign({},...projections.map(p=>p.scores)) as Record<string,number>;
 const nrc=Object.assign({},...docs.map(d=>passageProjection(d,Object.fromEntries(highlightPairs(d).map(p=>[p.id,highlightBaseline(d,p,'nrc-passage',data.lexicon)])),'all').scores)) as Record<string,number>;
 evaluatePairs(pairs,run.scores);
 return {name:['selection','followup','remaining'][i],docs,pairs,direct:run.scores,projected,nrc};
});
const selectionPath='docs/affect-direct-threshold-selection.json';
if(paths.length===1){
 const c=cohorts[0];
 const sweep=(scores:Record<string,number>)=>Array.from({length:19},(_,i)=>{const threshold=(i+1)/20;return {threshold,...evaluatePairs(c.pairs,scores,threshold).micro};});
 const directGrid=sweep(c.direct),projectedGrid=sweep(c.projected);
 const choose=(grid:typeof directGrid)=>[...grid].sort((a,b)=>b.f1-a.f1||b.threshold-a.threshold)[0].threshold;
 const selection={datasetHash:digest(raw),directRunHash:digest(await readFile(paths[0])),projectedRunHash:previous.inputs[0].sha256,documentIds:c.docs.map(d=>d.doc_id),createdAt:new Date().toISOString(),rule:'Select micro F1 on all annotated passage categories using first 64 development excerpts only, grid .05.. .95 step .05, ties higher threshold. Select direct and projected independently for matched task. Fixed .25/.75 also reported; no calibration claim.',directThreshold:choose(directGrid),projectedThreshold:choose(projectedGrid),directGrid,projectedGrid};
 // Do not silently overwrite a previously frozen selection.
 try{await readFile(selectionPath);throw new Error('Selection already exists; preserve frozen artifact');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await writeJson(selectionPath,selection);console.log(JSON.stringify(selection,null,2));
}else{
 const selected=await readJson<Selection>(selectionPath);assert.equal(selected.datasetHash,digest(raw));assert.equal(selected.directRunHash,digest(await readFile(paths[0])));assert.equal(selected.projectedRunHash,previous.inputs[0].sha256);
 const later=cohorts.slice(1),combined={name:'later-combined',docs:later.flatMap(c=>c.docs),pairs:later.flatMap(c=>c.pairs),direct:Object.assign({},...later.map(c=>c.direct)),projected:Object.assign({},...later.map(c=>c.projected)),nrc:Object.assign({},...later.map(c=>c.nrc))};
 const results=[...cohorts,combined].map(c=>{
  const methods=[{name:'direct-selected',threshold:selected.directThreshold,scores:c.direct},{name:'projected-selected',threshold:selected.projectedThreshold,scores:c.projected},{name:'nrc',threshold:.5,scores:c.nrc},
   {name:'direct@.25',threshold:.25,scores:c.direct},{name:'projected@.25',threshold:.25,scores:c.projected},{name:'direct@.75',threshold:.75,scores:c.direct},{name:'projected@.75',threshold:.75,scores:c.projected}];
  const authors=[...new Set(c.docs.map(d=>d.author))].sort();const authorOf=new Map(c.docs.map(d=>[d.doc_id,d.author]));
  const counts=(m:typeof methods[number])=>authors.map(a=>c.pairs.filter(p=>authorOf.get(p.id.slice(0,p.id.lastIndexOf(':')))===a).reduce((n,p)=>{const yes=m.scores[p.id]>=m.threshold;if(yes&&p.gold)n[0]++;else if(yes)n[1]++;else if(p.gold)n[2]++;return n;},[0,0,0]));
  const f1=(counts:number[][],sample:number[])=>{const n=sample.reduce((n,i)=>n.map((v,j)=>v+counts[i][j]),[0,0,0]);return 2*n[0]/(2*n[0]+n[1]+n[2]||1);};
  let seed=20260919;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};const samples=Array.from({length:2000},()=>authors.map(()=>Math.floor(random()*authors.length)));
  const comparisons=[[0,1],[0,2],[3,4],[3,2]].map(([ai,bi])=>{const a=methods[ai],b=methods[bi],ca=counts(a),cb=counts(b),distribution=samples.map(s=>f1(ca,s)-f1(cb,s)).sort((a,b)=>a-b),full=authors.map((_,i)=>i);return {candidate:a.name,baseline:b.name,deltaF1:f1(ca,full)-f1(cb,full),percentile95:[distribution[49],distribution[1949]]};});
  return {cohort:c.name,documents:c.docs.length,authors:authors.length,documentIds:c.docs.map(d=>d.doc_id),methods:methods.map(m=>({name:m.name,threshold:m.threshold,metrics:evaluatePairs(c.pairs,m.scores,m.threshold)})),comparisons};
 });
 const usage=(r:Run)=>({callsMade:r.callsMade,requests:r.responses.length,returnedModels:[...new Set(r.responses.map(x=>x.response.model))],inputTokens:r.responses.reduce((n,x)=>n+(x.response.usage?.input_tokens??0),0),outputTokens:r.responses.reduce((n,x)=>n+(x.response.usage?.output_tokens??0),0)});
 const output={iteration:6,datasetHash:digest(raw),thresholdSelectionHash:digest(await readFile(selectionPath)),inputs:await Promise.all(paths.map(async(path,i)=>({path,sha256:digest(await readFile(path)),directUsage:usage(runs[i]),projectedUsage:usage(sources[i])}))),codeHashes:Object.fromEntries(await Promise.all(['scripts/analyze-affect-direct.ts','src/server/affect-passage-request.ts','src/lib/affect-passage.ts'].map(async p=>[p,digest(await readFile(p))]))),notes:'Retrospective reused development cohorts, all-annotation passage gold, disjoint authors across cohorts. Prompt and fixed .25/.75 set before requests; selected thresholds frozen on first64 before later requests. 2000 paired author bootstrap seed20260919; unadjusted exploratory intervals. Direct state has no character annotations; matched sample retains original oracle eligibility. No new human labels. Test untouched.',results};
 await writeJson('docs/affect-iteration-6-results.json',output);
 console.log(JSON.stringify({usage:output.inputs,results:results.map(r=>({...r,documentIds:undefined,methods:r.methods.map(m=>({name:m.name,threshold:m.threshold,...m.metrics.micro}))}))},null,2));
}
