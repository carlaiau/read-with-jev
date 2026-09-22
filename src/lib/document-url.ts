import type { DocumentSummary } from './library-model';

type RoutableDocument = Pick<DocumentSummary, 'documentId' | 'title' | 'source'>;

// The document shown at "/" itself, rather than its own slug: its permalink is the index.
export const indexDocumentId = 'crime-and-punishment';

export function gutenbergId(document: RoutableDocument): string | undefined {
  return document.source.match(/^https:\/\/(?:www\.)?gutenberg\.org\/ebooks\/(\d+)\/?$/)?.[1];
}

export function documentPath(document: RoutableDocument): string {
  if (document.documentId === indexDocumentId) return '/';
  const title = document.title.normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = gutenbergId(document);
  return `/${id ? `${id}-${title || document.documentId}` : document.documentId}`;
}

export function resolveDocumentPath(documents: RoutableDocument[], slug: string) {
  const exact = documents.find(document => documentPath(document) === `/${slug}`);
  if (exact) return exact;
  // The ID remains authoritative if the title changes or a link has an old slug.
  const id = slug.match(/^(\d+)(?:-|$)/)?.[1];
  return id ? documents.find(document => gutenbergId(document) === id) : undefined;
}
