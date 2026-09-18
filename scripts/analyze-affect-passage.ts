import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluatePairs,type AffectData} from '../src/lib/affect';
import {highlightPairs,highlightBaseline,highlightEmotions} from '../src/lib/affect-highlights';
import {passageProjection} from '../src/lib/affect-passage';
import {digest,readJson,writeJson} from '../src/lib/io';
type Run={task:string;engine:string;prompt:string;model:string;datasetHash:string;documentIds:string[];scores:Record<string,number>};
const paths=process.argv.slice(2);assert.equal(paths.length,3,'Supply selection, follow-up, and remaining-author original run paths');
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const runs=await Promise.all(paths.map(p=>readJson<Run>(p)));
const seenDocs=new Set<string>(),seenAuthors=new Set<string>();
const cohorts=runs.map((run,i)=>{
 assert.equal(run.datasetHash,digest(raw));assert.equal(run.engine,'jev');assert.equal(run.prompt,'highlight-v1');assert.equal(run.model,'jev-1.13.0');
 assert(run.task.startsWith('REMAN character-mention by eight emotions'));
 const docs=run.documentIds.map(id=>{const d=data.documents.find(d=>d.doc_id===id);assert(d);assert.equal(d.split,'dev');assert(!seenDocs.has(id));seenDocs.add(id);return d;});
 const authors=new Set(docs.map(d=>d.author));for(const a of authors){assert(!seenAuthors.has(a),'Authors overlap');seenAuthors.add(a);}
 evaluatePairs(docs.flatMap(highlightPairs),run.scores);
 return {name:['selection','followup','remaining'][i],docs,scores:run.scores};
});
const combined={name:'later-combined',docs:cohorts.slice(1).flatMap(c=>c.docs),scores:Object.assign({},...cohorts.slice(1).map(c=>c.scores)) as Record<string,number>};
const results=[...cohorts,combined].map(c=>{
 const mentionPairs=c.docs.flatMap(highlightPairs);
 const methods=[{name:'jev@.25',threshold:.25,scores:c.scores},{name:'jev@.75',threshold:.75,scores:c.scores},
 {name:'nrc-passage',threshold:.5,scores:Object.fromEntries(c.docs.flatMap(d=>highlightPairs(d).map(p=>[p.id,highlightBaseline(d,p,'nrc-passage',data.lexicon)])))}];
 const authorOf=new Map(c.docs.flatMap(d=>highlightEmotions.map(e=>[`${d.doc_id}:${e}`,d.author])));
 const tasks=['linked','all'] as const;
 const projected=tasks.map(mode=>{
  const models=methods.map(m=>{
   const projections=c.docs.map(d=>passageProjection(d,Object.fromEntries(highlightPairs(d).map(p=>[p.id,m.scores[p.id]])),mode));
   const pairs=projections.flatMap(p=>p.pairs),scores=Object.assign({},...projections.map(p=>p.scores)) as Record<string,number>;
   return {...m,pairs,scores,metrics:evaluatePairs(pairs,scores,m.threshold)};
  });
  const authors=[...new Set(c.docs.map(d=>d.author))].sort();
  const counts=(m:typeof models[number])=>authors.map(a=>m.pairs.filter(p=>authorOf.get(p.id)===a).reduce((n,p)=>{const yes=m.scores[p.id]>=m.threshold;if(yes&&p.gold)n[0]++;else if(yes)n[1]++;else if(p.gold)n[2]++;return n;},[0,0,0]));
  const f1=(counts:number[][],sample:number[])=>{const n=sample.reduce((n,i)=>n.map((v,j)=>v+counts[i][j]),[0,0,0]);return 2*n[0]/(2*n[0]+n[1]+n[2]||1);};
  const base=counts(models[2]);let seed=20260919;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const samples=Array.from({length:2000},()=>authors.map(()=>Math.floor(random()*authors.length)));
  return {goldMode:mode,methods:models.map(m=>({name:m.name,metrics:m.metrics})),comparisons:models.slice(0,2).map(m=>{const count=counts(m),distribution=samples.map(s=>f1(count,s)-f1(base,s)).sort((a,b)=>a-b);return {candidate:m.name,baseline:'nrc-passage',deltaF1:m.metrics.micro.f1-models[2].metrics.micro.f1,percentile95:[distribution[49],distribution[1949]]};})};
 });
 const errors=Object.fromEntries([.25,.75].map(t=>{
  const fp={categoryAbsent:0,categoryPresentUnlinked:0,linkedToAnotherMention:0};let missed=0,missedWithOtherMentionFlagged=0;
  for(const d of c.docs){const pairs=highlightPairs(d);for(const p of pairs){const yes=c.scores[p.id]>=t;if(yes&&!p.gold){if(pairs.some(q=>q.emotion.type===p.emotion.type&&q.gold))fp.linkedToAnotherMention++;else if(d.spans.some(s=>s.type===p.emotion.type))fp.categoryPresentUnlinked++;else fp.categoryAbsent++;}if(!yes&&p.gold){missed++;if(pairs.some(q=>q.emotion.type===p.emotion.type&&c.scores[q.id]>=t))missedWithOtherMentionFlagged++;}}}
  return [String(t),{falsePositives:fp,missedGoldMentionPairs:missed,missedWithOtherMentionFlagged}];
 }));
 return {cohort:c.name,documents:c.docs.length,authors:new Set(c.docs.map(d=>d.author)).size,documentIds:c.docs.map(d=>d.doc_id),strict:methods.slice(0,2).map(m=>({name:m.name,metrics:evaluatePairs(mentionPairs,m.scores,m.threshold)})),passage:projected,errorDecomposition:errors};
});
const output={iteration:5,datasetHash:digest(raw),inputs:await Promise.all(paths.map(async path=>({path,sha256:digest(await readFile(path))}))),codeHashes:Object.fromEntries(await Promise.all(['scripts/analyze-affect-passage.ts','src/lib/affect-passage.ts','src/lib/affect-highlights.ts','src/lib/affect.ts'].map(async path=>[path,digest(await readFile(path))]))),newModelCalls:0,notes:'Retrospective dev diagnostics. Fixed mention thresholds transferred without passage calibration. Max aggregation; linked gold ORs original relations, all gold includes unlinked emotion annotations. Supplied gold character inventory and prior eligibility still apply. 2000 paired author bootstrap samples seed 20260919. Test partition excluded.',results};
await writeJson('docs/affect-iteration-5-results.json',output);
console.log(JSON.stringify(results.map(r=>({cohort:r.cohort,passage:r.passage.map(p=>({gold:p.goldMode,methods:p.methods.map(m=>({name:m.name,...m.metrics.micro})),comparisons:p.comparisons})),errors:r.errorDecomposition})),null,2));
