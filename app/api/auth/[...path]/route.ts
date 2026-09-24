import {getAuth} from '../../../../src/server/auth';
export const runtime='nodejs';
type Context={params:Promise<{path:string[]}>};
export async function GET(request:Request,context:Context){const auth=getAuth();return auth?auth.handler().GET(request,context):Response.json({error:'Accounts are not configured on this server.'},{status:503});}
export async function POST(request:Request,context:Context){const auth=getAuth();return auth?auth.handler().POST(request,context):Response.json({error:'Accounts are not configured on this server.'},{status:503});}
