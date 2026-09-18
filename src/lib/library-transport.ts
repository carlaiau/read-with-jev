// Oversized books travel as revision-pinned JSON text pieces, not one function response.
export const LIBRARY_INLINE_LIMIT = 4_500_000;
export const LIBRARY_PART_CHARS = 500_000;
export type DocumentParts = { transport:'json-parts'; documentId:string; revision:string; parts:number };
export async function loadLibraryDocument<T>(url:string, signal:AbortSignal):Promise<T> {
  const get=async(path:string)=>{
    const response=await fetch(path,{signal});const data=await response.json();
    if(!response.ok)throw new Error(data.error ?? 'Document could not be loaded');return data;
  };
  const data=await get(url);
  if(data.transport!=='json-parts')return data as T;
  const manifest=data as DocumentParts;
  if(!Number.isInteger(manifest.parts)||manifest.parts<1||manifest.parts>100)throw new Error('Invalid document transport');
  const pieces:string[]=[];
  // Four requests at a time; this also keeps peak JSON-decoding memory bounded.
  for(let offset=0;offset<manifest.parts;offset+=4){
    const batch=await Promise.all(Array.from({length:Math.min(4,manifest.parts-offset)},(_,i)=>get(`${url}&part=${offset+i}&revision=${encodeURIComponent(manifest.revision)}`)));
    for(const piece of batch){if(typeof piece!=='string')throw new Error('Invalid document part');pieces.push(piece);}
  }
  return JSON.parse(pieces.join('')) as T;
}
