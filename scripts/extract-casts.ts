import { selectEnglishEntries } from '../src/lib/library-selection';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readJson, writeJson, digest } from '../src/lib/io';
import { extractCast, CAST_MODEL, CAST_PROMPT_VERSION, pauseCastRequests } from '../src/server/openai-cast';
import { validateCastMetadata } from '../src/lib/cast-registry';
const execute=process.argv.includes('--execute');
const only=process.argv.find(x=>x.startsWith('--book='))?.slice(7);
const concurrency=Number(process.argv.find(x=>x.startsWith('--concurrency='))?.slice(14) ?? 6);
assert(Number.isInteger(concurrency) && concurrency>=1 && concurrency<=16);
const manifest=await readJson<any>('library/top100-import.json');
const books=selectEnglishEntries<any>(manifest.entries).filter((e:any)=>!only || String(e.gutenbergId)===only);
console.log(`${books.length} English editions; model ${CAST_MODEL}; ${execute?'execute':'cache only'}; concurrency ${concurrency}`);
let cursor=0, halted=false;
const failures:{id:number;error:string}[]=[];
await Promise.all(Array.from({length:concurrency},async()=>{
  while(cursor<books.length && !halted){
    const book=books[cursor++],id=book.gutenbergId;
    try{
      const raw=await readFile(`data/library-sources/${id}.txt`,'utf8');assert.equal(digest(raw),book.sourceSha256,'Source checksum mismatch');
      const path=`library/casts/${id}.json`;
      try{
        const cached=validateCastMetadata(await readJson(path),id,raw);
        assert.equal(cached.method.model,CAST_MODEL);assert.equal(cached.method.promptVersion,CAST_PROMPT_VERSION);
        console.log(`${id}: cached cast (${cached.characters.length})`);continue;
      }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
      const result=await extractCast(id,raw,{title:book.title,author:book.author,language:book.language},execute);
      await writeJson(path,result.registry);await writeJson(`library/casts/${id}.audit.json`,result.audit);
      console.log(`${id}: saved ${result.registry.characters.length} characters; ${result.audit.rejected.length} unsupported aliases excluded`);
    }catch(e){
      const message=(e as Error).message;failures.push({id,error:message});console.error(`${id}: FAILED ${message}`);
      if(/credit_balance_exhausted|insufficient_quota|OpenAI 40[13]/.test(message)){halted=true;pauseCastRequests(message);}
    }
  }
}));
await writeJson(`data/runs/cast-extraction${only?`-${only}`:''}.json`,{model:CAST_MODEL,books:books.length,halted,unstarted:books.slice(cursor).map((b:any)=>b.gutenbergId),failures});
if(failures.length)process.exitCode=1;
