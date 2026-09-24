import AuthForm from '../auth-form';
export default async function Page({searchParams}:{searchParams:Promise<{created?:string}>}){const {created}=await searchParams;return <AuthForm mode="in" created={created==='1'}/>;}
