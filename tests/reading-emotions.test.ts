import test from 'node:test';
import assert from 'node:assert/strict';
import {readingPlans,validEmotionScores,readingEmotions,readingThreshold,emotionalityScale,emotionalityForThreshold,emotionalityLabel,thresholdForEmotionality} from '../src/lib/reading-emotions';
import {readerSegments} from '../src/lib/reader-text';
import {readingRequest} from '../src/server/reading-emotions';
import type {Book} from '../src/lib/model';
const text='CHAPTER I. Ann is _afraid_ . She waits .\n\nBob is happy .\n\nNew chapter .';
const split=text.indexOf('Bob'),last=text.indexOf('New');
const book:Book={schema:1,id:'mentions',title:'Fixture',layer:'mentions',source:'test',text,characters:[],evidence:[],provenance:{},passages:[{id:'one',chapter:1,start:0,end:split,contextStart:0,contextEnd:split,split:'dev',labels:[]},{id:'two',chapter:1,start:split,end:last,contextStart:split,contextEnd:last,split:'dev',labels:[]},{id:'three',chapter:2,start:last,end:text.length,contextStart:last,contextEnd:text.length,split:'test',labels:[]}]};
test('reader plans preserve displayed text, emphasis and sentence ranges without crossing chapters',()=>{
 const plans=readingPlans(book);
 for(const [i,p] of plans.entries()){
  assert.equal(p.text,readerSegments(text.slice(book.passages[i].start,book.passages[i].end),true).map(s=>s.text).join(''));
  assert.equal(p.sentences.map(s=>s.target).join(''),p.text);
  for(const s of p.sentences)assert.equal(p.text.slice(s.start,s.end),s.target);
 }
 assert.equal(plans[0].text.slice(plans[0].emphasis[0].start,plans[0].emphasis[0].end),'afraid');
 assert.equal(plans[0].sentences.at(-1)?.followingContext,plans[1].sentences[0].target);
 assert.equal(plans[1].sentences.at(-1)?.followingContext,'');assert.equal(plans[2].sentences[0].precedingContext,'');
});
test('reader scores require all eight probabilities and requests omit annotation inventory',()=>{
 const s=readingPlans(book)[0].sentences[0],request=readingRequest(s);
 assert.equal(Object.keys(request.questions).length,8);assert.deepEqual(Object.keys(request.state).sort(),['followingContext','precedingContext','target']);
 const valid=Object.fromEntries(readingEmotions.map(e=>[e,.5]));assert(validEmotionScores(valid));assert(!validEmotionScores({...valid,fear:NaN}));assert(!validEmotionScores({fear:.5}));assert(!validEmotionScores({...valid,extra:0}));
});

test('library display plans respect explicit plain and tokenized text formats',()=>{
 for(const textFormat of ['plain','tokenized'] as const){
  const plans=readingPlans({...book,id:'speaking',textFormat});
  assert.equal(plans[0].text,readerSegments(book.text.slice(0,split),textFormat==='tokenized').map(s=>s.text).join(''));
 }
});

test('library section headings stay outside sentence plans without modifying source offsets',()=>{
 const fixture={...book,textFormat:'plain' as const,sections:[{index:1,title:'CHAPTER I. Ann is _afraid_ . She waits .'}]};
 const before=JSON.stringify(fixture);const plans=readingPlans(fixture);
 assert.equal(plans[0].text,'');assert.equal(JSON.stringify(fixture),before);
 assert(!plans.flatMap(p=>p.sentences).some(s=>s.target.includes('CHAPTER I.')));
});

test('the emotionality dial round-trips the frozen default and only lowers the threshold as it rises',()=>{
 assert.equal(thresholdForEmotionality(emotionalityForThreshold(readingThreshold)),readingThreshold);
 assert.equal(emotionalityForThreshold(readingThreshold)%emotionalityScale.step,0);
 assert.equal(thresholdForEmotionality(0),emotionalityScale.strictest);
 assert.equal(thresholdForEmotionality(100),emotionalityScale.loosest);
 for(let value=emotionalityScale.step;value<=100;value+=emotionalityScale.step)assert(thresholdForEmotionality(value)<thresholdForEmotionality(value-emotionalityScale.step));
 // Out-of-range input must never widen the displayed threshold beyond the published scale.
 assert.equal(thresholdForEmotionality(-40),emotionalityScale.strictest);assert.equal(thresholdForEmotionality(500),emotionalityScale.loosest);
 assert.equal(emotionalityForThreshold(0),100);assert.equal(emotionalityForThreshold(1),0);
 assert.equal(emotionalityForThreshold(readingThreshold),50,'The published default sits at the midpoint of the dial');
 assert.equal(emotionalityLabel(emotionalityForThreshold(readingThreshold)),'Somewhat');
 assert.equal(emotionalityLabel(0),'Not at all');assert.equal(emotionalityLabel(100),'Extremely');
});
