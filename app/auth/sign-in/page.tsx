import AuthForm from '../auth-form';
import {savedTextReturnPath} from '../../../src/lib/custom-text';
export default async function Page({searchParams}:{searchParams:Promise<{created?:string;next?:string}>}){const {created,next}=await searchParams;return <AuthForm mode="in" created={created==='1'} next={savedTextReturnPath(next)}/>;}
