'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {readingEmotions,emotionColors,lexicalRanges,validEmotionScores,type ReadingEmotion,type EmotionMetadata,type EmotionScores,type ReadingPlan,type ReadingSentence} from '../src/lib/reading-emotions';
import {Checkbox,CheckboxField} from '../src/catalyst/typescript/checkbox';
import {Field,Label} from '../src/catalyst/typescript/fieldset';
import {Select} from '../src/catalyst/typescript/select';
import {Button} from '../src/catalyst/typescript/button';
type Result={status:'pending'|'complete'|'error';scores?:EmotionScores;error?:string};
type Context={metadata:EmotionMetadata|null;emotion:ReadingEmotion;nrc:boolean;jev:boolean;results:Map<string,Result>;inspect:(s:ReadingSentence,trigger:HTMLElement)=>void};
const Comparison=createContext<Context|null>(null);
const label=(s:string)=>s[0].toUpperCase()+s.slice(1);
const verdicts=['Supported','Wrong emotion','Wrong span','Unclear'] as const;
export function EmotionComparison({layer,children,ready}:{layer:string;children:ReactNode;ready:boolean}){
 const [metadata,setMetadata]=useState<EmotionMetadata|null>(null),[loadError,setLoadError]=useState('');
 const [emotion,setEmotion]=useState<ReadingEmotion>('fear'),[nrc,setNrc]=useState(true),[jev,setJev]=useState(true);
 const inspector=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null);
 const cache=useRef(new Map<string,Result>()),[revision,setRevision]=useState(0),[retry,setRetry]=useState(0),[selected,setSelected]=useState<ReadingSentence|null>(null),[feedback,setFeedback]=useState('');
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
 const selectedHighlight=selectionResult?.scores&&metadata?selectionResult.scores[emotion]>=metadata.threshold:false;
 const value=useMemo(()=>({metadata,emotion,nrc,jev,results:cache.current,inspect:(s:ReadingSentence,element:HTMLElement)=>{trigger.current=element;setSelected(s);setFeedback('');requestAnimationFrame(()=>inspector.current?.focus({preventScroll:true}));}}),[metadata,emotion,nrc,jev,revision]);
 function closeInspector(){setSelected(null);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}
 function saveFeedback(verdict:string){if(!selected||!metadata)return;try{localStorage.setItem(`emotion-review:${metadata.sourceKey}:${selected.id}:${emotion}`,JSON.stringify({verdict,unit:'sentence',model:metadata.model,threshold:metadata.threshold,at:new Date().toISOString()}));setFeedback(`${verdict} · saved on this device`);}catch{setFeedback(`${verdict} · could not save on this device`);}}
 return <Comparison.Provider value={value}>
  <div className="emotion-controls" style={{'--emotion-color':emotionColors[emotion]} as CSSProperties}>
   <div className="emotion-controls-row">
    <CheckboxField><Checkbox checked={nrc} onChange={setNrc} aria-label="NRC underlines"/><Label><span className="nrc-legend">NRC underlines</span></Label></CheckboxField>
    <CheckboxField><Checkbox checked={jev} onChange={setJev} disabled={!!metadata&&!metadata.jevAvailable} aria-label="JEV highlights"/><Label><span className="jev-legend">JEV highlights</span></Label></CheckboxField>
    <Field className="emotion-picker"><Label className="sr-only">Emotion</Label><Select aria-label="Emotion" value={emotion} onChange={e=>{setEmotion(e.target.value as ReadingEmotion);setFeedback('');}}>{readingEmotions.map(e=><option key={e} value={e}>{label(e)}</option>)}</Select></Field>
   </div>
   <div className="emotion-note">Dictionary words · JEV sentence suggestions · No character attribution</div>
   <div className="emotion-status" role="status" aria-live="polite">{loadError||(!metadata?'Loading emotion vocabulary…':!metadata.jevAvailable?'JEV is not configured on this server. NRC is available.':!jev?'JEV paused.':'')}{metadata&&jev&&metadata.jevAvailable&&(pending?'Analysing nearby sentences…':'JEV analyses as you scroll. Click a marked sentence to inspect.')}</div>
   {errors.length>0&&jev&&<div className="emotion-error"><span>{errors[0].error}</span><Button plain onClick={()=>{for(const [id,r] of cache.current)if(r.status==='error')cache.current.delete(id);setRetry(v=>v+1);setRevision(v=>v+1);}}>Retry analysis</Button></div>}
   {selected&&metadata&&<div className="emotion-inspector" role="region" ref={inspector} tabIndex={-1} aria-label="Emotion inspection" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeInspector();}}}>
    <div className="flex items-center justify-between gap-3"><strong>{label(emotion)} · selected sentence</strong><button aria-label="Close emotion inspection" onClick={closeInspector} className="underline underline-offset-4">Close</button></div>
    <p>NRC: {lexicalRanges(selected.target,metadata.lexicon,emotion).map(r=>selected.target.slice(r.start,r.end)).join(', ')||'No matching words'}.</p>
    <p>JEV: {selectionResult?.status==='error'?'Analysis failed.':selectionResult?.status==='pending'?'Analysing…':selectionResult?.status==='complete'?(selectedHighlight?'Sentence-level suggestion; not extracted evidence.':'No suggestion at the current threshold; this does not establish absence.'):'Not analysed yet.'}</p>
    {selectedHighlight&&<><div className="emotion-feedback">{verdicts.map(v=><button key={v} onClick={()=>saveFeedback(v)}>{v}</button>)}</div><p role="status">{feedback||'Feedback is saved only on this device.'}</p></>}
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
function Sentence({sentence:s,plan,ctx}:{sentence:ReadingSentence;plan:ReadingPlan;ctx:Context}){
 const result=ctx.results.get(s.id),highlight=!!(ctx.jev&&result?.scores&&result.scores[ctx.emotion]>=ctx.metadata!.threshold);
 const ranges=ctx.nrc?lexicalRanges(s.target,ctx.metadata!.lexicon,ctx.emotion):[];
 const emphasis=plan.emphasis.filter(r=>r.start<s.end&&r.end>s.start).map(r=>({start:Math.max(r.start-s.start,0),end:Math.min(r.end-s.start,s.target.length)}));
 const bounds=[...new Set([0,s.target.length,...ranges.flatMap(r=>[r.start,r.end]),...emphasis.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
 const actionable=highlight||ranges.length>0;
 return <span data-emotion-id={s.id} data-jev-highlight={highlight||undefined} className={`emotion-sentence ${highlight?'emotion-background':''}`} style={{'--emotion-color':emotionColors[ctx.emotion]} as CSSProperties}
  role={actionable?'button':undefined} tabIndex={actionable?0:undefined} aria-label={actionable?`${label(ctx.emotion)}: ${highlight?'JEV sentence suggestion. ':''}${ranges.length?'NRC vocabulary match. ':''}${s.target}`:undefined}
  title={actionable?`${label(ctx.emotion)} · ${highlight?'JEV sentence-level suggestion':'NRC word association'} · Click to inspect`:undefined}
  onClick={e=>{if(actionable)ctx.inspect(s,e.currentTarget);}} onKeyDown={e=>{if(actionable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();ctx.inspect(s,e.currentTarget);}}}>
  {bounds.slice(0,-1).map((start,i)=>{const end=bounds[i+1],text=s.target.slice(start,end),underlined=ranges.some(r=>r.start<=start&&r.end>=end),italic=emphasis.some(r=>r.start<=start&&r.end>=end);const part=italic?<em>{text}</em>:text;return underlined?<span key={start} className="emotion-underline" title={`NRC: ${ctx.emotion}-associated vocabulary`}>{part}</span>:<span key={start}>{part}</span>;})}
 </span>;
}
