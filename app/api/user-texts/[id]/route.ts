import {currentUser} from '../../../../src/server/auth';
import {deleteCustomText,getCustomText,updateCustomText,validCustomText} from '../../../../src/server/custom-text-store';
import {hasAllowedOrigin} from '../../../../src/server/request-origin';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
 const user=await currentUser();if(!user)return Response.json({error:'Sign in to see your texts.'},{status:401});
 try{const text=await getCustomText(user.id,(await params).id);return text?Response.json({text},{headers:{'Cache-Control':'no-store'}}):Response.json({error:'Text not found.'},{status:404});}
 catch{return Response.json({error:'Saved texts are unavailable.'},{status:503});}
}
export async function PATCH(request:Request,{params}:Context){
 if(!hasAllowedOrigin(request))return Response.json({error:'Origin not allowed.'},{status:403});
 const user=await currentUser();if(!user)return Response.json({error:'Sign in to save your text.'},{status:401});
 let body;try{const raw=await request.text();if(raw.length>25_000)return Response.json({error:'Text is too long.'},{status:413});body=JSON.parse(raw);}catch{return Response.json({error:'Invalid text.'},{status:400});}
 if(!validCustomText(body?.title,body?.body)||!Number.isInteger(body?.revision)||body.revision<1)return Response.json({error:'Invalid text update.'},{status:400});
 try{
  const id=(await params).id,updated=await updateCustomText(user.id,id,body.revision,body.title,body.body);
  if(updated)return Response.json({text:updated},{headers:{'Cache-Control':'no-store'}});
  const existing=await getCustomText(user.id,id);
  return Response.json({error:existing?'This text changed in another tab. Your edits are still here.':'Text not found.'},{status:existing?409:404});
 }catch{return Response.json({error:'Could not save your text. Try again.'},{status:503});}
}
export async function DELETE(request:Request,{params}:Context){
 if(!hasAllowedOrigin(request))return Response.json({error:'Origin not allowed.'},{status:403});
 const user=await currentUser();if(!user)return Response.json({error:'Sign in to delete your text.'},{status:401});
 try{return await deleteCustomText(user.id,(await params).id)?new Response(null,{status:204}):Response.json({error:'Text not found.'},{status:404});}
 catch{return Response.json({error:'Could not delete your text.'},{status:503});}
}
