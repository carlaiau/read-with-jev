export type Span = [number, number]; // Half-open UTF-16 offsets into this dataset's text.
export type Character = { id: string; name: string; aliases: string[] };
export type Passage = {
  id: string; chapter: number; start: number; end: number;
  contextStart: number; contextEnd: number; split: 'dev' | 'test';
  labels: string[];
};
export type Book = {
  schema: 1; id: 'mentions' | 'speaking'; title: string;
  layer: string; source: string; text: string; characters: Character[];
  passages: Passage[]; evidence: { characterId: string; span: Span }[];
  provenance: Record<string, unknown>;
};
export type Prediction = { passageId: string; characterId: string; probability: number };
