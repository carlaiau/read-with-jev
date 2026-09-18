import { selectEnglishEntries } from '../src/lib/library-selection';
import { readFile } from 'node:fs/promises';
import { readJson } from '../src/lib/io';
import { validateCastMetadata } from '../src/lib/cast-registry';
import { CAST_MODEL, CAST_PROMPT_VERSION } from '../src/server/openai-cast';
const manifest=await readJson<any>('library/top100-import.json');
const ready:number[]=[], pending:number[]=[],invalid:{id:number;reason:string}[]=[];
let characters=0;
for(const entry of selectEnglishEntries<any>(manifest.entries)){
  try{
    const raw=await readFile(`data/library-sources/${entry.gutenbergId}.txt`,'utf8');
    const cast=validateCastMetadata(await readJson(`library/casts/${entry.gutenbergId}.json`),entry.gutenbergId,raw);
    if(cast.method.model!==CAST_MODEL || cast.method.promptVersion!==CAST_PROMPT_VERSION)throw new Error('Different model/prompt');
    ready.push(entry.gutenbergId);characters+=cast.characters.length;
  }catch(e){
    if((e as NodeJS.ErrnoException).code==='ENOENT')pending.push(entry.gutenbergId);
    else invalid.push({id:entry.gutenbergId,reason:(e as Error).message});
  }
}
console.log(JSON.stringify({model:CAST_MODEL,english:ready.length+pending.length+invalid.length,ready:ready.length,pending:pending.length,invalid,characters,excluded:manifest.entries.filter((e:any)=>e.status==='excluded-language').map((e:any)=>({id:e.gutenbergId,language:e.language}))},null,2));
