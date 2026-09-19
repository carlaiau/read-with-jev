import test from 'node:test';
import assert from 'node:assert/strict';
import {storedScores,storeScores,acquireModelSlot,releaseModelSlot,maxConcurrentModelCalls,emotionStoreSchema,
 type StoreClient} from '../src/server/emotion-store';
import {readingEmotions,type EmotionScores} from '../src/lib/reading-emotions';

const scores=Object.fromEntries(readingEmotions.map(e=>[e,.5])) as EmotionScores;
// A template-tag stand-in for the Neon client; the store only ever tags or throws.
const stub=(rows:unknown[]|Error)=>{
 const calls:unknown[][]=[];
 const sql=((_s:TemplateStringsArray,...params:unknown[])=>{
  calls.push(params);
  return rows instanceof Error?Promise.reject(rows):Promise.resolve(rows);
 }) as unknown as StoreClient;
 return {sql,calls};
};

test('a stored row is served only when it is a complete eight-emotion score',async()=>{
 assert.deepEqual(await storedScores('k',stub([{scores}]).sql),scores);
 assert.equal(await storedScores('k',stub([]).sql),undefined);
 assert.equal(await storedScores('k',stub([{scores:{fear:.9}}]).sql),undefined,'A partial row must not answer');
 assert.equal(await storedScores('k',stub([{scores:{...scores,fear:2}}]).sql),undefined,'Out-of-range scores must not answer');
 assert.equal(await storedScores('k',stub([{scores:null}]).sql),undefined);
});

test('an unreachable shared cache degrades to a miss rather than an error',async()=>{
 assert.equal(await storedScores('k',stub(new Error('network')).sql),undefined);
 assert.equal(await storeScores({cacheKey:'k',layer:'document:x',sentenceId:'s',sourceKey:'v',model:'m',scores},
  stub(new Error('network')).sql),false);
});

test('writes carry the digest, edition and model so a prompt change misses instead of serving stale scores',async()=>{
 const {sql,calls}=stub([]);
 assert.equal(await storeScores({cacheKey:'key1',layer:'document:x',sentenceId:'p:0',sourceKey:'src',model:'jev-1.13.0',scores},sql),true);
 assert.deepEqual(calls[0].slice(0,5),['key1','document:x','p:0','src','jev-1.13.0']);
 assert.equal(calls[0][5],JSON.stringify(scores));
});

test('without a configured store every operation is a no-op, so local reading still works',async()=>{
 assert.equal(await storedScores('k',null),undefined);
 assert.equal(await storeScores({cacheKey:'k',layer:'l',sentenceId:'s',sourceKey:'v',model:'m',scores},null),false);
 assert.equal(await acquireModelSlot(null),undefined,'No store means the per-process limit is the only one');
 await releaseModelSlot('missing',null);
});

test('a model slot is granted below the global ceiling and refused at it',async()=>{
 const below=stub([{id:'ignored',active:3}]);
 const granted=await acquireModelSlot(below.sql,12);
 assert.match(String(granted),/^[0-9a-f-]{36}$/,'The caller gets the lease id it inserted');
 assert.equal(below.calls[0][0],granted,'The row written is the lease handed back');
 // The count comes from the statement snapshot and excludes this row, so active === limit is full.
 assert.equal(await acquireModelSlot(stub([{id:'x',active:12}]).sql,12),'busy');
 assert.equal(await acquireModelSlot(stub([{id:'x',active:11}]).sql,12).then(v=>typeof v),'string');
 // A refused acquire releases the row it speculatively inserted.
 const full=stub([{id:'x',active:12}]);
 await acquireModelSlot(full.sql,12);
 assert.equal(full.calls.length,2,'insert then delete');
 assert.equal(full.calls[1][0],full.calls[0][0],'the same lease id is removed');
});

test('an unreachable store drops back to the per-process limit instead of blocking analysis',async()=>{
 assert.equal(await acquireModelSlot(stub(new Error('network')).sql,12),undefined);
 await releaseModelSlot('lease-1',stub(new Error('network')).sql); // must not throw
});

test('the global concurrency ceiling falls back to a sane default',()=>{
 assert.equal(maxConcurrentModelCalls(undefined),12);
 assert.equal(maxConcurrentModelCalls('30'),30);
 for(const bad of ['0','-5','abc','1.5',''])assert.equal(maxConcurrentModelCalls(bad),12,`${bad} must fall back`);
});

test('schema statements are idempotent so a deploy can run them every time',()=>{
 assert(emotionStoreSchema.length>=3);
 for(const statement of emotionStoreSchema)assert.match(statement,/IF NOT EXISTS/);
 assert(emotionStoreSchema.some(s=>/PRIMARY KEY/.test(s)));
});
