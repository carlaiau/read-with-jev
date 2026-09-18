import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest,readJson,writeJson} from '../src/lib/io';
import {evaluatePairs,type AffectData} from '../src/lib/affect';
import {highlightPairs,highlightEligibility} from '../src/lib/affect-highlights';
import {linearFeatures,linearScore,fitLinear,featureNames} from '../src/lib/affect-linear';
const started=Date.now();
const raw=await readFile('data/processed/affect.json','utf8'),data=JSON.parse(raw) as AffectData;
const train=await readJson<{datasetHash:string;documentIds:string[]}>('docs/affect-highlight-threshold-selection.json');
const validation=await readJson<{datasetHash:string;documentIds:string[]}>('docs/affect-iteration-3-followup.json');
assert.equal(train.datasetHash,digest(raw));assert.equal(validation.datasetHash,digest(raw));
const select=(ids:string[])=>ids.map(id=>{const d=data.documents.find(d=>d.doc_id===id);assert(d&&d.split==='dev'&&!highlightEligibility(d));return d;});
const trainDocs=select(train.documentIds),validationDocs=select(validation.documentIds);
const trainAuthors=new Set(trainDocs.map(d=>d.author));assert(validationDocs.every(d=>!trainAuthors.has(d.author)),'Training and validation authors overlap');
const excluded=new Set([...trainDocs,...validationDocs].map(d=>d.author));
const docs=data.documents.filter(d=>d.split==='dev'&&!excluded.has(d.author)&&!highlightEligibility(d)).sort((a,b)=>digest(a.doc_id).localeCompare(digest(b.doc_id))).slice(0,48);
const rows=trainDocs.flatMap(doc=>highlightPairs(doc).map(p=>({x:linearFeatures(doc,p,data.lexicon),y:Number(p.gold)})));
const validationPairs=validationDocs.flatMap(highlightPairs);
const candidates=[];
for(const lambda of [.001,.01,.1]){
 const weights=fitLinear(rows,lambda);const scores=Object.fromEntries(validationDocs.flatMap(doc=>highlightPairs(doc).map(p=>[p.id,linearScore(weights,linearFeatures(doc,p,data.lexicon))])));
 for(let i=1;i<=19;i++){const threshold=i/20;const metrics=evaluatePairs(validationPairs,scores,threshold);candidates.push({lambda,threshold,weights,validationF1:metrics.micro.f1});}
}
// Tune only on the earlier validation cohort, never the new comparison cohort. Do not refit.
const selected=candidates.sort((a,b)=>b.validationF1-a.validationF1||b.lambda-a.lambda||b.threshold-a.threshold)[0];
const pairs=docs.flatMap(highlightPairs);const scores=Object.fromEntries(docs.flatMap(doc=>highlightPairs(doc).map(p=>[p.id,linearScore(selected.weights,linearFeatures(doc,p,data.lexicon))])));
const report={task:'REMAN character-mention by eight emotions, no supplied emotion spans, v1',engine:'linear-nrc',prompt:null,model:null,split:'dev',
 datasetHash:digest(raw),documentIds:docs.map(d=>d.doc_id),documents:docs.length,pairs:pairs.length,threshold:selected.threshold,trainingDocumentIds:train.documentIds,validationDocumentIds:validation.documentIds,
 featureNames,weights:selected.weights,lambda:selected.lambda,validationF1:selected.validationF1,search:candidates.map(({weights,...rest})=>rest),
 metrics:evaluatePairs(pairs,scores,selected.threshold),scores,responses:[],callsMade:0,elapsedMs:Date.now()-started,
 codeHashes:Object.fromEntries(await Promise.all(['src/lib/affect-linear.ts','src/lib/affect-highlights.ts','scripts/benchmark-affect-linear.ts'].map(async p=>[p,digest(await readFile(p))])))};
const path=`data/runs/affect-linear-${docs.length}-${started}.json`;await writeJson(path,report);console.log(JSON.stringify({path,lambda:report.lambda,threshold:report.threshold,validationF1:report.validationF1,metrics:report.metrics.micro},null,2));
