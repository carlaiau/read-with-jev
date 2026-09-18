import { readFile } from 'node:fs/promises';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('layer') ?? 'mentions';
  if (id !== 'mentions' && id !== 'speaking') return Response.json({ error: 'Unknown layer' }, { status: 400 });
  try {
    const book = await readFile(`${process.cwd()}/data/processed/${id}.json`, 'utf8');
    return new Response(book, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'Book data is not prepared. Run npm run data:fetch and npm run data:prepare.' : 'The book could not be loaded.' }, { status: 503 });
  }
}
