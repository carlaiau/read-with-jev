import type { Book } from '../src/lib/model';

/** Each sample is the fraction of chapter passages containing this identity. */
export function chapterActivity(book: Book, ids: string[]): number[] {
  const total = Array<number>(Math.max(0, ...book.passages.map(p => p.chapter))).fill(0);
  const matching = [...total], selected = new Set(ids);
  for (const passage of book.passages) {
    total[passage.chapter - 1]++;
    if (!selected.size || passage.labels.some(id => selected.has(id))) matching[passage.chapter - 1]++;
  }
  return total.map((count, i) => count ? matching[i] / count : 0);
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const points = values.map((value, i) => `${i / Math.max(1, values.length - 1) * 240},${32 - value * 25}`).join(' ');
  return <svg viewBox="0 0 240 44" className="mt-2 h-10 w-full" aria-hidden="true" preserveAspectRatio="none">
    <path d="M0 32H240" fill="none" stroke="currentColor" strokeOpacity=".15" />
    <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    {values.map((value, i) => value > 0 && <rect key={i} x={i / values.length * 240} y="40" width="2.6" height="2.6" fill={color} opacity={.3 + value * .5} />)}
  </svg>;
}

export function CharacterRail({ book, selected, current, colorFor, jump }: {
  book: Book; selected: string[]; current: number; colorFor: (id: string) => string; jump: (index: number) => void;
}) {
  const ids = selected.length ? selected : book.characters.map(c => c.id);
  const laneWidth = 112 / Math.max(1, ids.length);
  // Each character has an independent five-passage average and a separate lane,
  // so selecting a second character cannot merge or hide the first one's curve.
  const lanes = ids.map((id, lane) => {
    const left = 30 + lane * laneWidth;
    const baseline = left + laneWidth * .18;
    const points = book.passages.map((p, i) => {
      const start = Math.max(0, i - 2), end = Math.min(book.passages.length, i + 3);
      let matches = 0;
      for (let j = start; j < end; j++) matches += Number(book.passages[j].labels.includes(id));
      return { x: baseline + matches / (end - start) * laneWidth * .62,
        y: (p.start + p.end) / 2 / book.text.length * 1000 };
    });
    return { id, left, baseline, points, color: colorFor(id), name: book.characters.find(c => c.id === id)?.name };
  });
  const position = book.passages[current];
  const chapters = book.passages.filter((p, i) => i === 0 || p.chapter !== book.passages[i - 1].chapter);
  return <div className="relative h-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-600" role="slider" tabIndex={0}
    aria-label="Book position" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={book.passages.length - 1} aria-valuenow={current}
    aria-valuetext={`Passage ${current + 1} of ${book.passages.length}`}
    onKeyDown={event => {
      const target = { ArrowDown: current + 1, ArrowRight: current + 1, ArrowUp: current - 1, ArrowLeft: current - 1,
        PageDown: current + 10, PageUp: current - 10, Home: 0, End: book.passages.length - 1 }[event.key];
      if (target !== undefined) { event.preventDefault(); jump(Math.max(0, Math.min(book.passages.length - 1, target))); }
    }}><svg viewBox="0 0 150 1000" preserveAspectRatio="none" className="minimap h-full w-full cursor-crosshair" role="img"
    aria-label="Whole-book character map. Each selected character has a separate curve in their channel color. Use arrow keys, Home, or End on the map, or the previous and next passage buttons for keyboard navigation."
    onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * book.text.length;
      const index = book.passages.findIndex(p => p.end > offset);
      jump(index < 0 ? book.passages.length - 1 : index);
    }}>
    {chapters.map((p, i) => <rect key={p.chapter} x="6" y={p.start / book.text.length * 1000} width="138"
      height={((chapters[i + 1]?.start ?? book.text.length) - p.start) / book.text.length * 1000} fill={i % 2 ? '#e6e3de' : '#efede9'} />)}
    {lanes.map(lane => <g key={lane.id} data-character-id={lane.id} className="rail-lane">
      <title>{lane.name}</title>
      {book.passages.map(p => p.labels.includes(lane.id) && <rect key={p.id}
        x={selected.length ? lane.left + laneWidth - 3 : lane.left}
        y={p.start / book.text.length * 1000}
        width={selected.length ? Math.min(3, laneWidth * .15) : laneWidth * .75}
        height={Math.max(.7, (p.end - p.start) / book.text.length * 1000 - .5)} fill={lane.color} opacity={selected.length ? .65 : .4} />)}
      {selected.length > 0 && <>
        <line x1={lane.baseline} x2={lane.baseline} y1="0" y2="1000" stroke={lane.color} strokeOpacity=".18" strokeWidth=".7" />
        <polygon points={`${lane.baseline},0 ${lane.points.map(p => `${p.x},${p.y}`).join(' ')} ${lane.baseline},1000`} fill={lane.color} opacity=".13" />
        <polyline className="rail-curve" data-character-id={lane.id} points={lane.points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke={lane.color} strokeWidth="1.35" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </>}
    </g>)}
    {selected.length > 1 && book.passages.map((p, i) => selected.every(id => p.labels.includes(id)) && <g key={p.id} className="rail-shared" data-passage-index={i}>
      <title>All selected characters · passage {i + 1}</title>
      <rect x="24" width="120" y={p.start / book.text.length * 1000}
        height={Math.max(.8, (p.end - p.start) / book.text.length * 1000)} fill="#24303b" opacity=".09" />
      <rect x="24" width="3" y={p.start / book.text.length * 1000}
        height={Math.max(.8, (p.end - p.start) / book.text.length * 1000 - .5)} fill="#24303b" opacity=".8" />
    </g>)}
    {position && <g>
      <rect x="0" width="150" y={position.start / book.text.length * 1000} height={Math.max(5, (position.end - position.start) / book.text.length * 1000)} fill="#202a36" opacity=".12" />
      <line x1="0" x2="150" y1={position.start / book.text.length * 1000} y2={position.start / book.text.length * 1000} stroke="#334155" strokeWidth="1" />
      {selected.length > 0 && lanes.map(lane => <circle key={lane.id} cx={lane.points[current].x} cy={position.start / book.text.length * 1000}
        r="2.8" fill="#f6f4f0" stroke={lane.color} strokeWidth="1.5" />)}
    </g>}
  </svg>
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
      {chapters.filter((p, i) => i === 0 || p.chapter % 10 === 0).map(p => <span key={p.chapter}
        className="absolute left-1 text-[10px] leading-none text-muted tabular-nums"
        style={{ top: `${p.start / book.text.length * 100}%` }}>{p.chapter}</span>)}
    </div>
  </div>;
}
