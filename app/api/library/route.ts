import { serveLibrary } from '../../../src/server/library';
export const runtime = 'nodejs';
export async function GET(request: Request) { return serveLibrary(request); }
export async function HEAD(request: Request) { return serveLibrary(request); }
