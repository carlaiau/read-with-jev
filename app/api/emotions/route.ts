import {hasAllowedOrigin} from '../../../src/server/request-origin';
import {readingData,readingScores,ReadingError} from '../../../src/server/reading-emotions';
export const runtime='nodejs';
export const maxDuration=90;
export async function GET(request:Request){
 const layer=new URL(request.url).searchParams.get('layer');
 if(layer!=='mentions'&&layer!=='speaking')return Response.json({error:'Unknown edition.'},{status:400});
 try{return Response.json({...await readingData(layer),jevAvailable:!!process.env.TYPESAFE_API_KEY},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Emotion vocabulary is unavailable. Prepare the affect data on the server.'},{status:503});}
}
export async function POST(request:Request){
 if(!hasAllowedOrigin(request))return Response.json({error:'Origin not allowed.'},{status:403});
 let body;try{const raw=await request.text();if(raw.length>2048)return Response.json({error:'Request too large.'},{status:413});body=JSON.parse(raw);}catch{return Response.json({error:'Invalid request.'},{status:400});}
 if(!body||!['mentions','speaking'].includes(body.layer)||typeof body.sourceKey!=='string'||typeof body.sentenceId!=='string')return Response.json({error:'Invalid sentence request.'},{status:400});
 try{
  const data=await readingData(body.layer);if(body.sourceKey!==data.sourceKey)return Response.json({error:'This edition changed. Reload the reader.'},{status:409});
  const sentence=data.plans.flatMap(p=>p.sentences).find(s=>s.id===body.sentenceId);
  if(!sentence)return Response.json({error:'Unknown sentence.'},{status:400});
  if(request.signal.aborted)return new Response(null,{status:499});
  return Response.json({sentenceId:sentence.id,scores:await readingScores(data.sourceKey,sentence)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof ReadingError?e.message:'JEV could not analyse this sentence. Retry when ready.'},{status:e instanceof ReadingError?e.status:502});}
}
