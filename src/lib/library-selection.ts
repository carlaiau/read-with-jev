import selection from '../../library/reader-selection.json';
import assert from 'node:assert/strict';
import settings from '../../library/import-settings.json';
export function selectEnglishEntries<T extends {status:string;language?:string|null}>(entries:T[],limit=settings.englishLimit):T[] {
  assert(Number.isInteger(limit) && limit>0 && limit<=100,'Invalid English library limit');
  return entries.filter(entry=>entry.status==='downloaded' && entry.language==='English').slice(0,limit);
}

// Explicit editorial selection: a size or title heuristic would exclude long novels
// and misclassify fictional autobiographies or epistolary novels.
const readerIds=new Set(selection.included.map(entry=>entry.id));
const gutenbergIds=new Set<number>(selection.included.flatMap(entry=>entry.gutenbergId===null?[]:[entry.gutenbergId]));
export function isReaderDocument(document:{id:string}):boolean{return readerIds.has(document.id);}
export function selectNovelEntries<T extends {status:string;language?:string|null;gutenbergId:number}>(entries:T[],limit=settings.englishLimit):T[]{
 return selectEnglishEntries(entries,limit).filter(entry=>gutenbergIds.has(entry.gutenbergId));
}
