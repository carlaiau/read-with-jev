import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { LibraryCatalog } from '../lib/library-model';
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
export async function serveLibrary(request: Request, directory = join(process.cwd(), 'data/library')): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url), documentId = url.searchParams.get('document');
  if ([...url.searchParams.keys()].some(k => k !== 'document') || (documentId !== null && !/^[a-z0-9-]{1,80}$/.test(documentId))) return error('Unknown document request.', 400);
  try {
    const rawCatalog = await readFile(join(directory, 'catalog.json'), 'utf8');
    const catalog = JSON.parse(rawCatalog) as LibraryCatalog;
    if (documentId && !catalog.documents.some(d => d.documentId === documentId)) return error('Document not found.', 404);
    const body = documentId ? await readFile(join(directory, `${documentId}.json`), 'utf8') : rawCatalog;
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: etag, 'X-Content-Type-Options': 'nosniff' };
    if (request.headers.get('if-none-match')?.split(',').map(s => s.trim()).includes(etag)) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : body, { headers });
  } catch (e) {
    return error((e as NodeJS.ErrnoException).code === 'ENOENT' ? 'The document library is not ready. Please try again later.' : 'The document library could not be loaded. Please try again.', 503);
  }
}
