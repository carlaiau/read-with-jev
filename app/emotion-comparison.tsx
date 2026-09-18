'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {loadLibraryDocument} from '../src/lib/library-transport';
import {readingEmotions,readingRequestConcurrency,readingScrollDelayMs,emotionColors,emotionalityForThreshold,emotionalityLabel,emotionalityScale,lexicalRanges,readingThreshold,thresholdForEmotionality,validEmotionScores,type ReadingEmotion,type EmotionMetadata,type EmotionScores,type ReadingPlan,type ReadingSentence} from '../src/lib/reading-emotions';
import {Checkbox,CheckboxField} from '../src/catalyst/typescript/checkbox';
import {Label} from '../src/catalyst/typescript/fieldset';
import {Button} from '../src/catalyst/typescript/button';
type Result={status:'pending'|'complete'|'error';scores?:EmotionScores;error?:string};
type Context={metadata:EmotionMetadata|null;emotions:ReadingEmotion[];nrc:boolean;jev:boolean;threshold:number;results:Map<string,Result>};
const Comparison=createContext<Context|null>(null);
const Controls=createContext<ReactNode>(null);
export function EmotionControls(){return useContext(Controls);}
const label=(s:string)=>s[0].toUpperCase()+s.slice(1);
export function EmotionComparison({layer,children,ready}:{layer:string;children:ReactNode;ready:boolean}){
 const [metadata,setMetadata]=useState<EmotionMetadata|null>(null),[loadError,setLoadError]=useState('');
 const [emotions,setEmotions]=useState<ReadingEmotion[]>([...readingEmotions]),[nrc,setNrc]=useState(false);
 const jev=!!metadata?.jevAvailable;
 // null keeps the reader on whatever default threshold this edition reports until the slider is moved.
 const [emotionality,setEmotionality]=useState<number|null>(null);
 const defaultThreshold=metadata?.threshold??readingThreshold,defaultEmotionality=emotionalityForThreshold(defaultThreshold);
 const dial=emotionality??defaultEmotionality,threshold=emotionality===null?defaultThreshold:thresholdForEmotionality(emotionality);
 const cache=useRef(new Map<string,Result>()),[revision,setRevision]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();loadLibraryDocument<EmotionMetadata>(`/api/emotions?layer=${encodeURIComponent(layer)}`,c.signal).then(d=>{setMetadata(d);}).catch(e=>{if(e.name!=='AbortError')setLoadError(e.message);});return()=>c.abort();},[layer]);
 useEffect(()=>{
  if(!metadata||!jev||!metadata.jevAvailable||!ready)return;
  let stopped=false,active=0,timer:ReturnType<typeof setTimeout>|undefined;const nearby=new Set<string>(),controllers=new Map<string,AbortController>();
  const bump=()=>setRevision(v=>v+1);
  function pump(){
   if(stopped||document.visibilityState==='hidden')return;
   for(const id of nearby){
    if(active>=readingRequestConcurrency)break;if(cache.current.has(id))continue;
    const c=new AbortController();controllers.set(id,c);active++;cache.current.set(id,{status:'pending'});bump();
    fetch('/api/emotions',{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify({layer,sourceKey:metadata!.sourceKey,sentenceId:id})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(d.sentenceId!==id||!validEmotionScores(d.scores))throw new Error('JEV returned incomplete scores.');return d.scores as EmotionScores;}).then(scores=>{if(!stopped)cache.current.set(id,{status:'complete',scores});}).catch(e=>{if(!stopped&&e.name!=='AbortError')cache.current.set(id,{status:'error',error:e.message});}).finally(()=>{active--;controllers.delete(id);if(!stopped){bump();pump();}});
   }
  }
  const observer=new IntersectionObserver(entries=>{for(const e of entries){const id=(e.target as HTMLElement).dataset.emotionId!;if(e.isIntersecting)nearby.add(id);else nearby.delete(id);}clearTimeout(timer);timer=setTimeout(pump,readingScrollDelayMs);},{rootMargin:'160px 0px'});
  document.querySelectorAll('[data-emotion-id]').forEach(el=>observer.observe(el));
  document.addEventListener('visibilitychange',pump);
  return()=>{stopped=true;observer.disconnect();clearTimeout(timer);document.removeEventListener('visibilitychange',pump);for(const [id,c] of controllers){c.abort();cache.current.delete(id);}};
 },[metadata,jev,layer,retry,ready]);
 const pending=[...cache.current.values()].filter(r=>r.status==='pending').length,errors=[...cache.current.values()].filter(r=>r.status==='error');
 const value=useMemo(()=>({metadata,emotions,nrc,jev,threshold,results:cache.current}),[metadata,emotions,nrc,jev,threshold,revision]);
 const controls=<div className="emotion-controls">
   <div className="emotion-dial">
    <label className="emotion-dial-label" htmlFor="emotion-dial">How emotional is JEV</label>
    <input id="emotion-dial" className="emotion-dial-input" type="range" min={0} max={100} step={emotionalityScale.step} value={dial}
     disabled={!!metadata&&!metadata.jevAvailable}
     aria-valuetext={`${emotionalityLabel(dial)}; JEV highlights from ${threshold.toFixed(2)}`}
     onChange={e=>setEmotionality(Number(e.target.value))}/>
    <p className="emotion-dial-readout">{emotionalityLabel(dial)} · JEV highlights from {threshold.toFixed(2)}{dial!==defaultEmotionality&&<> · <button type="button" onClick={()=>setEmotionality(null)}>Reset to {defaultThreshold.toFixed(2)}</button></>}</p>
   </div>
   <div className="emotion-picker" role="group" aria-label="Visible emotions">{readingEmotions.map(e=><button key={e} type="button" className="emotion-toggle" aria-label={label(e)} aria-pressed={emotions.includes(e)} style={{'--emotion-color':emotionColors[e]} as CSSProperties} onClick={()=>setEmotions(current=>readingEmotions.filter(item=>item===e?!current.includes(item):current.includes(item)))}><span className="emotion-circle" aria-hidden="true"/><span className="emotion-tooltip" aria-hidden="true">{label(e)}</span></button>)}</div>
   {emotions.length===0&&<p className="emotion-note">All emotions hidden. Enable a circle to show its highlights.</p>}
   <div className="emotion-controls-row">
    <CheckboxField><Checkbox checked={nrc} onChange={setNrc} aria-label="NRC underlines"/><Label><span className="emotion-legend"><span className="nrc-legend">NRC underlines</span><span className="emotion-tooltip" aria-hidden="true">NRC Emotion Lexicon: a fixed dictionary of word-to-emotion associations. It underlines single words whatever the context, negation or speaker.</span></span></Label></CheckboxField>
    <span className="emotion-legend"><span className="jev-legend">JEV highlights</span><span className="emotion-tooltip" aria-hidden="true">{metadata?.model??'JEV'} scores every nearby sentence for all eight emotions. Sentences at or above the dial threshold are highlighted; the layer itself stays on.</span></span>
   </div>
   <div className="emotion-status" role="status" aria-live="polite">{loadError||(!metadata?'Loading emotion vocabulary…':!metadata.jevAvailable?'JEV is not configured on this server. NRC underlines are still available.':'')}{metadata&&jev&&(pending?'Analysing nearby sentences…':'JEV analyses as you scroll. Hover a marked sentence for its emotions.')}</div>
   {errors.length>0&&jev&&<div className="emotion-error"><span>{errors[0].error}</span><Button plain onClick={()=>{for(const [id,r] of cache.current)if(r.status==='error')cache.current.delete(id);setRetry(v=>v+1);setRevision(v=>v+1);}}>Retry analysis</Button></div>}
  </div>;
 return <Comparison.Provider value={value}><Controls.Provider value={controls}>{children}</Controls.Provider></Comparison.Provider>;
}
export function EmotionText({passageId,fallback}:{passageId:string;fallback:ReactNode}){
 const ctx=useContext(Comparison),plan=ctx?.metadata?.plans.find(p=>p.id===passageId);
 if(!ctx||!plan||!ctx.metadata)return <>{fallback}</>;
 return <>{plan.sentences.map(s=><Sentence key={s.id} sentence={s} plan={plan} ctx={ctx}/>)}</>;
}
// Bands preserve every enabled association when several emotions share a span.
function bands(emotions:ReadingEmotion[],background=false){return `linear-gradient(to ${background?'bottom':'right'}, ${emotions.flatMap((e,i)=>{const color=background?`${emotionColors[e]}30`:emotionColors[e];return [`${color} ${i/emotions.length*100}%`,`${color} ${(i+1)/emotions.length*100}%`];}).join(', ')})`;}
function Sentence({sentence:s,plan,ctx}:{sentence:ReadingSentence;plan:ReadingPlan;ctx:Context}){
 const result=ctx.results.get(s.id),highlights=ctx.jev?ctx.emotions.filter(e=>result?.scores&&result.scores[e]>=ctx.threshold):[];
 const ranges=ctx.nrc?ctx.emotions.flatMap(emotion=>lexicalRanges(s.target,ctx.metadata!.lexicon,emotion).map(r=>({...r,emotion}))):[];
 const emphasis=plan.emphasis.filter(r=>r.start<s.end&&r.end>s.start).map(r=>({start:Math.max(r.start-s.start,0),end:Math.min(r.end-s.start,s.target.length)}));
 const bounds=[...new Set([0,s.target.length,...ranges.flatMap(r=>[r.start,r.end]),...emphasis.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
 const description=[highlights.length?`JEV sentence suggestions: ${highlights.map(label).join(', ')}.`:'',ranges.length?`NRC word associations: ${[...new Set(ranges.map(r=>r.emotion))].map(label).join(', ')}.`:''].filter(Boolean).join(' ');
 return <span data-emotion-id={s.id} data-jev-highlight={highlights.length?highlights.join(' '):undefined} className={`emotion-sentence ${highlights.length?'emotion-background':''}`} style={highlights.length?{backgroundImage:bands(highlights,true)}:undefined}
  tabIndex={highlights.length?0:undefined} aria-label={highlights.length?`${description} ${s.target}`:undefined}
  title={!highlights.length&&ranges.length?description:undefined}>
  {highlights.length>0&&<span className="emotion-hint" aria-hidden="true">
   {highlights.map(e=><span key={e} className="emotion-hint-item" style={{background:emotionColors[e]}}>{label(e)}</span>)}
  </span>}
  {bounds.slice(0,-1).map((start,i)=>{const end=bounds[i+1],text=s.target.slice(start,end),matches=[...new Set(ranges.filter(r=>r.start<=start&&r.end>=end).map(r=>r.emotion))],italic=emphasis.some(r=>r.start<=start&&r.end>=end);const part=italic?<em>{text}</em>:text;return matches.length?<span key={start} className="emotion-underline" data-nrc-emotions={matches.join(' ')} style={{backgroundImage:bands(matches)}} title={`NRC word associations: ${matches.map(label).join(', ')}`}>{part}</span>:<span key={start}>{part}</span>;})}
 </span>;
}
