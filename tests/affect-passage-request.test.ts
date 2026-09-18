import test from 'node:test';
import assert from 'node:assert/strict';
import {passageRequest} from '../src/server/affect-passage-request';
import type {AffectDocument} from '../src/lib/affect';
test('direct passage request contains no annotation inventory, gold, or metadata',()=>{
 const doc:AffectDocument={doc_id:'secret',author:'secret',book_title:'secret',split:'dev',text:'Ann arrived. She fears Bob. Bob left.',spans:[],relations:[]};
 const request=passageRequest(doc,'test');assert.equal(Object.keys(request.questions).length,8);
 assert.deepEqual(request.state,{precedingContext:'Ann arrived. ',target:'She fears Bob. ',followingContext:'Bob left.'});
 const changed={...doc,doc_id:'different',author:'different',book_title:'different',spans:[{annotation_id:'x',type:'fear',text:'fears',start:17,end:22}],relations:[{type:'experiencer',source_annotation_id:'x',target_annotation_id:'x'}]};
 assert.deepEqual(passageRequest(changed,'test'),request);
 assert.throws(()=>passageRequest({...doc,text:'Only one sentence.'},'test'));
});
