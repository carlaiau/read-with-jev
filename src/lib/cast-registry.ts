import assert from 'node:assert/strict';
import { digest } from './io';
export type CastMetadata = {
  schema: 1; gutenbergId: number; sourceSha256: string;
  status: 'extracted' | 'reviewed' | 'no-characters';
  method: { provider: string; model: string; promptVersion: string };
  characters: { id: string; name: string; description: string; scope: string;
    aliases: { text: string; evidence: [number, number] }[] }[];
};
/** Evidence uses half-open UTF-16 offsets in the exact downloaded source. */
export function validateCastMetadata(value: unknown, gutenbergId: number, source: string): CastMetadata {
  assert(value && typeof value === 'object', 'Invalid cast metadata');
  const cast = value as CastMetadata;
  assert.equal(cast.schema, 1); assert.equal(cast.gutenbergId, gutenbergId);
  assert.equal(cast.sourceSha256, digest(source), 'Cast belongs to another source edition');
  assert(['extracted', 'reviewed', 'no-characters'].includes(cast.status));
  assert(cast.method && ['provider', 'model', 'promptVersion'].every(k => typeof cast.method[k as keyof typeof cast.method] === 'string' && cast.method[k as keyof typeof cast.method].length > 0));
  assert(Array.isArray(cast.characters));
  assert.equal(cast.status === 'no-characters', cast.characters.length === 0, 'Empty cast needs explicit no-characters status');
  const ids = new Set<string>();
  for (const character of cast.characters) {
    assert(typeof character.id === 'string' && /^[a-z0-9-]+$/.test(character.id) && !ids.has(character.id), 'Invalid or duplicate identity'); ids.add(character.id);
    assert(typeof character.name === 'string' && character.name.trim());
    assert(typeof character.description === 'string' && typeof character.scope === 'string');
    assert(Array.isArray(character.aliases) && character.aliases.length > 0);
    for (const alias of character.aliases) {
      assert(typeof alias.text === 'string' && alias.text.trim(), 'Empty alias');
      assert(Array.isArray(alias.evidence) && alias.evidence.length === 2);
      const [start, end] = alias.evidence;
      assert(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= source.length, 'Alias evidence out of bounds');
      assert.equal(source.slice(start, end), alias.text, 'Alias must have exact source evidence');
    }
  }
  return cast;
}
