import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readerSentenceRanges} from '../src/lib/reader-sentences';
import {readingPlans} from '../src/lib/reading-emotions';
function sentences(text:string){
 const ranges=readerSentenceRanges(text);
 assert.equal(ranges.map(r=>text.slice(r.start,r.end)).join(''),text);
 for(let i=1;i<ranges.length;i++)assert.equal(ranges[i].start,ranges[i-1].end);
 return ranges.map(r=>text.slice(r.start,r.end).trim());
}
test('hard wraps and honorifics do not fragment the user-reported sentence',()=>{
 const text='He was so much\ndelighted with it that he agreed with Mr. Morris\nimmediately; he would take the house. She smiled.';
 assert.deepEqual(sentences(text),['He was so much\ndelighted with it that he agreed with Mr. Morris\nimmediately; he would take the house.','She smiled.']);
});
test('preserves true sentences, blank-line dialogue boundaries, CRLF and Unicode offsets',()=>{
 const text='“😀 Dr. Smith is here!”\r\n\r\n“No,” said Mrs. Jones. She\r\nleft.\r\n\r\nBingley\r\n\r\nAnother speaker';
 assert.deepEqual(sentences(text),['“😀 Dr. Smith is here!”','“No,” said Mrs. Jones.','She\r\nleft.','Bingley','Another speaker']);
 assert.deepEqual(sentences('It cost 3.14 pounds. Really? Yes!'),['It cost 3.14 pounds.','Really?','Yes!']);
 assert.deepEqual(sentences('Ask Mr. Darcy or J. R. Smith. Then ask Dr. Watson.'),['Ask Mr. Darcy or J. R. Smith.','Then ask Dr. Watson.']);
 assert.deepEqual(sentences(''),[]);
});
test('real Pride and Prejudice delight highlight includes the complete sentence and Mr. Morris',async()=>{
 const book=JSON.parse(await readFile('data/library/pride-and-prejudice.json','utf8'));
 const plans=readingPlans(book),target=plans.flatMap(p=>p.sentences).find(s=>s.target.includes('delighted with it'))!;
 assert(target);assert.match(target.target,/Mr\.\s+Morris/);assert.match(target.target,/end of next week/);assert.match(target.target,/Mrs\.\s+Long/);
 for(const plan of plans){assert.equal(plan.sentences.map(s=>s.target).join(''),plan.text);for(const s of plan.sentences)assert.equal(plan.text.slice(s.start,s.end),s.target);}
});
