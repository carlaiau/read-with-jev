'use client';
import '@neondatabase/auth-ui/css';
import Link from 'next/link';
import {createAuthClient} from '@neondatabase/auth/next';
import {AuthView,NeonAuthUIProvider} from '@neondatabase/auth-ui';
const authClient=createAuthClient();
export default function PasswordFlow({view}:{view:'forgot-password'|'reset-password'}){
 return <main className="auth-page"><div className="auth-sheet"><Link className="text-sm text-muted underline underline-offset-4" href="/auth/sign-in">← Back to sign in</Link><div className="mt-8"><NeonAuthUIProvider authClient={authClient} basePath="/auth" defaultTheme="light"><AuthView pathname={view}/></NeonAuthUIProvider></div></div></main>;
}
