import {notFound} from 'next/navigation';
import {currentUser} from '../../../src/server/auth';
import {getCustomText} from '../../../src/server/custom-text-store';
import YourTextReader from '../your-text-reader';

export const dynamic='force-dynamic';

export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const user=await currentUser();
 if(user&&!await getCustomText(user.id,id))notFound();
 return <YourTextReader user={user?{id:user.id,name:user.name}:null} jevAvailable={!!process.env.TYPESAFE_API_KEY} requestedId={id}/>;
}
