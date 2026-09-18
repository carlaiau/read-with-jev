/** Next may normalize request.url to an internal hostname. Host is the browser's destination. */
export function hasAllowedOrigin(request:Request):boolean {
 const origin=request.headers.get('origin');
 if(!origin)return true;
 try {
  const url=new URL(request.url),host=request.headers.get('host')??url.host;
  const destination=new URL(`${url.protocol}//${host}`);
  return new URL(origin).origin===origin&&origin===destination.origin;
 } catch {return false;}
}
