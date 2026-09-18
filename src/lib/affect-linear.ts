import {highlightBaseline,targetWindow,highlightEmotions,type HighlightPair} from './affect-highlights';
import type {AffectData,AffectDocument} from './affect';
export const featureNames=['bias',...highlightEmotions,'nrc-passage','nrc-nearest','nrc-preceding','lexical-density','mention-in-target','character-count','pronoun','negation-in-target'];
export function linearFeatures(doc:AffectDocument,pair:HighlightPair,lexicon:AffectData['lexicon']) {
 const target=targetWindow(doc)!;
 const words=target.text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)??[];
 return [1,...highlightEmotions.map(e=>Number(e===pair.emotion.type)),
  ...['nrc-passage','nrc-nearest','nrc-preceding'].map(e=>highlightBaseline(doc,pair,e,lexicon)),
  words.filter(w=>lexicon[w]?.includes(pair.emotion.type)).length/Math.max(1,words.length),
  Number(pair.character.start>=target.start&&pair.character.end<=target.end),
  Math.min(1,doc.spans.filter(s=>s.type==='character').length/5),
  Number(/^(i|me|my|mine|we|us|our|you|your|he|him|his|she|her|hers|they|them|their)$/i.test(pair.character.text)),
  Number(words.some(w=>/^(not|no|never|neither|nor|without)$/.test(w)||w.endsWith("n't")))];
}
export const linearScore=(weights:number[],features:number[])=>1/(1+Math.exp(-weights.reduce((s,w,i)=>s+w*features[i],0)));
export function fitLinear(rows:{x:number[];y:number}[],lambda:number) {
 if(!rows.length||rows.some(r=>r.x.length!==featureNames.length||r.x.some(x=>!Number.isFinite(x))||![0,1].includes(r.y)))throw new Error('Invalid training rows');
 const weights=featureNames.map(()=>0);
 // Fixed deterministic full-batch optimization of mean logistic loss plus L2 penalty.
 for(let step=0;step<1500;step++){
  const grad=weights.map(()=>0);
  for(const r of rows){const error=linearScore(weights,r.x)-r.y;for(let j=0;j<grad.length;j++)grad[j]+=error*r.x[j]/rows.length;}
  for(let j=0;j<weights.length;j++)weights[j]-=.5*(grad[j]+(j?lambda*weights[j]:0));
 }
 return weights;
}
