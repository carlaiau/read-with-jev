import type { Book, Character } from './model';
export type DocumentSpec = { id: string; gutenbergId: number | null; title: string; author: string; year: number | null; characters: Character[]; sourceUrl: string; sourcePage: string; format: 'gutenberg-text' | 'bookcoref-text'; registryNote: string; segmentation?: 'automatic'; castSource?: string };
export type LibraryDocument = Book & {
  documentId: string; author: string; year: number | null; textFormat: 'plain' | 'tokenized';
  sections: { index: number; title: string; start: number; end: number }[];
  classification: { kind: 'baseline'; method: 'literal-name-matching'; version: 1; registryHash: string; coverage: string };
};
export type DocumentSummary = Pick<LibraryDocument, 'documentId' | 'title' | 'author' | 'year' | 'source' | 'classification'> & { passages: number; characters: number; sections: number; revision: string };
export type LibraryCatalog = { schema: 1; documents: DocumentSummary[]; importStatus?: { english: number; ready: number; pending: number[]; excluded: number } };
