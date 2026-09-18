'use client';
import {EmotionComparison,EmotionControls,EmotionInspection,EmotionText} from './emotion-comparison';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { documentPath } from '../src/lib/document-url';
import { loadLibraryDocument } from '../src/lib/library-transport';
import { readerSegments,readerPassageText } from '../src/lib/reader-text';
import type { DocumentSummary, LibraryDocument } from '../src/lib/library-model';
import type { Book } from '../src/lib/model';
import { Button } from '../src/catalyst/typescript/button';
import { Checkbox, CheckboxField } from '../src/catalyst/typescript/checkbox';
import { Field, Label } from '../src/catalyst/typescript/fieldset';
import { Select } from '../src/catalyst/typescript/select';
import { Radio, RadioField, RadioGroup } from '../src/catalyst/typescript/radio';
import { Sidebar, SidebarHeader, SidebarBody, SidebarFooter } from '../src/catalyst/typescript/sidebar';
import { CharacterRail, chapterActivity, Sparkline } from './reader-charts';

const colors = ['#b64c68', '#27818d', '#7a65a4', '#ac7b1b', '#577b64', '#bd7047'];
export default function Reader({ documentId, initialDocument }: { documentId: string; initialDocument: DocumentSummary }) {
  const router = useRouter();
  const [book, setBook] = useState<(Book & Partial<LibraryDocument>) | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [retry, setRetry] = useState(0);
  const baseline = true;
  const mentionLayer = true;
  const documentInfo = documents.find(d => d.documentId === documentId) ?? initialDocument;
  const title = book?.title ?? documentInfo?.title ?? 'Document library';
  const sectionTitle = (chapter: number) => book?.sections?.find(s => s.index === chapter)?.title ?? `Chapter ${chapter}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/.netlify/functions/library', { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setDocuments((data.documents as DocumentSummary[]).toSorted((a, b) =>
        a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) ||
        a.source.localeCompare(b.source, 'en', { numeric: true }) ||
        a.documentId.localeCompare(b.documentId, 'en', { numeric: true })));
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [retry]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState('any');
  const [current, setCurrent] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setBook(null); setError(''); setCurrent(0); setSelected([]); setMatchMode('any');
    loadLibraryDocument<Book & Partial<LibraryDocument>>(`/.netlify/functions/library?document=${encodeURIComponent(documentId)}`, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setBook(data);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [documentId, retry]);
  useEffect(() => {
    if (!book) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    let ticking = false;
    const update = () => {
      ticking = false;
      const elements = [...document.querySelectorAll<HTMLElement>('[data-index]')];
      const marker = elements[0] ? parseFloat(getComputedStyle(elements[0]).scrollMarginTop) + 4 : 80;
      let index = 0;
      for (const element of elements) {
        if (element.getBoundingClientRect().top > marker) break;
        index = Number(element.dataset.index);
      }
      if (elements.length && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        index = Number(elements.at(-1)!.dataset.index);
      }
      setCurrent(index);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [book]);
  const cast = useMemo(() => book ? book.characters.map(c => ({ ...c,
    count: book.passages.filter(p => p.labels.includes(c.id)).length,
    activity: chapterActivity(book, [c.id]),
  })).sort((a, b) => b.count - a.count) : [], [book]);
  const colorFor = (id: string) => colors[Math.max(0, cast.findIndex(c => c.id === id)) % colors.length];
  const activeColor = selected.length ? colorFor(selected[0]) : '#536171';
  const requireAll = matchMode === 'all' && selected.length > 1;
  const matches = book?.passages.map((p, i) => !selected.length || (requireAll ? selected.every(id => p.labels.includes(id)) : selected.some(id => p.labels.includes(id))) ? i : -1).filter(i => i >= 0) ?? [];
  function jump(index: number | undefined) {
    if (index === undefined) return;
    setMobileOpen(false); setCurrent(index);
    document.getElementById(`passage-${index}`)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  const previous = matches.filter(i => i < current).at(-1), next = matches.find(i => i > current);
  const toggle = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]);

  return <EmotionComparison key={documentId} layer={`document:${documentId}`} ready={!!book}><div className="min-h-screen bg-paper text-ink">
    <a href="#reading-text" className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to book</a>
    <header className="fixed left-0 right-10 top-0 z-40 flex h-16 items-center justify-between border-b border-rule bg-panel px-5 lg:hidden">
      <span className="min-w-0 truncate pr-3 font-serif text-lg">{title}</span>
      <Button outline aria-expanded={mobileOpen} aria-controls="channels" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? 'Close characters' : 'Characters'}</Button>
    </header>
    <aside id="channels" className={`${mobileOpen ? 'block' : 'hidden'} fixed inset-x-0 top-16 bottom-0 z-30 border-r border-rule bg-panel lg:inset-x-auto lg:top-0 lg:left-0 lg:block lg:w-[290px] xl:w-[320px]`}>
      <Sidebar aria-label="Characters">
        <SidebarHeader className="px-6! pt-7! pb-5! lg:pt-10!">
          <a href={documentPath(documentInfo)} className="font-serif text-[27px] leading-tight tracking-tight">{title}</a>
          <p className="mt-2 font-serif text-lg italic text-muted">{documentInfo?.author ?? 'Unknown author'}{documentInfo?.year ? ` · ${documentInfo.year}` : ''}</p>
          <EmotionControls />
          <Field className="mt-4">
            <Label>Document</Label>
            <Select aria-label="Document" value={documentId} disabled={!documents.length} onChange={e => {
              const nextDocument = documents.find(document => document.documentId === e.target.value);
              if (!nextDocument || nextDocument.documentId === documentId) return;
              setSelected([]); setMatchMode('any');
              router.push(documentPath(nextDocument));
            }} className="mt-2">
              {!documents.length && <option value={documentId}>{documentInfo.title}</option>}
              {documents.map(d => <option key={d.documentId} value={d.documentId}>{d.title}{documents.filter(other => other.title === d.title).length > 1 ? ` · Gutenberg ${d.source.split("/").at(-1)}` : ""}</option>)}
            </Select>
          </Field>
        </SidebarHeader>
        <SidebarBody className="gap-2 px-5! pt-4!">
          <div className="flex items-center justify-between px-2"><h2 className="text-sm font-semibold text-muted">Characters</h2><Button plain className="text-xs! text-muted!" onClick={() => setSelected([])}>Clear</Button></div>
          {book && <>
            <button className={`channel-card w-full cursor-pointer rounded-lg border p-3 text-left ${!selected.length ? 'border-rule bg-ink/5' : 'border-transparent hover:bg-ink/3'}`} onClick={() => setSelected([])} aria-pressed={!selected.length}>
              <span className="flex items-baseline justify-between gap-2"><strong className="text-base font-medium">The book</strong><span className="text-xs text-muted">all {book.passages.length} passages</span></span>
              <Sparkline values={chapterActivity(book, book.characters.map(c => c.id))} color="#64707b" />
            </button>
            {cast.map(c => <CheckboxField key={c.id} className={`channel-card shrink-0 rounded-lg border p-3 ${selected.includes(c.id) ? 'border-rule bg-ink/5' : 'border-transparent hover:bg-ink/3'}`}>
              <Checkbox color="rose" aria-label={c.name} checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
              <Label className="cursor-pointer"><span className="flex items-baseline justify-between gap-2"><span className="text-base font-medium" style={{ color: colorFor(c.id) }}>{c.name}</span><span className="shrink-0 text-xs text-muted">{c.count}</span></span></Label>
              <div className="col-span-2" data-channel-id={c.id}><Sparkline values={c.activity} color={colorFor(c.id)} /></div>
            </CheckboxField>)}
          </>}
        </SidebarBody>
        <SidebarFooter className="gap-4 px-6! py-5!">
          <div className="flex items-center gap-4">
            <h2 className="shrink-0 text-sm font-semibold">Jump to</h2>
            {selected.length > 1 && <RadioGroup aria-label="Match passages" value={matchMode} onChange={setMatchMode} className="flex items-center gap-4 space-y-0!">
              <RadioField className="items-center gap-x-2! py-1 *:data-[slot=control]:mt-0!"><Radio color="rose" value="any" /><Label className="cursor-pointer text-sm!">Any</Label></RadioField>
              <RadioField className="items-center gap-x-2! py-1 *:data-[slot=control]:mt-0!"><Radio color="rose" value="all" /><Label className="cursor-pointer whitespace-nowrap text-sm!">{selected.length === 2 ? 'Both' : `All ${selected.length}`}</Label></RadioField>
            </RadioGroup>}
          </div>
          {requireAll && matches.length === 0 && <p role="status" className="text-sm text-muted">No passages include all selected characters. Try fewer characters or another layer.</p>}
          <div className="flex items-center gap-3 text-sm text-muted"><span className="h-3 w-7 rounded-xs" style={{ background: activeColor }} />{baseline ? 'Name matches' : mentionLayer ? 'Annotated references' : 'Spoken aloud'}</div>
          <div className="flex items-center gap-2">
            <Button outline aria-label="Previous passage" title="Previous passage" disabled={previous === undefined} onClick={() => jump(previous)} className="size-9 shrink-0 items-center! p-0!">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
            </Button>
            <Button outline aria-label="Next passage" title="Next passage" disabled={next === undefined} onClick={() => jump(next)} className="size-9 shrink-0 items-center! p-0!">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
            </Button>
            <p className="ml-1 text-xs text-muted" aria-live="polite">{matches.length} passages</p>
          </div>
          <div className="border-t border-rule pt-4"><p className="font-serif text-lg">{sectionTitle(book?.passages[current]?.chapter ?? 1)}</p><p className="mt-1 text-xs text-muted">Passage {current + 1} of {book?.passages.length ?? '—'} · {book ? Math.round((book.passages[current]?.start ?? 0) / book.text.length * 100) : 0}% through</p></div>
        </SidebarFooter>
      </Sidebar>
    </aside>

    <main id="reading-text" className="reading-column mr-12 min-w-0 px-6 pt-28 pb-24 sm:px-10 lg:ml-[290px] lg:mr-[155px] lg:px-12 lg:pt-9 xl:ml-[320px] xl:mr-[185px] xl:px-20">
      <div className="mx-auto max-w-[860px]">
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 mb-5 text-sm leading-6 text-muted">Select characters to inspect their {mentionLayer ? 'mentions' : 'dialogue'}. Use the map to jump to a passage.</p>
        <EmotionInspection />
        <div className="research-state mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-rule bg-paper py-3 text-xs" aria-label="Annotation source">
          <strong className="font-semibold">{baseline ? 'Baseline · name matches' : `Gold annotations · ${mentionLayer ? 'BookCoref · Mentions' : 'PDNC · Speakers'}`}</strong>
          <span className="text-muted">Full-book spoilers</span>
        </div>
        {error && <p role="alert" className="mt-10 rounded border border-red-200 bg-red-50 p-5 text-red-800">{error} <button className="underline underline-offset-4" onClick={() => setRetry(n => n + 1)}>Try again</button></p>}
        {!book && !error && <p role="status" className="mt-16 font-serif text-xl text-muted">Opening the document…</p>}
        {book && <>
          <div className="book-text">{book.passages.map((p, index) => {
            const matching = selected.filter(id => p.labels.includes(id));
            const newChapter = index === 0 || book.passages[index - 1].chapter !== p.chapter;
            const passageText = readerPassageText(book,index);
            return <section key={p.id} id={`passage-${index}`} data-index={index} data-focused={matches.includes(index)} data-shared={selected.length > 1 && matching.length === selected.length}
              className={`passage relative mb-12 scroll-mt-24 lg:scroll-mt-16 ${selected.length && matches.includes(index) ? 'matched' : ''}`}>
              <div className="passage-threads" aria-hidden="true">
                {matching.map(id => <span key={id} className="passage-thread" data-character-id={id} style={{ backgroundColor: colorFor(id) }} />)}
              </div>
              {newChapter && <h2 className="mb-7 pt-5 font-serif text-2xl text-ink">{sectionTitle(p.chapter)}</h2>}
              <div className="passage-meta mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"><span>{String(index + 1).padStart(3, '0')}</span>{matching.map(id => <span key={id} style={{ color: colorFor(id) }}>{cast.find(c => c.id === id)?.name}</span>)}{selected.length > 1 && matching.length === selected.length && <span className="font-semibold text-ink">{mentionLayer ? 'All selected mentioned' : 'All selected speak'}</span>}</div>
              <p className="font-serif text-[21px] leading-[1.95] whitespace-pre-line sm:text-[23px]"><EmotionText passageId={p.id} fallback={readerSegments(passageText, baseline ? book.textFormat === 'tokenized' : mentionLayer).map((part, i) => part.emphasis ? <em key={i}>{part.text}</em> : part.text)} /></p>
            </section>;
          })}</div>
          <footer className="border-t border-rule pt-7 text-sm leading-7 text-muted">{baseline ? 'Name and alias matches for a selected cast. These do not resolve pronouns or establish physical presence. Generic aliases may be ambiguous; an unmarked passage does not prove a character is absent.' : 'Human reference annotations, not JEV predictions or physical-presence labels. Each layer keeps its own source edition.'} Switching documents resets the reading position. <a className="underline underline-offset-4" href={book.source} target="_blank" rel="noreferrer">Source edition</a></footer>
        </>}
      </div>
    </main>
    <aside className="fixed inset-y-0 right-0 w-10 lg:w-[155px] lg:border-l lg:border-rule lg:bg-panel xl:w-[185px]" aria-label="Whole-book character map">
      {book && <CharacterRail book={book} selected={selected} current={current} colorFor={colorFor} jump={jump} />}
    </aside>
  </div></EmotionComparison>;
}
