import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

export const guestCookieName='jev_guest';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function secret():string|undefined{return process.env.GUEST_COOKIE_SECRET??process.env.NEON_AUTH_COOKIE_SECRET??(process.env.NODE_ENV==='production'?undefined:'read-with-jev-local-development-secret');}
export function signGuestId(id:string,key:string):string{return `${id}.${createHmac('sha256',key).update(id).digest('hex')}`;}
export function verifyGuestId(value:string|undefined,key:string):string|undefined{
 if(!value)return;const [id,signature]=value.split('.');if(!uuid.test(id??'')||!/^[a-f0-9]{64}$/.test(signature??''))return;
 const expected=Buffer.from(signGuestId(id,key).split('.')[1],'hex'),actual=Buffer.from(signature,'hex');
 return timingSafeEqual(expected,actual)?id:undefined;
}
export function guestIdentity(request:Request):{id:string;setCookie?:string}|null{
 const key=secret();if(!key||key.length<32)return null;
 const cookies=request.headers.get('cookie')??'';
 const value=cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${guestCookieName}=`))?.slice(guestCookieName.length+1);
 const existing=verifyGuestId(value,key);if(existing)return {id:existing};
 const id=randomUUID(),signed=signGuestId(id,key);
 return {id,setCookie:`${guestCookieName}=${signed}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`};
}
