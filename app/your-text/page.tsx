import {currentUser} from '../../src/server/auth';
import YourTextReader from './your-text-reader';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await currentUser();
 return <YourTextReader user={user?{id:user.id,name:user.name}:null} jevAvailable={!!process.env.TYPESAFE_API_KEY}/>;
}
