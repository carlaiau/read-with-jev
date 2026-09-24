'use server';
import {redirect} from 'next/navigation';
import {getAuth} from '../../src/server/auth';
export type AuthState={error:string}|null;
export async function signIn(_state:AuthState,form:FormData):Promise<AuthState>{
 const auth=getAuth();if(!auth)return {error:'Accounts are not configured yet.'};
 const email=String(form.get('email')??'').trim(),password=String(form.get('password')??'');
 if(!email||!password)return {error:'Enter your email and password.'};
 try{const {error}=await auth.signIn.email({email,password});if(error)return {error:error.message||'Sign-in failed. Try again.'};}
 catch{return {error:'Sign-in is unavailable. Try again later.'};}
 redirect('/your-text');
}
export async function signUp(_state:AuthState,form:FormData):Promise<AuthState>{
 const auth=getAuth();if(!auth)return {error:'Accounts are not configured yet.'};
 const name=String(form.get('name')??'').trim(),email=String(form.get('email')??'').trim(),password=String(form.get('password')??'');
 if(!name||!email||password.length<8)return {error:'Enter a name, email, and password of at least eight characters.'};
 try{const {error}=await auth.signUp.email({name,email,password});if(error)return {error:error.message||'Could not create your account.'};}
 catch{return {error:'Account creation is unavailable. Try again later.'};}
 redirect('/auth/sign-in?created=1');
}
export async function signOut(){const auth=getAuth();if(auth)await auth.signOut();redirect('/your-text');}
