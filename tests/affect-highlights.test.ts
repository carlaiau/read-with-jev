import test from 'node:test';
import assert from 'node:assert/strict';
import {highlightEligibility,highlightPairs,highlightBaseline,targetWindow} from '../src/lib/affect-highlights';
import {highlightRequest} from '../src/server/affect-highlight-request';
import type {AffectDocument} from '../src/lib/affect';
function fixture():AffectDocument {
 const text='Ann arrived. Ann fears Bob. Bob left.';
 const a=text.indexOf('Ann',1),e=text.indexOf('fears'),b=text.indexOf('Bob');
 return {doc_id:'fixture',author:'Fixture',book_title:'Synthetic test',split:'dev',text,spans:[
  {annotation_id:'a',type:'character',text:'Ann',start:a,end:a+3},
  {annotation_id:'b',type:'character',text:'Bob',start:b,end:b+3},
  {annotation_id:'e',type:'fear',text:'fears',start:e,end:e+5}],relations:[{type:'experiencer',source_annotation_id:'e',target_annotation_id:'a'}]};
}
test('highlight matrix covers all eight emotions per supplied mention without gold emotion leakage',()=>{
 const d=fixture(),pairs=highlightPairs(d);assert.equal(pairs.length,16);assert.equal(pairs.filter(p=>p.gold).length,1);
 const request=highlightRequest(d,pairs.slice(0,8),'test');
 const changed=structuredClone(d);changed.spans=changed.spans.filter(s=>s.type==='character');changed.relations=[];
 assert.deepEqual(highlightRequest(changed,highlightPairs(changed).slice(0,8),'test'),request);
 assert.equal(targetWindow(d)?.text,'Ann fears Bob. ');
 assert(!JSON.stringify(request.state).includes('emotionExpressions'));
});
test('NRC highlight baselines only score target vocabulary and use supplied mentions for attribution',()=>{
 const d=fixture(),pairs=highlightPairs(d),lexicon={fears:['fear'],arrived:['joy'],left:['sadness']};
 const fear=pairs.filter(p=>p.emotion.type==='fear');
 assert.deepEqual(fear.map(p=>highlightBaseline(d,p,'nrc-preceding',lexicon)),[1,0]);
 assert(pairs.filter(p=>p.emotion.type==='joy'||p.emotion.type==='sadness').every(p=>highlightBaseline(d,p,'nrc-passage',lexicon)===0));
});
test('target eligibility refuses ambiguous sentence segmentation and gold scope conflicts',()=>{
 const d=fixture();d.text+=' Another sentence.';assert.equal(highlightEligibility(d),'sentence-segmentation-not-three');
 const out=fixture();out.spans.push({annotation_id:'outside',type:'joy',text:'arrived',start:4,end:11});
 assert.equal(highlightEligibility(out),'gold-emotion-outside-derived-target');
});
test('lexical matching preserves offsets when Unicode lowercasing would change text length',()=>{
 const d=fixture();d.text='Start. İ Ann fear Bob. End.';
 d.spans=d.spans.map(s=>{const text=s.annotation_id==='e'?'fear':s.text;const start=d.text.indexOf(text);return {...s,text,start,end:start+text.length};});
 const pairs=highlightPairs(d).filter(p=>p.emotion.type==='fear');
 assert.deepEqual(pairs.map(p=>highlightBaseline(d,p,'nrc-nearest',{fear:['fear']})),[1,1]);
});
