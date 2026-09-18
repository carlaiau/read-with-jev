import {LIBRARY_INLINE_LIMIT,LIBRARY_PART_CHARS} from '../../../src/lib/library-transport';
import {hasAllowedOrigin} from '../../../src/server/request-origin';
import {readingData,readingScores,ReadingError,validReadingSource} from '../../../src/server/reading-emotions';
export const runtime='nodejs';
export const maxDuration=90;
export async function GET(request:Request){
 const layer=new URL(request.url).searchParams.get('layer');
 if(!validReadingSource(layer))return Response.json({error:'Unknown edition.'},{status:400});
 try{
  const data=await readingData(layer);
  // Context and reconstructed plan text are server-only; the browser only renders sentence targets.
  const body=JSON.stringify({...data,plans:data.plans.map(p=>({...p,text:'',sentences:p.sentences.map(s=>({...s,precedingContext:'',followingContext:''}))})),jevAvailable:!!process.env.TYPESAFE_API_KEY});
  const url=new URL(request.url),part=url.searchParams.get('part'),headers={'Cache-Control':'no-store'};
  if(part!==null){
   if(!/^(0|[1-9][0-9]*)$/.test(part)||Number(part)>=Math.ceil(body.length/LIBRARY_PART_CHARS))return Response.json({error:'Invalid metadata part.'},{status:400});
   if(url.searchParams.get('revision')!==data.sourceKey)return Response.json({error:'Document changed. Reload the reader.'},{status:409});
   return Response.json(body.slice(Number(part)*LIBRARY_PART_CHARS,(Number(part)+1)*LIBRARY_PART_CHARS),{headers});
  }
  if(Buffer.byteLength(body)>LIBRARY_INLINE_LIMIT)return Response.json({transport:'json-parts',documentId:layer,revision:data.sourceKey,parts:Math.ceil(body.length/LIBRARY_PART_CHARS)},{headers});
  return new Response(body,{headers:{...headers,'Content-Type':'application/json'}});
 }
 catch{return Response.json({error:'Emotion vocabulary is unavailable. Prepare the affect data on the server.'},{status:503});}
}
export async function POST(request:Request){
 if(!hasAllowedOrigin(request))return Response.json({error:'Origin not allowed.'},{status:403});
 let body;try{const raw=await request.text();if(raw.length>2048)return Response.json({error:'Request too large.'},{status:413});body=JSON.parse(raw);}catch{return Response.json({error:'Invalid request.'},{status:400});}
 if(!body||!validReadingSource(body.layer)||typeof body.sourceKey!=='string'||typeof body.sentenceId!=='string')return Response.json({error:'Invalid sentence request.'},{status:400});
 try{
  const data=await readingData(body.layer);if(body.sourceKey!==data.sourceKey)return Response.json({error:'This edition changed. Reload the reader.'},{status:409});
  const sentence=data.plans.flatMap(p=>p.sentences).find(s=>s.id===body.sentenceId);
  if(!sentence)return Response.json({error:'Unknown sentence.'},{status:400});
  if(request.signal.aborted)return new Response(null,{status:499});
  return Response.json({sentenceId:sentence.id,scores:await readingScores(data.sourceKey,sentence)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof ReadingError?e.message:'JEV could not analyse this sentence. Retry when ready.'},{status:e instanceof ReadingError?e.status:502});}
}
