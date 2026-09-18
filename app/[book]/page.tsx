import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound, redirect } from 'next/navigation';
import Reader from '../reader';
import { documentPath, resolveDocumentPath } from '../../src/lib/document-url';
import type { LibraryCatalog } from '../../src/lib/library-model';

export default async function BookPage({ params }: { params: Promise<{ book: string }> }) {
  const { book } = await params;
  const catalog: LibraryCatalog = JSON.parse(await readFile(join(process.cwd(), 'data/library/catalog.json'), 'utf8'));
  const resolved = resolveDocumentPath(catalog.documents, book);
  if (!resolved) notFound();
  const path = documentPath(resolved);
  if (path !== `/${book}`) redirect(path);
  const document = catalog.documents.find(item => item.documentId === resolved.documentId)!;
  return <Reader key={document.documentId} documentId={document.documentId} initialDocument={document} />;
}
