import { serveLibrary } from '../../src/server/library';
// Native Netlify function: /.netlify/functions/library[?document=<catalog ID>].
// Build-time data only; no API credentials or model clients are imported.
export default async (request: Request) => serveLibrary(request);
