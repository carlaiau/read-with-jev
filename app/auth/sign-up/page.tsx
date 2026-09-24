import AuthForm from '../auth-form';
import {savedTextReturnPath} from '../../../src/lib/custom-text';
export default async function Page({searchParams}:{searchParams:Promise<{next?:string}>}){const {next}=await searchParams;return <AuthForm mode="up" next={savedTextReturnPath(next)}/>;}
