import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTop100, sourceMetadata } from '../src/lib/gutenberg-top';
import { validateCastMetadata } from '../src/lib/cast-registry';
import { digest } from '../src/lib/io';
import { selectEnglishEntries,selectNovelEntries } from '../src/lib/library-selection';
test('selection caps English editions after filtering and preserves ranking order', () => {
  const entries = [
    { id: 1, status: 'downloaded', language: 'English' },
    { id: 2, status: 'excluded-language', language: 'French' },
    { id: 3, status: 'failed', language: 'English' },
    { id: 4, status: 'downloaded', language: 'English' },
    { id: 5, status: 'downloaded', language: 'English' },
  ];
  assert.deepEqual(selectEnglishEntries(entries, 2).map(entry => entry.id), [1, 4]);
  assert.throws(() => selectEnglishEntries(entries, 0), /Invalid/);
  assert.equal(selectEnglishEntries(Array.from({length: 97}, (_,id) => ({id, status:'downloaded', language:'English'}))).length, 50);
});
test('top list uses the 30-day section and preserves separate editions', () => {
  const rows = Array.from({length:100}, (_,i)=>`<li><a href="/ebooks/${i+1}">Same title (${100-i})</a></li>`).join('');
  const html = `<h2 id="books-last1">Yesterday</h2><ol><a href="/ebooks/999">Wrong (1)</a></ol><h2 id="books-last30">30 days</h2><ol>${rows}</ol>`;
  const result = parseTop100(html); assert.equal(result[0].gutenbergId,1); assert.equal(result[99].rank,100);
  assert.throws(()=>parseTop100(html.replace('/ebooks/100','/ebooks/1')),/Duplicate/);
});
test('metadata distinguishes Gutenberg release date from publication year', () => {
  assert.deepEqual(sourceMetadata('Title: A Book\nAuthor: A Writer\nLanguage: French\nRelease date: June 1, 2000\n\n*** START OF'),{title:'A Book',author:'A Writer',language:'French',releaseDate:'June 1, 2000'});
});
test('cast validation rejects unsupported aliases and wrong editions', () => {
  const text='Alice met the Queen.';
  const value={schema:1,gutenbergId:11,sourceSha256:digest(text),status:'extracted',method:{provider:'test',model:'fixture',promptVersion:'1'},characters:[{id:'alice',name:'Alice',description:'Protagonist',scope:'book',aliases:[{text:'Alice',evidence:[0,5]}]}]};
  assert.equal(validateCastMetadata(value,11,text).characters.length,1);
  assert.throws(()=>validateCastMetadata(value,12,text));
  assert.throws(()=>validateCastMetadata({...value,characters:[{...value.characters[0],aliases:[{text:'Alicia',evidence:[0,5]}]}]},11,text),/exact source evidence/);
});

test('automatic reading sections partition prose without claiming chapter boundaries', async () => {
  const { automaticSections } = await import('../src/lib/library-prepare');
  const text=('A paragraph about Alice. '.repeat(200)+'\n\n').repeat(10);
  const sections=automaticSections(text);
  assert.equal(sections[0].start,0);assert(sections.length>1);
  assert(sections.every(s=>s.title.startsWith('Reading section ')));
});

test('cast chunks cover the whole body and reject unsupported aliases', async () => {
  const { sourceChunks, makeRegistry } = await import('../src/server/openai-cast');
  const raw='*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nAlice met Bob.\n\nAlice left.\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***';
  const chunks=sourceChunks(raw,20);
  assert.equal(chunks.map(c=>c.text).join(''),'Alice met Bob.\n\nAlice left.\n');
  for(let i=1;i<chunks.length;i++)assert.equal(chunks[i].start,chunks[i-1].end);
  const {registry,rejected}=makeRegistry(1,raw,[{name:'Alice',description:'Person',scope:'book',aliases:['Alice','Alicia']}],'fixture');
  assert.equal(registry.characters.length,1);assert.equal(registry.characters[0].aliases[0].text,'Alice');assert.equal(rejected.length,1);
});

test('saved ranking and English-only import agree by Gutenberg identity', async () => {
  const { readJson }=await import('../src/lib/io');
  const snapshot=await readJson<any>('library/top100.json');
  const manifest=await readJson<any>('library/top100-import.json');
  assert.equal(snapshot.books.length,100);assert.equal(manifest.entries.length,100);
  assert.deepEqual(manifest.entries.map((e:any)=>e.gutenbergId),snapshot.books.map((b:any)=>b.gutenbergId));
  for(const entry of manifest.entries){
    if(entry.status==='downloaded')assert.equal(entry.language,'English');
    else assert.equal(entry.status,'excluded-language');
  }
});

test('failed, refused and incomplete model responses never become an empty cast', async () => {
  const { parseCastResponse }=await import('../src/server/openai-cast');
  assert.throws(()=>parseCastResponse({model:'test',status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}),/incomplete/);
  assert.throws(()=>parseCastResponse({model:'test',status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}),/refused/);
  assert.throws(()=>parseCastResponse({model:'test',status:'completed',output:[]}),/JSON/);
  const parsed=parseCastResponse({model:'test',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"characters":[]}'}]}]});
  assert.deepEqual(parsed.characters,[]);
});

test('identity map keeps every record and supports transitive duplicates without losing aliases', async () => {
  const { applyIdentityMap }=await import('../src/server/openai-cast');
  const records=['Alice','Miss Alice','A.','Bob'].map(name=>({name,description:'Person',scope:'book',aliases:[name]}));
  const cast=applyIdentityMap(records,{'record-0':1,'record-1':2,'record-2':0,'record-3':3});
  assert.equal(cast.length,2);assert.deepEqual(new Set(cast[0].aliases),new Set(['Alice','Miss Alice','A.']));
  assert.throws(()=>applyIdentityMap(records,{'record-0':0}),/Incomplete/);
  assert.throws(()=>applyIdentityMap(records,{'record-0':99,'record-1':1,'record-2':2,'record-3':3}),/Invalid/);
});

test('novel selection retains long novels and fictional memoirs but rejects collections and unknown works',()=>{
 const entries=[100,1184,1260,31100,71046,999999].map(gutenbergId=>({gutenbergId,status:'downloaded',language:'English'}));
 assert.deepEqual(selectNovelEntries(entries).map(e=>e.gutenbergId),[1184,1260]);
});
