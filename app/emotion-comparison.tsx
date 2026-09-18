'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {readingEmotions,emotionColors,lexicalRanges,validEmotionScores,type ReadingEmotion,type EmotionMetadata,type EmotionScores,type ReadingPlan,type ReadingSentence} from '../src/lib/reading-emotions';
import {Checkbox,CheckboxField} from '../src/catalyst/typescript/checkbox';
import {Label} from '../src/catalyst/typescript/fieldset';
import {Button} from '../src/catalyst/typescript/button';
type Result={status:'pending'|'complete'|'error';scores?:EmotionScores;error?:string};
type Context={metadata:EmotionMetadata|null;emotions:ReadingEmotion[];nrc:boolean;jev:boolean;results:Map<string,Result>;inspect:(s:ReadingSentence,trigger:HTMLElement)=>void};
const Comparison=createContext<Context|null>(null);
const label=(s:string)=>s[0].toUpperCase()+s.slice(1);
const verdicts=['Supported','Wrong emotion','Wrong span','Unclear'] as const;
export function EmotionComparison({layer,children,ready}:{layer:string;children:ReactNode;ready:boolean}){
 const [metadata,setMetadata]=useState<EmotionMetadata|null>(null),[loadError,setLoadError]=useState('');
 const [emotions,setEmotions]=useState<ReadingEmotion[]>([...readingEmotions]),[nrc,setNrc]=useState(true),[jev,setJev]=useState(true);
 const inspector=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null);
 const cache=useRef(new Map<string,Result>()),[revision,setRevision]=useState(0),[retry,setRetry]=useState(0),[selected,setSelected]=useState<ReadingSentence|null>(null),[feedback,setFeedback]=useState<Partial<Record<ReadingEmotion,string>>>({});
 useEffect(()=>{const c=new AbortController();fetch(`/api/emotions?layer=${layer}`,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d as EmotionMetadata;}).then(d=>{setMetadata(d);if(!d.jevAvailable)setJev(false);}).catch(e=>{if(e.name!=='AbortError')setLoadError(e.message);});return()=>c.abort();},[layer]);
 useEffect(()=>{
  if(!metadata||!jev||!metadata.jevAvailable||!ready)return;
  let stopped=false,active=0,timer:ReturnType<typeof setTimeout>|undefined;const nearby=new Set<string>(),controllers=new Map<string,AbortController>();
  const bump=()=>setRevision(v=>v+1);
  function pump(){
   if(stopped||document.visibilityState==='hidden')return;
   for(const id of nearby){
    if(active>=2)break;if(cache.current.has(id))continue;
    const c=new AbortController();controllers.set(id,c);active++;cache.current.set(id,{status:'pending'});bump();
    fetch('/api/emotions',{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify({layer,sourceKey:metadata!.sourceKey,sentenceId:id})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(d.sentenceId!==id||!validEmotionScores(d.scores))throw new Error('JEV returned incomplete scores.');return d.scores as EmotionScores;}).then(scores=>{if(!stopped)cache.current.set(id,{status:'complete',scores});}).catch(e=>{if(!stopped&&e.name!=='AbortError')cache.current.set(id,{status:'error',error:e.message});}).finally(()=>{active--;controllers.delete(id);if(!stopped){bump();pump();}});
   }
  }
  const observer=new IntersectionObserver(entries=>{for(const e of entries){const id=(e.target as HTMLElement).dataset.emotionId!;if(e.isIntersecting)nearby.add(id);else nearby.delete(id);}clearTimeout(timer);timer=setTimeout(pump,180);},{rootMargin:'160px 0px'});
  document.querySelectorAll('[data-emotion-id]').forEach(el=>observer.observe(el));
  document.addEventListener('visibilitychange',pump);
  return()=>{stopped=true;observer.disconnect();clearTimeout(timer);document.removeEventListener('visibilitychange',pump);for(const [id,c] of controllers){c.abort();cache.current.delete(id);}};
 },[metadata,jev,layer,retry,ready]);
 const pending=[...cache.current.values()].filter(r=>r.status==='pending').length,errors=[...cache.current.values()].filter(r=>r.status==='error');
 const selectionResult=selected?cache.current.get(selected.id):undefined;
 const value=useMemo(()=>({metadata,emotions,nrc,jev,results:cache.current,inspect:(s:ReadingSentence,element:HTMLElement)=>{trigger.current=element;setSelected(s);setFeedback({});requestAnimationFrame(()=>inspector.current?.focus({preventScroll:true}));}}),[metadata,emotions,nrc,jev,revision]);
 function closeInspector(){setSelected(null);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}
 function saveFeedback(emotion:ReadingEmotion,verdict:string){if(!selected||!metadata)return;try{localStorage.setItem(`emotion-review:${metadata.sourceKey}:${selected.id}:${emotion}`,JSON.stringify({verdict,unit:'sentence',model:metadata.model,threshold:metadata.threshold,at:new Date().toISOString()}));setFeedback(f=>({...f,[emotion]:`${verdict} · saved on this device`}));}catch{setFeedback(f=>({...f,[emotion]:`${verdict} · could not save on this device`}));}}
 return <Comparison.Provider value={value}>
  <div className="emotion-controls">
   <div className="emotion-controls-row">
    <CheckboxField><Checkbox checked={nrc} onChange={setNrc} aria-label="NRC underlines"/><Label><span className="nrc-legend">NRC underlines</span></Label></CheckboxField>
    <CheckboxField><Checkbox checked={jev} onChange={setJev} disabled={!!metadata&&!metadata.jevAvailable} aria-label="JEV highlights"/><Label><span className="jev-legend">JEV highlights</span></Label></CheckboxField>
    <div className="emotion-picker" role="group" aria-label="Visible emotions">{readingEmotions.map(e=><button key={e} type="button" className="emotion-toggle" aria-label={label(e)} aria-pressed={emotions.includes(e)} style={{'--emotion-color':emotionColors[e]} as CSSProperties} onClick={()=>setEmotions(current=>readingEmotions.filter(item=>item===e?!current.includes(item):current.includes(item)))}><span className="emotion-circle" aria-hidden="true"/><span className="emotion-tooltip" aria-hidden="true">{label(e)}</span></button>)}</div>
   </div>
   {emotions.length===0&&<p className="emotion-note">All emotions hidden. Enable a circle to show its highlights.</p>}
   <div className="emotion-note">Dictionary words · JEV sentence suggestions · No character attribution</div>
   <div className="emotion-status" role="status" aria-live="polite">{loadError||(!metadata?'Loading emotion vocabulary…':!metadata.jevAvailable?'JEV is not configured on this server. NRC is available.':!jev?'JEV paused.':'')}{metadata&&jev&&metadata.jevAvailable&&(pending?'Analysing nearby sentences…':'JEV analyses as you scroll. Click a marked sentence to inspect.')}</div>
   {errors.length>0&&jev&&<div className="emotion-error"><span>{errors[0].error}</span><Button plain onClick={()=>{for(const [id,r] of cache.current)if(r.status==='error')cache.current.delete(id);setRetry(v=>v+1);setRevision(v=>v+1);}}>Retry analysis</Button></div>}
   {selected&&metadata&&<div className="emotion-inspector" role="region" ref={inspector} tabIndex={-1} aria-label="Emotion inspection" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeInspector();}}}>
    <div className="flex items-center justify-between gap-3"><strong>Selected sentence</strong><button aria-label="Close emotion inspection" onClick={closeInspector} className="underline underline-offset-4">Close</button></div>
    {emotions.map(emotion=>{const words=lexicalRanges(selected.target,metadata.lexicon,emotion).map(r=>selected.target.slice(r.start,r.end));const suggested=!!selectionResult?.scores&&selectionResult.scores[emotion]>=metadata.threshold;return <div key={emotion} className="emotion-inspection-row">
     <strong style={{color:emotionColors[emotion]}}>{label(emotion)}</strong>
     <p>NRC: {words.join(', ')||'No matching words'}.</p>
     <p>JEV: {selectionResult?.status==='error'?'Analysis failed.':selectionResult?.status==='pending'?'Analysing…':selectionResult?.status==='complete'?(suggested?'Sentence-level suggestion; not extracted evidence.':'No suggestion at the current threshold; this does not establish absence.'):'Not analysed yet.'}</p>
     {suggested&&<><div className="emotion-feedback">{verdicts.map(v=><button key={v} aria-label={`${v}: ${label(emotion)}`} onClick={()=>saveFeedback(emotion,v)}>{v}</button>)}</div><p role="status">{feedback[emotion]||'Feedback is saved only on this device.'}</p></>}
    </div>;})}
   </div>}
  </div>
  {children}
 </Comparison.Provider>;
}
export function EmotionText({passageId,fallback}:{passageId:string;fallback:ReactNode}){
 const ctx=useContext(Comparison),plan=ctx?.metadata?.plans.find(p=>p.id===passageId);
 if(!ctx||!plan||!ctx.metadata)return <>{fallback}</>;
 return <>{plan.sentences.map(s=><Sentence key={s.id} sentence={s} plan={plan} ctx={ctx}/>)}</>;
}
// Bands preserve every enabled association when several emotions share a span.
function bands(emotions:ReadingEmotion[],background=false){return `linear-gradient(to ${background?'bottom':'right'}, ${emotions.flatMap((e,i)=>{const color=background?`${emotionColors[e]}30`:emotionColors[e];return [`${color} ${i/emotions.length*100}%`,`${color} ${(i+1)/emotions.length*100}%`];}).join(', ')})`;}
function Sentence({sentence:s,plan,ctx}:{sentence:ReadingSentence;plan:ReadingPlan;ctx:Context}){
 const result=ctx.results.get(s.id),highlights=ctx.jev?ctx.emotions.filter(e=>result?.scores&&result.scores[e]>=ctx.metadata!.threshold):[];
 const ranges=ctx.nrc?ctx.emotions.flatMap(emotion=>lexicalRanges(s.target,ctx.metadata!.lexicon,emotion).map(r=>({...r,emotion}))):[];
 const emphasis=plan.emphasis.filter(r=>r.start<s.end&&r.end>s.start).map(r=>({start:Math.max(r.start-s.start,0),end:Math.min(r.end-s.start,s.target.length)}));
 const bounds=[...new Set([0,s.target.length,...ranges.flatMap(r=>[r.start,r.end]),...emphasis.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
 const actionable=highlights.length>0||ranges.length>0;
 const description=[highlights.length?`JEV sentence suggestions: ${highlights.map(label).join(', ')}.`:'',ranges.length?`NRC word associations: ${[...new Set(ranges.map(r=>r.emotion))].map(label).join(', ')}.`:''].filter(Boolean).join(' ');
 return <span data-emotion-id={s.id} data-jev-highlight={highlights.length?highlights.join(' '):undefined} className={`emotion-sentence ${highlights.length?'emotion-background':''}`} style={highlights.length?{backgroundImage:bands(highlights,true)}:undefined}
  role={actionable?'button':undefined} tabIndex={actionable?0:undefined} aria-label={actionable?`${description} ${s.target}`:undefined}
  title={actionable?`${description} Click to inspect`:undefined}
  onClick={e=>{if(actionable)ctx.inspect(s,e.currentTarget);}} onKeyDown={e=>{if(actionable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();ctx.inspect(s,e.currentTarget);}}}>
  {bounds.slice(0,-1).map((start,i)=>{const end=bounds[i+1],text=s.target.slice(start,end),matches=[...new Set(ranges.filter(r=>r.start<=start&&r.end>=end).map(r=>r.emotion))],italic=emphasis.some(r=>r.start<=start&&r.end>=end);const part=italic?<em>{text}</em>:text;return matches.length?<span key={start} className="emotion-underline" data-nrc-emotions={matches.join(' ')} style={{backgroundImage:bands(matches)}} title={`NRC word associations: ${matches.map(label).join(', ')}`}>{part}</span>:<span key={start}>{part}</span>;})}
 </span>;
}
