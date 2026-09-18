import { selectNovelEntries,isReaderDocument } from '../src/lib/library-selection';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readJson, writeJson } from '../src/lib/io';
import { validateCastMetadata } from '../src/lib/cast-registry';
import type { DocumentSpec } from '../src/lib/library-model';
const readyOnly=process.argv.includes('--ready-only');
const pending:number[]=[];
const manifest=await readJson<any>('library/top100-import.json');
const curated=(await readJson<DocumentSpec[]>('library/documents.json')).filter(isReaderDocument);
const specs:DocumentSpec[]=[];
const locks=await readJson<Record<string,{url:string;sha256:string}>>('library/sources.lock.json');
const selected=selectNovelEntries<any>(manifest.entries);
for(const entry of selected){
  const raw=await readFile(`data/library-sources/${entry.gutenbergId}.txt`,'utf8');
  let cast;
  try { cast=validateCastMetadata(await readJson(`library/casts/${entry.gutenbergId}.json`),entry.gutenbergId,raw); }
  catch(e){if(readyOnly && (e as NodeJS.ErrnoException).code==='ENOENT'){pending.push(entry.gutenbergId);continue;}throw e;}
  assert.equal(cast.sourceSha256,entry.sourceSha256,'Import source changed');
  entry.castStatus=cast.status; entry.characters=cast.characters.length; entry.castSource=`library/casts/${entry.gutenbergId}.json`;
  // Curated editions retain their verified section boundaries and cast identities.
  if(curated.some(s=>s.gutenbergId===entry.gutenbergId))continue;
  const id=`gutenberg-${entry.gutenbergId}`;
  specs.push({id,gutenbergId:entry.gutenbergId,title:entry.title ?? entry.listing,author:entry.author ?? 'Unknown author',year:null,
    sourceUrl:entry.sourceUrl,sourcePage:`https://www.gutenberg.org/ebooks/${entry.gutenbergId}`,format:'gutenberg-text',segmentation:'automatic',
    characters:cast.characters.map(c=>({id:c.id,name:c.scope==='book'?c.name:`${c.name} · ${c.scope}`,aliases:c.aliases.map(a=>a.text),description:c.description,scope:c.scope})),
    castSource:`library/casts/${entry.gutenbergId}.json`,
    registryNote:`Machine-extracted cast (${cast.method.model}), with aliases verified to occur in this edition. Not human-reviewed or exhaustive. Shared aliases are ambiguous; generic titles can produce false matches. Reading sections are automatic, not verified chapters.`});
  locks[id]={url:entry.sourceUrl,sha256:entry.sourceSha256};
}
assert.equal(manifest.entries.length,100,'Incomplete top-list import');
assert(!manifest.entries.some((e:any)=>e.status==='failed'),'Failed source import');
manifest.publication={complete:pending.length===0,english:selected.length,selected:selected.map(e=>e.gutenbergId),ready:selected.length-pending.length,pending};
await writeJson('library/top100-import.json',manifest);
await writeJson('library/top100-documents.json',specs);
await writeJson('library/sources.lock.json',locks);
console.log(`${specs.length} new novel editions ready; ${curated.length + specs.length} total reader documents; ${pending.length} novel editions still pending`);
