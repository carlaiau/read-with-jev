import test from 'node:test';
import assert from 'node:assert/strict';
import {featureNames,fitLinear,linearScore} from '../src/lib/affect-linear';
test('linear fitting learns a separable feature and rejects invalid labels',()=>{
 const x=(n:number)=>featureNames.map((_,i)=>i===0?1:i===1?n:0);
 const rows=[{x:x(0),y:0},{x:x(1),y:1}];const weights=fitLinear(rows,.001);
 assert(linearScore(weights,x(0))<.2);assert(linearScore(weights,x(1))>.8);
 assert.throws(()=>fitLinear([{x:x(0),y:2}],.01));
});
