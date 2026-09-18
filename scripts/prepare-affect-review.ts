import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest,readJson,writeJson} from '../src/lib/io';
import {highlightPairs,targetWindow} from '../src/lib/affect-highlights';
import type {AffectData} from '../src/lib/affect';
const paths=process.argv.slice(2);assert(paths.length,'Pass completed JEV highlight run paths');
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const candidates=new Map<string,{pairId:string;documentId:string;characterId:string;emotion:string;score:number}>();
for(const path of paths){
 const run=await readJson<{datasetHash:string;status:string;engine:string;task:string;documentIds:string[];scores:Record<string,number>}>(path);
 assert.equal(run.datasetHash,digest(raw));assert(run.status==='complete'&&run.engine==='jev'&&run.task.startsWith('REMAN character-mention by eight emotions'));
 for(const id of run.documentIds){const doc=data.documents.find(d=>d.doc_id===id);assert(doc&&doc.split==='dev');for(const p of highlightPairs(doc)){
  const score=run.scores[p.id];assert(Number.isFinite(score)&&score>=0&&score<=1);
  assert(!candidates.has(p.id),'Duplicate review pair');
  candidates.set(p.id,{pairId:p.id,documentId:id,characterId:p.character.annotation_id,emotion:p.emotion.type,score});
 }}
}
const bands={high:[.75,1.01],medium:[.25,.75],low:[0,.25]};
const selected=Object.entries(bands).flatMap(([band,[lower,upper]])=>[...candidates.values()].filter(c=>c.score>=lower&&c.score<upper).sort((a,b)=>digest('review-v1:'+a.pairId).localeCompare(digest('review-v1:'+b.pairId))).slice(0,12).map(c=>({...c,band})));
selected.sort((a,b)=>digest('blind-order:'+a.pairId).localeCompare(digest('blind-order:'+b.pairId)));
const items=selected.map((c,i)=>{
 const d=data.documents.find(d=>d.doc_id===c.documentId)!;const target=targetWindow(d)!;const character=d.spans.find(s=>s.annotation_id===c.characterId)!;
 return {id:`review-${i+1}`,precedingContext:d.text.slice(0,target.start),target:target.text,followingContext:d.text.slice(target.end),
  character:{text:character.text,start:character.start,end:character.end,before:d.text.slice(Math.max(0,character.start-60),character.start),after:d.text.slice(character.end,character.end+60)},emotion:c.emotion,
  reviewerA:{emotionAssociated:null,currentlyExperienced:null,evidenceQuote:null,notes:null},reviewerB:{emotionAssociated:null,currentlyExperienced:null,evidenceQuote:null,notes:null},adjudicated:null};
});
const metadata={version:1,status:'unreviewed-not-gold',instructions:'Judge whether TARGET associates the stated emotion with the identified character; context is for interpretation only. Separately judge whether it is currently experienced. Use yes/no/unclear for each judgment. Cite evidence in TARGET. Independent humans must fill both reviews and resolve disagreements before any labels become gold. Scores and corpus labels are withheld.',items};
await writeJson('data/runs/affect-blind-review.json',metadata);
await writeJson('data/runs/affect-blind-review-key.json',{datasetHash:digest(raw),sources:paths,sampling:'Up to 12 per fixed model-score band, deterministic hash; not a prevalence-representative sample',items:selected.map((c,i)=>({id:`review-${i+1}`,...c}))});
console.log(JSON.stringify({items:items.length,packet:'data/runs/affect-blind-review.json',status:metadata.status}));
