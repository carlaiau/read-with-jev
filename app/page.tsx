import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Reader from './reader';
import { indexDocumentId } from '../src/lib/document-url';
import type { LibraryCatalog } from '../src/lib/library-model';

export default async function Page() {
  const catalog: LibraryCatalog = JSON.parse(await readFile(join(process.cwd(), 'data/library/catalog.json'), 'utf8'));
  const document = catalog.documents.find(item => item.documentId === indexDocumentId)!;
  return <Reader key={document.documentId} documentId={document.documentId} initialDocument={document} />;
}
