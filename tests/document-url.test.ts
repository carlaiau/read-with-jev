import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentPath, resolveDocumentPath } from '../src/lib/document-url';

const documents = [
  { documentId: 'pride-and-prejudice', title: 'Pride and Prejudice', source: 'https://www.gutenberg.org/ebooks/1342' },
  { documentId: 'gutenberg-42671', title: 'Pride and Prejudice', source: 'https://www.gutenberg.org/ebooks/42671' },
  { documentId: 'alice', title: 'Alice’s Adventures in Wonderland', source: 'https://www.gutenberg.org/ebooks/11' },
  { documentId: 'animal-farm', title: 'Animal Farm', source: 'https://example.com/animal-farm' },
];

test('permalinks distinguish editions and handle punctuation and non-Gutenberg documents', () => {
  assert.deepEqual(documents.map(documentPath), ['/1342-pride-and-prejudice', '/42671-pride-and-prejudice', '/11-alices-adventures-in-wonderland', '/animal-farm']);
  assert.equal(documentPath({documentId:'test',title:'Éloïsa: A Tale!',source:'https://www.gutenberg.org/ebooks/1'}), '/1-eloisa-a-tale');
  for (const document of documents) assert.equal(resolveDocumentPath(documents, documentPath(document).slice(1)), document);
  assert.equal(resolveDocumentPath(documents, '1342-old-title'), documents[0]);
  assert.equal(resolveDocumentPath(documents, '9999-unknown'), undefined);
  assert.equal(resolveDocumentPath(documents, 'unknown'), undefined);
});
