import {currentUser} from '../../../src/server/auth';
import {customEmotionScores,validCustomSentenceRequest} from '../../../src/server/custom-text-emotions';
import {CustomTextStoreError,getCustomText} from '../../../src/server/custom-text-store';
import {guestIdentity} from '../../../src/server/guest-identity';
import {ReadingError} from '../../../src/server/reading-emotions';
import {hasAllowedOrigin} from '../../../src/server/request-origin';
export const runtime='nodejs';
export const maxDuration=90;
export async function GET(request:Request){
 const user=await currentUser();if(user)return Response.json({guest:false,jevAvailable:!!process.env.TYPESAFE_API_KEY},{headers:{'Cache-Control':'no-store'}});
 const identity=guestIdentity(request);if(!identity)return Response.json({error:'Guest analysis is not configured.'},{status:503});
 return Response.json({guest:true,jevAvailable:!!process.env.TYPESAFE_API_KEY},{headers:{'Cache-Control':'no-store',...(identity.setCookie?{'Set-Cookie':identity.setCookie}:{})}});
}
export async function POST(request:Request){
 if(!hasAllowedOrigin(request))return Response.json({error:'Origin not allowed.'},{status:403});
 const size=Number(request.headers.get('content-length'));if(size>150_000)return Response.json({error:'Request too large.'},{status:413});
 let body:unknown;try{const raw=await request.text();if(raw.length>150_000)return Response.json({error:'Request too large.'},{status:413});body=JSON.parse(raw);}catch{return Response.json({error:'Invalid request.'},{status:400});}
 if(!body||typeof body!=='object')return Response.json({error:'Invalid sentence.'},{status:400});
 const input=body as Record<string,unknown>;
 if(!validCustomSentenceRequest(input.sentence))return Response.json({error:'Invalid sentence.'},{status:400});
 const user=await currentUser();let scope:string,guestId:string|undefined,setCookie:string|undefined;
 try{
  if(user){
   if(typeof input.documentId!=='string'||!/^[0-9a-f-]{36}$/i.test(input.documentId)||!await getCustomText(user.id,input.documentId))return Response.json({error:'Text not found.'},{status:404});
   scope=`text:${input.documentId}`;
  }else{
   const identity=guestIdentity(request);if(!identity)return Response.json({error:'Guest analysis is not configured.'},{status:503});
   if(identity.setCookie)return Response.json({error:'Guest session initialized. Retry the sentence.'},{status:428,headers:{'Cache-Control':'no-store','Set-Cookie':identity.setCookie}});
   guestId=identity.id;setCookie=identity.setCookie;scope=`guest:${guestId}`;
  }
  if(request.signal.aborted)return new Response(null,{status:499});
  const result=await customEmotionScores(scope,input.sentence,guestId);
  return Response.json(result,{headers:{'Cache-Control':'no-store',...(setCookie?{'Set-Cookie':setCookie}:{})}});
 }catch(error){
  const status=error instanceof ReadingError?error.status:error instanceof CustomTextStoreError?503:502;
  return Response.json({error:error instanceof ReadingError||error instanceof CustomTextStoreError?error.message:'JEV could not analyse this sentence. Retry when ready.'},{status,headers:{'Cache-Control':'no-store',...(setCookie?{'Set-Cookie':setCookie}:{})}});
 }
}
