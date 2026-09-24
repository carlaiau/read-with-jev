import {currentUser} from '../../../src/server/auth';
import {createCustomText,listCustomTexts,validCustomText} from '../../../src/server/custom-text-store';
import {hasAllowedOrigin} from '../../../src/server/request-origin';
export const runtime='nodejs';
export async function GET(){const user=await currentUser();if(!user)return Response.json({error:'Sign in to see your texts.'},{status:401});try{return Response.json({texts:await listCustomTexts(user.id)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Saved texts are unavailable.'},{status:503});}}
export async function POST(request:Request){
 if(!hasAllowedOrigin(request))return Response.json({error:'Origin not allowed.'},{status:403});
 const user=await currentUser();if(!user)return Response.json({error:'Sign in to save your text.'},{status:401});
 let body;try{const raw=await request.text();if(raw.length>25_000)return Response.json({error:'Text is too long.'},{status:413});body=JSON.parse(raw);}catch{return Response.json({error:'Invalid text.'},{status:400});}
 if(!validCustomText(body?.title,body?.body))return Response.json({error:'Give your text a title and keep it within 20,000 characters.'},{status:400});
 try{return Response.json({text:await createCustomText(user.id,body.title,body.body)},{status:201,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Could not save your text. Try again.'},{status:503});}
}
