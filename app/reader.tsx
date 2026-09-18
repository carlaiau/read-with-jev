'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Book } from '../src/lib/model';
import { Button } from '../src/catalyst/typescript/button';
import { Checkbox, CheckboxField } from '../src/catalyst/typescript/checkbox';
import { Field, Label } from '../src/catalyst/typescript/fieldset';
import { Select } from '../src/catalyst/typescript/select';
import { Sidebar, SidebarHeader, SidebarBody, SidebarFooter } from '../src/catalyst/typescript/sidebar';
import { CharacterRail, chapterActivity, Sparkline } from './reader-charts';

const colors = ['#b64c68', '#27818d', '#7a65a4', '#ac7b1b', '#577b64', '#bd7047'];
export default function Reader() {
  const [layer, setLayer] = useState('mentions');
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setBook(null); setError(''); setCurrent(0);
    fetch(`/api/book?layer=${layer}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as Book;
    }).then(data => {
      setBook(data);
      const first = data.characters.find(c => c.name.startsWith('Elizabeth'));
      setSelected(first ? [first.id] : [data.characters[0].id]);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [layer]);
  useEffect(() => {
    if (!book) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    let ticking = false;
    const update = () => {
      ticking = false;
      const elements = [...document.querySelectorAll<HTMLElement>('[data-index]')];
      const marker = window.innerWidth < 1024 ? 100 : 80;
      let index = 0;
      for (const element of elements) {
        if (element.getBoundingClientRect().top > marker) break;
        index = Number(element.dataset.index);
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
  const activeNames = cast.filter(c => selected.includes(c.id)).map(c => c.name);
  const focusName = activeNames.length === 1 ? activeNames[0] : activeNames.length ? `${activeNames.length} characters` : 'The whole book';
  const matches = book?.passages.map((p, i) => !selected.length || p.labels.some(id => selected.includes(id)) ? i : -1).filter(i => i >= 0) ?? [];
  function jump(index: number | undefined) {
    if (index === undefined) return;
    setMobileOpen(false); setCurrent(index);
    document.getElementById(`passage-${index}`)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  const previous = matches.filter(i => i < current).at(-1), next = matches.find(i => i > current);
  const toggle = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]);

  return <div className="min-h-screen bg-paper text-ink">
    <a href="#reading-text" className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to book</a>
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-rule bg-panel px-5 lg:hidden">
      <span className="font-serif text-lg">Pride and Prejudice</span>
      <Button outline aria-expanded={mobileOpen} aria-controls="channels" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? 'Close channels' : 'Channels'}</Button>
    </header>
    <aside id="channels" className={`${mobileOpen ? 'block' : 'hidden'} fixed inset-x-0 top-16 bottom-0 z-30 border-r border-rule bg-panel lg:inset-x-auto lg:top-0 lg:left-0 lg:block lg:w-[290px] xl:w-[320px]`}>
      <Sidebar aria-label="Reading channels">
        <SidebarHeader className="px-6! pt-7! pb-5! lg:pt-10!">
          <a href="/" className="font-serif text-[27px] leading-tight tracking-tight">Pride and Prejudice</a>
          <p className="mt-2 font-serif text-lg italic text-muted">Jane Austen · 1813</p>
          <Field className="mt-6">
            <Label className="text-muted!">Explore by</Label>
            <Select value={layer} onChange={e => setLayer(e.target.value)} className="mt-2">
              <option value="mentions">Mentioned in the text</option><option value="speaking">Speaking in dialogue</option>
            </Select>
          </Field>
        </SidebarHeader>
        <SidebarBody className="gap-2 px-5! pt-4!">
          <div className="flex items-center justify-between px-2"><h2 className="text-sm font-semibold text-muted">Channels</h2><Button plain className="text-xs! text-muted!" onClick={() => setSelected([])}>Clear</Button></div>
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
          <div className="flex items-baseline justify-between gap-3"><h2 className="text-sm font-semibold">{selected.length ? 'Selected thread' : 'Whole book'}</h2><span className="text-xs text-muted">{matches.length} passages</span></div>
          <div className="flex items-center gap-3 text-sm text-muted"><span className="h-3 w-7 rounded-xs" style={{ background: activeColor }} />{layer === 'mentions' ? 'Annotated references' : 'Spoken aloud'}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button outline disabled={previous === undefined} onClick={() => jump(previous)} className="px-2! text-xs!">← Previous passage</Button>
            <Button outline disabled={next === undefined} onClick={() => jump(next)} className="px-2! text-xs!">Next passage →</Button>
          </div>
          <div className="border-t border-rule pt-4"><p className="font-serif text-lg">Chapter {book?.passages[current]?.chapter ?? 1}</p><p className="mt-1 text-xs text-muted">Passage {current + 1} of {book?.passages.length ?? '—'} · {book ? Math.round((book.passages[current]?.start ?? 0) / book.text.length * 100) : 0}% through</p></div>
        </SidebarFooter>
      </Sidebar>
    </aside>

    <main id="reading-text" className="reading-column mr-12 min-w-0 px-6 pt-28 pb-24 sm:px-10 lg:ml-[290px] lg:mr-[155px] lg:px-12 lg:pt-16 xl:ml-[320px] xl:mr-[185px] xl:px-20">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-12 flex items-center gap-3 text-[11px] font-medium tracking-[.17em] text-muted uppercase"><span className="h-px w-7 bg-rule" />Read with JEV<span className="ml-auto hidden sm:inline">An annotated reading edition</span></div>
        <h1 className="font-serif text-[42px] leading-[1.08] tracking-[-.035em] sm:text-6xl xl:text-[72px]">Pride and Prejudice</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-muted lg:text-lg">The whole book, one thread at a time. Pick a character to follow their {layer === 'mentions' ? 'mentions through the story' : 'spoken words'}. The rail on the right traces their part in the book, from beginning to end.</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted"><span className="rounded-full border border-rule px-3 py-1">{layer === 'mentions' ? 'BookCoref · mentions' : 'PDNC · dialogue'}</span><span>Human annotations · full-book spoilers</span></div>
        {error && <p role="alert" className="mt-10 rounded border border-red-200 bg-red-50 p-5 text-red-800">{error}</p>}
        {!book && !error && <p role="status" className="mt-16 font-serif text-xl text-muted">Opening the annotated edition…</p>}
        {book && <>
          <div className="mt-16 mb-10 flex items-center gap-5"><span className="shrink-0 font-serif text-xl italic text-muted">The story</span><span className="h-px w-full bg-rule" /></div>
          <div className="book-text">{book.passages.map((p, index) => {
            const matching = selected.filter(id => p.labels.includes(id));
            const newChapter = index === 0 || book.passages[index - 1].chapter !== p.chapter;
            return <section key={p.id} id={`passage-${index}`} data-index={index} data-focused={!selected.length || matching.length > 0}
              className={`passage relative mb-12 scroll-mt-24 lg:scroll-mt-16 ${matching.length ? 'matched' : ''}`}>
              <div className="passage-threads" aria-hidden="true">
                {matching.map(id => <span key={id} className="passage-thread" data-character-id={id} style={{ backgroundColor: colorFor(id) }} />)}
              </div>
              {newChapter && <h2 className="mb-7 pt-5 font-serif text-2xl text-ink">Chapter {p.chapter}</h2>}
              <div className="passage-meta mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"><span>{String(index + 1).padStart(3, '0')}</span>{matching.map(id => <span key={id} style={{ color: colorFor(id) }}>{cast.find(c => c.id === id)?.name}</span>)}</div>
              <p className="font-serif text-[21px] leading-[1.95] whitespace-pre-line sm:text-[23px]">{book.text.slice(p.start, p.end).replace(/\b(?:CHAPTER|Chapter)\s+[IVXLCDM]+\b\s*\.?/, '').trim()}</p>
            </section>;
          })}</div>
          <footer className="border-t border-rule pt-7 text-sm leading-7 text-muted">Reference annotations, not JEV predictions or physical-presence labels. Each layer keeps its own source edition; switching layers resets the reading position. <a className="underline underline-offset-4" href={book.source} target="_blank" rel="noreferrer">Dataset source</a></footer>
        </>}
      </div>
    </main>
    <aside className="fixed top-20 right-1 bottom-5 w-10 lg:top-0 lg:right-0 lg:bottom-0 lg:w-[155px] lg:border-l lg:border-rule lg:bg-panel xl:w-[185px]" aria-label="Whole-book character map">
      <div className="hidden h-24 px-5 pt-9 lg:block"><p className="truncate text-sm text-muted" title={focusName}>{focusName}</p><p className="mt-1 text-[11px] text-muted">{selected.length ? 'Character thread' : 'All annotated activity'}</p></div>
      {book && <>
        <div className="h-full lg:h-[calc(100%-205px)]"><CharacterRail book={book} selected={selected} current={current} colorFor={colorFor} jump={jump} /></div>
        <div className="hidden space-y-2 px-5 pt-4 lg:block"><label htmlFor="book-position" className="text-xs text-muted">Book position</label><input id="book-position" type="range" className="w-full accent-slate-600" min={0} max={book.passages.length - 1} value={current} onChange={e => jump(Number(e.target.value))} aria-valuetext={`Chapter ${book.passages[current].chapter}, passage ${current + 1}`} /><p className="text-[11px] leading-4 text-muted">Curve: share of nearby passages with a match.</p></div>
      </>}
    </aside>
  </div>;
}
