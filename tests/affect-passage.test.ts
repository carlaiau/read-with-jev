import test from 'node:test';
import assert from 'node:assert/strict';
import { passageProjection } from '../src/lib/affect-passage';
import { highlightPairs } from '../src/lib/affect-highlights';
import type { AffectDocument } from '../src/lib/affect';
const doc:AffectDocument = {doc_id:'synthetic',author:'test',book_title:'test',split:'dev',text:'Start. Ann fears Bob. End.',spans:[
 {annotation_id:'a',type:'character',text:'Ann',start:7,end:10},
 {annotation_id:'b',type:'character',text:'Bob',start:17,end:20},
 {annotation_id:'f',type:'fear',text:'fears',start:11,end:16},
],relations:[{type:'experiencer',source_annotation_id:'f',target_annotation_id:'a'}]};
test('passage projection removes wrong-mention errors without changing gold labels',()=>{
 const scores=Object.fromEntries(highlightPairs(doc).map(p=>[p.id,p.character.annotation_id==='b'&&p.emotion.type==='fear'?.8:.1]));
 const result=passageProjection(doc,scores,'linked');
 assert.equal(result.pairs.length,8);assert.equal(result.pairs.filter(p=>p.gold).length,1);
 assert.equal(result.scores['synthetic:fear'],.8);
 assert.throws(()=>passageProjection(doc,{},'linked'));
 assert.throws(()=>passageProjection(doc,{...scores,extra:.5},'all'));
});
test('unlinked emotion remains positive only in all-annotations passage task',()=>{
 const unlinked={...doc,relations:[]};
 const scores=Object.fromEntries(highlightPairs(unlinked).map(p=>[p.id,.1]));
 assert.equal(passageProjection(unlinked,scores,'linked').pairs.filter(p=>p.gold).length,0);
 assert.equal(passageProjection(unlinked,scores,'all').pairs.filter(p=>p.gold).length,1);
});

test('direct passage gold and lexicon work without annotated characters and reject scope errors',async()=>{
 const {passageEligibility,passagePairs,passageLexicon}=await import('../src/lib/affect-passage');
 const d={...doc,spans:doc.spans.filter(s=>s.type!=='character'),relations:[]};
 assert.equal(passageEligibility(d),null);
 assert.equal(passagePairs(d).filter(p=>p.gold).length,1);
 assert.equal(passageLexicon(d,{fears:['fear'],start:['joy']})['synthetic:fear'],1);
 assert.equal(passageLexicon(d,{fears:['fear'],start:['joy']})['synthetic:joy'],0);
 assert.equal(passageEligibility({...d,spans:[{annotation_id:'bad',type:'fear',text:'Start',start:0,end:5}]}),'gold-emotion-outside-derived-target');
 assert.throws(()=>passagePairs({...d,spans:[{annotation_id:'bad',type:'fear',text:'wrong',start:0,end:5}]}));
});
