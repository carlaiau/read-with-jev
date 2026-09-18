import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readJson,digest,writeJson} from '../src/lib/io';
import {evaluatePairs,type AffectData} from '../src/lib/affect';
import {passageEligibility,passagePairs} from '../src/lib/affect-passage';
import {targetWindow} from '../src/lib/affect-highlights';
const runPath='data/runs/affect-passage-expansion-1789758612027.json';
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const run=await readJson<{datasetHash:string;documentIds:string[];scores:Record<string,number>;prompt:string;status:string}>(runPath);
assert.equal(run.datasetHash,digest(raw));assert.equal(run.prompt,'passage-v1');assert.equal(run.status,'complete');
const dev=data.documents.filter(d=>d.split==='dev'),eligible=dev.filter(d=>!passageEligibility(d));
const census=[false,true].map(hasCharacters=>{
 const docs=eligible.filter(d=>d.spans.some(s=>s.type==='character')===hasCharacters),pairs=docs.flatMap(passagePairs);
 return {stratum:hasCharacters?'with-annotated-characters':'without-annotated-characters',documents:docs.length,authors:new Set(docs.map(d=>d.author)).size,positiveDocuments:docs.filter(d=>passagePairs(d).some(p=>p.gold)).length,categoryPairs:pairs.length,positiveCategories:pairs.filter(p=>p.gold).length,categoryPrevalence:pairs.filter(p=>p.gold).length/pairs.length};
});
const docs=run.documentIds.map(id=>{const d=data.documents.find(d=>d.doc_id===id);assert(d&&d.split==='dev');return d;});evaluatePairs(docs.flatMap(passagePairs),run.scores);
const candidates=docs.flatMap(d=>passagePairs(d).map(p=>({pairId:p.id,documentId:d.doc_id,emotion:p.emotion.type,score:run.scores[p.id],gold:p.gold,hasCharacters:d.spans.some(s=>s.type==='character')})));
const order=(prefix:string)=>(a:typeof candidates[number],b:typeof candidates[number])=>digest(prefix+a.pairId).localeCompare(digest(prefix+b.pairId));
const chosen=new Set<string>(),matches: {pairIds:string[];emotion:string;scoreGap:number}[]=[];
// Match high-enough model flags by emotion and nearest score, never by emotion-category gold.
for(const a of candidates.filter(c=>!c.hasCharacters&&c.score>=.35).sort(order('matched-review-v1:'))){
 const available=candidates.filter(c=>c.hasCharacters&&c.score>=.35&&c.emotion===a.emotion&&!chosen.has(c.pairId)).sort((x,y)=>Math.abs(x.score-a.score)-Math.abs(y.score-a.score)||order('control:')(x,y));
 if(!available.length)continue;const b=available[0];chosen.add(a.pairId);chosen.add(b.pairId);matches.push({pairIds:[a.pairId,b.pairId],emotion:a.emotion,scoreGap:Math.abs(a.score-b.score)});if(matches.length===12)break;
}
assert.equal(matches.length,12);
for(const hasCharacters of [false,true]){
 const low=candidates.filter(c=>c.hasCharacters===hasCharacters&&c.score<.35&&!chosen.has(c.pairId)).sort(order('low-review-v1:')).slice(0,8);assert.equal(low.length,8);low.forEach(c=>chosen.add(c.pairId));
}
const selected=candidates.filter(c=>chosen.has(c.pairId)).sort(order('blind-review-order-v1:'));
const paths=['data/runs/affect-expansion-review-A.json','data/runs/affect-expansion-review-B.json','data/runs/affect-expansion-review-key.json'];
for(const path of paths){try{await readFile(path);throw new Error(`Preserve existing review file: ${path}`);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
const items=selected.map((c,i)=>{
 const d=docs.find(d=>d.doc_id===c.documentId)!,target=targetWindow(d)!;
 return {id:`item-${String(i+1).padStart(2,'0')}`,precedingContext:d.text.slice(0,target.start),target:target.text,followingContext:d.text.slice(target.end),emotion:c.emotion,
 judgment:{emotionAssociated:null,currentlyExperienced:null,evidenceQuote:null,experienceStatus:null,notes:null}};
});
const instructions='Independently judge TARGET for the named emotion: emotionAssociated and currentlyExperienced each yes/no/unclear. Association includes negated, recalled, hypothetical descriptions; context may resolve meaning but cannot supply the emotion. Currently experienced means asserted as felt at the target scene time, not the reader\'s present; do not infer it from tense alone. Quote target evidence when possible; unclear is valid. Optional experienceStatus: asserted/negated/hypothetical/remembered/mixed/unclear. Do not infer sadness solely from pain, joy solely from benefit, or anticipation solely from future tense. Do not compare answers with another reviewer before submitting. These proposed review instructions define a product audit, not new official REMAN categories.';
for(const [i,reviewer] of ['A','B'].entries())await writeJson(paths[i],{version:1,status:'unreviewed-not-gold',reviewer,instructions,items});
await writeJson(paths[2],{status:'analyst-key-not-gold',datasetHash:digest(raw),runPath,runHash:digest(await readFile(runPath)),matches,items:selected.map((c,i)=>({id:items[i].id,...c,band:c.score>=.35?'flag':'below-threshold',adjudicated:null}))});
const publicReport={iteration:8,datasetHash:digest(raw),guidelines:{path:'data/raw/affect/reman-guidelines.pdf',sha256:digest(await readFile('data/raw/affect/reman-guidelines.pdf')),pages:[1,2,3,10,11],finding:'Character annotations are restricted to emotion participants, not an exhaustive cast inventory. Filtering or supplying that inventory conditions on emotion annotation decisions.'},census:{developmentDocuments:dev.length,eligibleDocuments:eligible.length,scope:'Three-sentence target with valid source spans and all annotated emotion expressions within target; full development only, test not scored',strata:census},review:{status:'unreviewed-not-gold',sourceRun:runPath,sourceRunHash:digest(await readFile(runPath)),items:items.length,distinctDocuments:new Set(selected.map(c=>c.documentId)).size,matchedFlagPairs:matches.length,lowScorePerStratum:8,meanAbsoluteScoreGap:matches.reduce((n,m)=>n+m.scoreGap,0)/matches.length,maxAbsoluteScoreGap:Math.max(...matches.map(m=>m.scoreGap)),selection:'12 flagged pairs matched across annotation-character strata by identical category and nearest model score, without replacement; 8 below-threshold items per stratum; hash-shuffled order. Emotion-category gold outcomes are not used in selection; strata use corpus character annotations. Matching is approximate and descriptive, not causal or prevalence-representative.',packetPaths:paths.slice(0,2),packetHashes:await Promise.all(paths.slice(0,2).map(async p=>digest(await readFile(p))))},newModelCalls:0,codeHash:digest(await readFile('scripts/audit-affect-selection.ts'))};
await writeJson('docs/affect-iteration-8-results.json',publicReport);console.log(JSON.stringify(publicReport,null,2));
