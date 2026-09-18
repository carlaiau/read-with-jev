import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeRequest,validateJudgment,parseJudgeResponse} from '../src/server/affect-judge';
const item={id:'case',precedingContext:'He smiled.',target:'She was afraid.',followingContext:'They left.',emotion:'fear'};
const yes={emotionAssociated:'yes',currentlyExperienced:'yes',experienceStatus:'asserted',evidenceQuote:'afraid',explanation:'The target explicitly states fear.'};
test('judge serializes only blinded text and category, ignoring extra analyst fields',()=>{
 const extra={...item,score:.9,gold:true,hasCharacters:false,judgment:yes};
 assert.deepEqual(judgeRequest(extra,'Review.'),judgeRequest(item,'Review.'));
 const r=judgeRequest(item,'Review.');assert.equal(r.store,false);assert.equal(r.model,'gpt-5.6-sol');assert.equal(r.text.format.strict,true);
});
test('judge rejects non-target evidence, inconsistent verdicts and incomplete responses',()=>{
 assert.deepEqual(validateJudgment(yes,item),yes);
 assert.throws(()=>validateJudgment({...yes,evidenceQuote:'He smiled.'},item));
 assert.throws(()=>validateJudgment({...yes,evidenceQuote:null},item));
 assert.throws(()=>validateJudgment({...yes,emotionAssociated:'no'},item));
 assert.throws(()=>parseJudgeResponse({status:'incomplete'},item));
 assert.throws(()=>parseJudgeResponse({status:'completed',model:'gpt-5.6-sol',output:[{type:'message',content:[{type:'refusal'}]}]},item));
});
