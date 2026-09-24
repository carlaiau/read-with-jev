import {createNeonAuth} from '@neondatabase/auth/next/server';

let instance:ReturnType<typeof createNeonAuth>|null|undefined;
export function getAuth():ReturnType<typeof createNeonAuth>|null{
 if(instance!==undefined)return instance;
 const baseUrl=process.env.NEON_AUTH_BASE_URL,secret=process.env.NEON_AUTH_COOKIE_SECRET;
 instance=baseUrl&&secret&&secret.length>=32?createNeonAuth({baseUrl,cookies:{secret}}):null;
 return instance;
}
export async function currentUser():Promise<{id:string;name:string;email:string}|null>{
 const auth=getAuth();if(!auth)return null;
 try {const {data}=await auth.getSession();return data?.user?{id:data.user.id,name:data.user.name,email:data.user.email}:null;}
 catch{return null;}
}
