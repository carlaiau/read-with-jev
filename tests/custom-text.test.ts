import test from 'node:test';
import assert from 'node:assert/strict';
import {customSentences,customTextLimit,guestCallLimit,savedTextReturnPath} from '../src/lib/custom-text';
import {customEmotionKey,validCustomSentenceRequest} from '../src/server/custom-text-emotions';
import {getCustomText,updateCustomText,deleteCustomText,reserveGuestCall,customTextSchema} from '../src/server/custom-text-store';
import {guestIdentity,signGuestId,verifyGuestId} from '../src/server/guest-identity';
import type {neon} from '@neondatabase/serverless';

test('custom sentences preserve source offsets and invalidate only changed targets and neighbors',()=>{
 const before=customSentences('Mr. Darcy waited. She smiled. Then he left.');
 const after=customSentences('Mr. Darcy waited. She frowned. Then he left.');
 assert.equal(before.map(s=>s.target).join(''),'Mr. Darcy waited. She smiled. Then he left.');
 for(const s of before)assert.equal('Mr. Darcy waited. She smiled. Then he left.'.slice(s.start,s.end),s.target);
 assert.equal(before.length,3);
 assert.notEqual(before[0].key,after[0].key);
 assert.notEqual(before[1].key,after[1].key);
 assert.notEqual(before[2].key,after[2].key);
 const long=customSentences('First. Second. Third. Fourth. Fifth.');
 const edited=customSentences('First. Second. Changed. Fourth. Fifth.');
 assert.equal(long[0].key,edited[0].key);
 assert.equal(long[4].key,edited[4].key);
 assert.notEqual(long[2].key,edited[2].key);
});
test('account return paths accept only saved-text permalinks',()=>{
 const path='/your-text/c96138b2-8a24-49a1-a977-bde70401262e';
 assert.equal(savedTextReturnPath(path),path);
 for(const candidate of ['/your-text','/your-text/not-an-id','//evil.test','https://evil.test',`${path}?next=evil`,`${path}/extra`])assert.equal(savedTextReturnPath(candidate),null);
});
test('custom JEV key includes context, model task, and no gold labels',()=>{
 const sentence={target:'She smiled.',precedingContext:'He entered.',followingContext:'The room was quiet.'};
 assert(validCustomSentenceRequest(sentence));
 assert.match(customEmotionKey(sentence),/^[a-f0-9]{64}$/);
 assert.notEqual(customEmotionKey(sentence),customEmotionKey({...sentence,precedingContext:'He left.'}));
 assert(!validCustomSentenceRequest({...sentence,target:''}));
 assert(!validCustomSentenceRequest({...sentence,target:'x'.repeat(customTextLimit+1)}));
 assert(!validCustomSentenceRequest({target:'x'.repeat(10_000),precedingContext:'y'.repeat(10_001),followingContext:''}));
 assert(!validCustomSentenceRequest({...sentence,gold:true,target:42}));
});
test('guest identity cookie is signed and tampering cannot reset the same identity',()=>{
 const secret='A-sufficiently-long-guest-cookie-secret-for-tests';
 const id='c96138b2-8a24-49a1-a977-bde70401262e',signed=signGuestId(id,secret);
 assert.equal(verifyGuestId(signed,secret),id);
 assert.equal(verifyGuestId(`${id}.${'0'.repeat(64)}`,secret),undefined);
 assert.equal(verifyGuestId(signed,'another-sufficiently-long-secret-for-tests'),undefined);
 const request=new Request('https://example.test/api/custom-emotions',{headers:{cookie:`jev_guest=${signed}`}});
 const original=process.env.GUEST_COOKIE_SECRET;process.env.GUEST_COOKIE_SECRET=secret;
 try{assert.deepEqual(guestIdentity(request),{id});}
 finally{if(original===undefined)delete process.env.GUEST_COOKIE_SECRET;else process.env.GUEST_COOKIE_SECRET=original;}
});
test('saved-text queries always constrain the owner and revisions; guest admission is atomic SQL',async()=>{
 const calls:{query:string;values:unknown[]}[]=[];
 const fake=((parts:TemplateStringsArray,...values:unknown[])=>{calls.push({query:parts.join('?'),values});return Promise.resolve([]);}) as unknown as ReturnType<typeof neon>;
 await getCustomText('alice','text-id',fake);
 await updateCustomText('alice','text-id',2,'Title','Body',fake);
 await deleteCustomText('alice','text-id',fake);
 assert.equal(calls.length,3);
 for(const call of calls){assert.match(call.query,/owner_id=\?/);assert(call.values.includes('alice'));assert(call.values.includes('text-id'));}
 assert.match(calls[1].query,/revision=\?/);assert(calls[1].values.includes(2));
 assert.equal(await reserveGuestCall('visitor-id',fake),null);
 assert.match(calls[3].query,/ON CONFLICT.*WHERE guest_jev_usage\.used<\?/);
 assert(calls[3].values.includes(guestCallLimit));
 assert(customTextSchema.every(s=>s.includes('IF NOT EXISTS')));
 assert(customTextSchema.some(s=>s.includes('ON DELETE CASCADE')));
});
