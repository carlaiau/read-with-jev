import {readingData,readingCacheKey,diskScores,readingRequest} from '../src/server/reading-emotions';
import {storedScores} from '../src/server/emotion-store';
import {createClient,validateAnswers} from '../src/server/jev';

const layer='document:siddhartha';
const data=await readingData(layer);
const all=data.plans.flatMap(p=>p.sentences);
let target;
for(let i=all.length-1;i>=0;i--){
 const s=all[i];
 const key=readingCacheKey(data.sourceKey,s);
 const local=await diskScores(key);
 const shared=await storedScores(key).catch(()=>undefined);
 if(!local&&!shared){target=s;break;}
}
if(!target)throw new Error('no uncached sentence found');

const request=readingRequest(target);
const client=createClient();
const started=performance.now();
const response=await client.systemOne(request);
const elapsedMs=performance.now()-started;
validateAnswers(response,Object.keys(request.questions));

console.log(JSON.stringify({
 sentenceId:target.id,
 elapsedMs:Math.round(elapsedMs),
 model:response.model,
 usage:response.usage,
},null,2));
