'use client';
import {useActionState} from 'react';
import Link from 'next/link';
import {signIn,signUp} from './actions';
export default function AuthForm({mode,created,next}:{mode:'in'|'up';created?:boolean;next?:string|null}){
 const [state,action,pending]=useActionState(mode==='in'?signIn:signUp,null);
 const nextQuery=next?`?next=${encodeURIComponent(next)}`:'';
 return <main className="auth-page"><div className="auth-sheet">
  <Link className="text-sm text-muted underline underline-offset-4" href={next??'/your-text'}>← Back to your text</Link>
  <h1 className="mt-12 font-serif text-4xl tracking-tight">{mode==='in'?'Sign in':'Create an account'}</h1>
  <p className="mt-3 text-sm leading-6 text-muted">{mode==='in'?'Return to your writing and saved texts.':'Save your writing privately and continue reading with JEV.'}</p>
  {created&&<p role="status" className="mt-5 text-sm text-ink">Account created. Sign in to save your text.</p>}
  <form action={action} className="mt-8 space-y-5">
   {next&&<input type="hidden" name="next" value={next}/>}
   {mode==='up'&&<label className="auth-field">Name<input name="name" autoComplete="name" required maxLength={80}/></label>}
   <label className="auth-field">Email<input name="email" type="email" autoComplete="email" required/></label>
   <label className="auth-field">Password<input name="password" type="password" autoComplete={mode==='in'?'current-password':'new-password'} required minLength={mode==='up'?8:undefined}/></label>
   {state?.error&&<p role="alert" className="text-sm text-red-800">{state.error}</p>}
   <button className="auth-submit" type="submit" disabled={pending}>{pending?'Please wait…':mode==='in'?'Sign in':'Create account'}</button>
  </form>
  {mode==='in'&&<p className="mt-4 text-sm"><Link href="/auth/forgot-password">Forgot your password?</Link></p>}
  <p className="mt-8 text-sm text-muted">{mode==='in'?<>New here? <Link href={`/auth/sign-up${nextQuery}`}>Create an account</Link></>:<>Already have an account? <Link href={`/auth/sign-in${nextQuery}`}>Sign in</Link></>}</p>
 </div></main>;
}
