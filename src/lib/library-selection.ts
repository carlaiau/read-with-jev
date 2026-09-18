import assert from 'node:assert/strict';
import settings from '../../library/import-settings.json';
export function selectEnglishEntries<T extends {status:string;language?:string|null}>(entries:T[],limit=settings.englishLimit):T[] {
  assert(Number.isInteger(limit) && limit>0 && limit<=100,'Invalid English library limit');
  return entries.filter(entry=>entry.status==='downloaded' && entry.language==='English').slice(0,limit);
}
