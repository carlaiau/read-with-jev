import {readingData,readingCacheKey,diskScores} from '../src/server/reading-emotions';
import {storedScores} from '../src/server/emotion-store';
const layer='document:animal-farm';
const data=await readingData(layer);
const all=data.plans.flatMap(p=>p.sentences);
// Walk from the end backwards to find a sentence nobody has hit yet.
for(let i=all.length-1;i>=0;i--){
 const s=all[i];
 const key=readingCacheKey(data.sourceKey,s);
 const local=await diskScores(key);
 const shared=await storedScores(key).catch(()=>undefined);
 if(!local&&!shared){
  console.log(JSON.stringify({index:i,total:all.length,sentenceId:s.id,cacheKey:key,sourceKey:data.sourceKey,target:s.target.slice(0,80)}));
  process.exit(0);
 }
}
console.log(JSON.stringify({found:false}));
