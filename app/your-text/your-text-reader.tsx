'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {Button} from '../../src/catalyst/typescript/button';
import PlainTextEditor,{type Mark} from './plain-text-editor';
import {customSentences,customTextLimit,type CustomTextDocument,type CustomTextSummary} from '../../src/lib/custom-text';
import {emotionColors,emotionalityForThreshold,emotionalityLabel,emotionalityScale,readingEmotions,readingRequestConcurrency,readingThreshold,thresholdForEmotionality,validEmotionScores,type EmotionScores,type ReadingEmotion} from '../../src/lib/reading-emotions';
import {signOut} from '../auth/actions';

type Result={status:'pending'|'complete'|'error';scores?:EmotionScores;error?:string};
type User={id:string;name:string}|null;
const draftKey='jev-your-text-draft';
const label=(s:string)=>s[0].toUpperCase()+s.slice(1);
async function responseJson(response:Response){const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Request failed.'),{status:response.status});return data;}
export default function YourTextReader({user,jevAvailable}:{user:User;jevAvailable:boolean}){
 const [title,setTitle]=useState('Untitled text'),[body,setBody]=useState(''),[id,setId]=useState<string|null>(null),[revision,setRevision]=useState<number|null>(null);
 const [conflict,setConflict]=useState(false);
 const [texts,setTexts]=useState<CustomTextSummary[]>([]),[ready,setReady]=useState(false),[saveStatus,setSaveStatus]=useState('');
 const [visible,setVisible]=useState<{from:number;to:number}[]>([]),[cursor,setCursor]=useState(0);
 const [guestReady,setGuestReady]=useState(!!user);
 const [limitError,setLimitError]=useState('');
 const [results,setResults]=useState<Map<string,Result>>(()=>new Map()),[error,setError]=useState(''),[quotaReached,setQuotaReached]=useState(false),[remaining,setRemaining]=useState<number|null>(null);
 const [dial,setDial]=useState(emotionalityForThreshold(readingThreshold)),[enabled,setEnabled]=useState<ReadingEmotion[]>([...readingEmotions]);
 const [controlsOpen,setControlsOpen]=useState(false),[overviewOpen,setOverviewOpen]=useState(false);
 const idRef=useRef(id),revisionRef=useRef(revision),titleRef=useRef(title),bodyRef=useRef(body),savedRef=useRef(''),savingRef=useRef<Promise<boolean>|null>(null);
 const cache=useRef(new Map<string,Result>()),active=useRef(new Map<string,AbortController>()),visibleRef=useRef(visible),sentencesRef=useRef(customSentences(body)),pumpRef=useRef<()=>void>(()=>{});
 idRef.current=id;revisionRef.current=revision;titleRef.current=title;bodyRef.current=body;
 const sentences=useMemo(()=>customSentences(body),[body]),threshold=thresholdForEmotionality(dial);
 sentencesRef.current=sentences;visibleRef.current=visible;
 const resetAnalysis=useCallback(()=>{for(const controller of active.current.values())controller.abort();active.current.clear();cache.current.clear();setResults(new Map());setError('');setQuotaReached(false);setRemaining(null);},[]);
 const install=(text:CustomTextDocument)=>{resetAnalysis();setConflict(false);setId(text.id);idRef.current=text.id;setRevision(text.revision);revisionRef.current=text.revision;setTitle(text.title);titleRef.current=text.title;setBody(text.body);bodyRef.current=text.body;savedRef.current=JSON.stringify([text.title,text.body]);setCursor(0);};
 const refreshList=async()=>{const data=await responseJson(await fetch('/api/user-texts',{cache:'no-store'}));setTexts(data.texts);return data.texts as CustomTextSummary[];};
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   let draft:{id:string|null;title:string;body:string;revision?:number}|null=null;
   try{const raw=sessionStorage.getItem(draftKey);if(raw)draft=JSON.parse(raw);}catch{}
   if(!user){if(!cancelled&&draft){setTitle(draft.title);setBody(draft.body);}if(!cancelled)setReady(true);return;}
   try{
    const list=await refreshList();if(cancelled)return;
    if(draft?.body.trim()&&!draft.id){
     const data=await responseJson(await fetch('/api/user-texts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:draft.title||'Untitled text',body:draft.body})}));
     if(cancelled)return;install(data.text);sessionStorage.removeItem(draftKey);await refreshList();
    }else if(draft?.id){
     const response=await fetch(`/api/user-texts/${draft.id}`,{cache:'no-store'});
     if(cancelled)return;
     if(response.status===404){setId(null);idRef.current=null;setRevision(null);revisionRef.current=null;setTitle(draft.title);setBody(draft.body);savedRef.current='';}
     else {
     const data=await responseJson(response);
     if(cancelled)return;install(data.text);
     if(draft.revision===data.text.revision){setTitle(draft.title);setBody(draft.body);}
     else if(draft.body!==data.text.body||draft.title!==data.text.title){setTitle(draft.title);setBody(draft.body);setConflict(true);setSaveStatus('This text changed in another tab. Choose which version to keep.');}
     }
    }else if(list[0]){
     const data=await responseJson(await fetch(`/api/user-texts/${list[0].id}`,{cache:'no-store'}));if(!cancelled)install(data.text);
    }
   }catch(e){if(!cancelled)setSaveStatus(e instanceof Error?e.message:'Could not load saved texts.');}
   if(!cancelled)setReady(true);
  })();return()=>{cancelled=true;};
 // Initial load only; the current editor owns later navigation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[user?.id]);
 useEffect(()=>{if(!ready)return;try{if(user&&id&&savedRef.current===JSON.stringify([title.trim()||'Untitled text',body]))sessionStorage.removeItem(draftKey);else sessionStorage.setItem(draftKey,JSON.stringify({id,title,body,revision}));}catch{}},[ready,id,title,body,revision,user]);
 useEffect(()=>{if(user)return;fetch('/api/custom-emotions',{cache:'no-store'}).then(responseJson).then(()=>setGuestReady(true)).catch(e=>setError(e instanceof Error?e.message:'Guest analysis is unavailable.'));},[user]);
 const saveNow=useCallback(async():Promise<boolean>=>{
  if(!user)return true;
  if(conflict)return false;
  if(savingRef.current)return savingRef.current;
  const run=async()=>{
   while(true){
    const snapshot={id:idRef.current,revision:revisionRef.current,title:titleRef.current.trim()||'Untitled text',body:bodyRef.current};
    if(!snapshot.id&&!snapshot.body.trim())return true;
    if(snapshot.id&&JSON.stringify([snapshot.title,snapshot.body])===savedRef.current)return true;
    setSaveStatus('Saving…');
    try{
     const endpoint=snapshot.id?`/api/user-texts/${snapshot.id}`:'/api/user-texts';
     const data=await responseJson(await fetch(endpoint,{method:snapshot.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,revision:snapshot.revision})}));
     const saved=data.text as CustomTextDocument;
     idRef.current=saved.id;revisionRef.current=saved.revision;setId(saved.id);setRevision(saved.revision);
     savedRef.current=JSON.stringify([snapshot.title,snapshot.body]);
     setTexts(old=>[ {id:saved.id,title:saved.title,revision:saved.revision,createdAt:saved.createdAt,updatedAt:saved.updatedAt},...old.filter(x=>x.id!==saved.id)]);
     if(titleRef.current===snapshot.title&&bodyRef.current===snapshot.body){setSaveStatus('Saved');try{sessionStorage.removeItem(draftKey);}catch{}return true;}
    }catch(e){if((e as {status?:number}).status===409)setConflict(true);setSaveStatus(e instanceof Error?e.message:'Could not save. Your draft remains in this tab.');return false;}
   }
  };
  const task=run();savingRef.current=task;try{return await task;}finally{savingRef.current=null;}
 },[user,conflict]);
 useEffect(()=>{if(!ready||!user)return;const timer=setTimeout(()=>{void saveNow();},750);return()=>clearTimeout(timer);},[ready,user,title,body,saveNow]);
 const openText=async(targetId:string)=>{
  if(targetId===idRef.current)return;
  if(!await saveNow())return;
  try{const data=await responseJson(await fetch(`/api/user-texts/${targetId}`,{cache:'no-store'}));install(data.text);setSaveStatus('Saved');}
  catch(e){setSaveStatus(e instanceof Error?e.message:'Could not open this text.');}
 };
 const newText=async()=>{if(!await saveNow())return;resetAnalysis();setConflict(false);setId(null);idRef.current=null;setRevision(null);revisionRef.current=null;setTitle('Untitled text');titleRef.current='Untitled text';setBody('');bodyRef.current='';savedRef.current='';setSaveStatus('New text');setCursor(0);};
 const removeText=async()=>{
  if(!id||!window.confirm(`Delete “${title}”? This cannot be undone.`))return;
  try{const response=await fetch(`/api/user-texts/${id}`,{method:'DELETE'});if(!response.ok)await responseJson(response);setTexts(old=>old.filter(x=>x.id!==id));resetAnalysis();setId(null);idRef.current=null;setRevision(null);revisionRef.current=null;setTitle('Untitled text');titleRef.current='Untitled text';setBody('');bodyRef.current='';savedRef.current='';setSaveStatus('Text deleted');}
  catch(e){setSaveStatus(e instanceof Error?e.message:'Could not delete this text.');}
 };
 const keepMyEdits=async()=>{
  if(!id)return;
  try{const data=await responseJson(await fetch(`/api/user-texts/${id}`,{cache:'no-store'}));revisionRef.current=data.text.revision;setRevision(data.text.revision);setConflict(false);setSaveStatus('Saving your version…');}
  catch(e){setSaveStatus(e instanceof Error?e.message:'Could not check the saved version.');}
 };
 const onChange=(value:string)=>{setLimitError('');setBody(value);};
 const onVisible=(ranges:{from:number;to:number}[])=>setVisible(old=>JSON.stringify(old)===JSON.stringify(ranges)?old:ranges);
 pumpRef.current=()=>{
  if(!jevAvailable||!guestReady||quotaReached||document.visibilityState==='hidden'||!ready||(user&&!idRef.current))return;
  const nearby=sentencesRef.current.filter(s=>visibleRef.current.some(r=>s.start<=r.to&&s.end>=r.from));
  for(const sentence of nearby){
   if(active.current.size>=readingRequestConcurrency)break;
   if(cache.current.has(sentence.key))continue;
   const controller=new AbortController();active.current.set(sentence.key,controller);cache.current.set(sentence.key,{status:'pending'});setResults(new Map(cache.current));
   fetch('/api/custom-emotions',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({documentId:idRef.current,sentence:{target:sentence.target,precedingContext:sentence.precedingContext,followingContext:sentence.followingContext}})})
    .then(responseJson).then(data=>{
     if(!validEmotionScores(data.scores))throw Error('JEV returned incomplete scores.');
     cache.current.set(sentence.key,{status:'complete',scores:data.scores});if(typeof data.remaining==='number')setRemaining(data.remaining);
    }).catch(e=>{
     if(e.name==='AbortError')cache.current.delete(sentence.key);
     else {cache.current.set(sentence.key,{status:'error',error:e.message});setError(e.message);if(e.status===403)setQuotaReached(true);}
    }).finally(()=>{active.current.delete(sentence.key);setResults(new Map(cache.current));pumpRef.current();});
  }
 };
 useEffect(()=>{const timer=setTimeout(()=>pumpRef.current(),900);return()=>clearTimeout(timer);},[body,visible,id,ready,jevAvailable,guestReady]);
 useEffect(()=>{const listener=()=>pumpRef.current();document.addEventListener('visibilitychange',listener);return()=>document.removeEventListener('visibilitychange',listener);},[]);
 useEffect(()=>{return()=>{for(const c of active.current.values())c.abort();};},[]);
 const marks=useMemo<Mark[]>(()=>sentences.flatMap(s=>{const score=results.get(s.key)?.scores;const emotions=enabled.filter(e=>score&&score[e]>=threshold);return emotions.length?[{from:s.start,to:s.end,emotions}]:[];}),[sentences,results,enabled,threshold]);
 const complete=sentences.filter(s=>results.get(s.key)?.status==='complete');
 const current=sentences.find(s=>s.start<=cursor&&cursor<=s.end),currentEmotions=current?enabled.filter(e=>(results.get(current.key)?.scores?.[e]??0)>=threshold):[];
 const retry=()=>{for(const [key,result] of cache.current)if(result.status==='error')cache.current.delete(key);setError('');setResults(new Map(cache.current));pumpRef.current();};
 const defaultDial=emotionalityForThreshold(readingThreshold);
 const controls=<div className="emotion-controls"><div className="emotion-dial"><label className="emotion-dial-label" htmlFor="custom-emotion-dial">How emotional is JEV</label>
  <input id="custom-emotion-dial" className="emotion-dial-input" type="range" min={0} max={100} step={emotionalityScale.step} value={dial} disabled={!jevAvailable} aria-valuetext={`${emotionalityLabel(dial)}; JEV highlights from ${threshold.toFixed(2)}`} onChange={e=>setDial(Number(e.target.value))}/>
  <p className="emotion-dial-readout">{emotionalityLabel(dial)} · JEV highlights from {threshold.toFixed(2)}{dial!==defaultDial&&<> · <button type="button" onClick={()=>setDial(defaultDial)}>Reset to {readingThreshold.toFixed(2)}</button></>}</p></div>
  <div className="emotion-picker" role="group" aria-label="Visible emotions">{readingEmotions.map(e=><button type="button" key={e} className="emotion-toggle" aria-label={label(e)} aria-pressed={enabled.includes(e)} style={{'--emotion-color':emotionColors[e]} as CSSProperties} onClick={()=>setEnabled(old=>readingEmotions.filter(x=>x===e?!old.includes(x):old.includes(x)))}><span className="emotion-circle" aria-hidden="true"/><span className="emotion-tooltip" aria-hidden="true">{label(e)}</span></button>)}</div>
  {!jevAvailable&&<p className="text-xs text-muted">JEV is unavailable on this server.</p>}
  {enabled.length===0&&<p className="emotion-note">All emotions hidden. Enable a circle to show highlights.</p>}
 </div>;
 return <div className="custom-page"><a href="#custom-editor" className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to your text</a><header className="custom-topbar"><span className="custom-mobile-title">Your text</span><div className="custom-top-actions"><Button outline aria-expanded={controlsOpen} aria-controls="custom-sidebar" aria-label={controlsOpen?'Close controls':'Controls'} className="px-2.5! py-1.5! text-xs!" onClick={()=>{setControlsOpen(v=>!v);setOverviewOpen(false);}}>{controlsOpen?'Close':'Controls'}</Button><Button outline aria-expanded={overviewOpen} aria-controls="custom-overview" aria-label={overviewOpen?'Close overview':'Overview'} className="px-2.5! py-1.5! text-xs!" onClick={()=>{setOverviewOpen(v=>!v);setControlsOpen(false);}}>{overviewOpen?'Close':'Overview'}</Button></div></header>
 <div className="custom-layout">
  <aside id="custom-sidebar" className={`custom-sidebar ${controlsOpen?'is-open':''}`} aria-label="Your texts and reading controls"><div className="custom-sidebar-content"><div className="custom-sidebar-intro"><h1>Your text</h1><p>Read your own writing with JEV</p><nav aria-label="Reader sections"><Link href="/">Book library</Link><span aria-hidden="true">/</span><strong>Your text</strong></nav></div><div className="custom-sidebar-heading"><h2>My texts</h2>{user&&<button type="button" onClick={()=>void newText()}>New text</button>}</div>
   {user?<><p className="custom-account-name">{user.name}</p>{texts.length?<nav aria-label="Saved texts" className="custom-text-list">{texts.map(item=><button type="button" key={item.id} aria-current={item.id===id?'page':undefined} onClick={()=>void openText(item.id)}><span>{item.title}</span><small>{new Date(item.updatedAt).toLocaleDateString()}</small></button>)}</nav>:<p className="custom-side-note">Your saved texts will appear here.</p>}<form action={signOut}><button type="submit" className="custom-inline-link">Sign out</button></form></>:<><p className="custom-side-note">Write freely. Sign in to keep this text and read it later.</p><div className="custom-account-actions"><Link className="custom-sign-in" href="/auth/sign-in">Sign in to save</Link><Link className="custom-inline-link" href="/auth/sign-up">Create an account</Link></div>{remaining!==null&&<p className="custom-side-note">{remaining} guest JEV calls left</p>}</>}
   <div className="custom-side-divider"/><h2 className="custom-control-heading">Emotion controls</h2>{controls}<p className="custom-side-note">Hover a highlight or move the cursor into a sentence to see its emotions. JEV sends each visible sentence and its neighbors for classification. Suggestions describe associations, not intensity or who feels them.</p>
  </div></aside>
  <main id="custom-editor" className="custom-main"><div className="custom-document-header"><input aria-label="Text title" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} className="custom-title"/><div className="custom-document-meta"><span>{body.length.toLocaleString()} / {customTextLimit.toLocaleString()} characters</span><span role="status">{!ready?'Opening…':user?saveStatus||'Saved':'Guest draft · this tab'}</span>{user&&id&&<button type="button" onClick={()=>void removeText()}>Delete text</button>}</div>{limitError&&<p className="custom-limit-error" role="alert">{limitError}</p>}</div>
   <div className="custom-writing-surface"><PlainTextEditor value={body} marks={marks} onChange={onChange} onVisible={onVisible} onCursor={setCursor} onLimit={()=>setLimitError('Your text can be up to 20,000 characters. Shorten it before pasting.')}/>{!body&&<p className="custom-empty-hint">Paste a story or start writing here. JEV will analyse sentences as you scroll.</p>}</div>
   {current&&<p className="custom-current" aria-live="polite">At cursor: {results.get(current.key)?.status==='complete'?(currentEmotions.length?currentEmotions.map(label).join(', '):'No enabled emotion above the current threshold'):'Not analysed yet'}</p>}
   {quotaReached&&<div className="custom-alert" role="alert">Your 1,000 guest classifications are used. <Link href="/auth/sign-in">Sign in to continue</Link>; your text will carry over.</div>}
   {conflict&&<div className="custom-alert" role="alert">Your saved text changed elsewhere. <button type="button" onClick={()=>void keepMyEdits()}>Keep my edits</button> or <button type="button" onClick={()=>{if(id)void fetch(`/api/user-texts/${id}`).then(responseJson).then(data=>{install(data.text);sessionStorage.removeItem(draftKey);setSaveStatus('Loaded saved version');}).catch(()=>setSaveStatus('Could not load the saved version.'));}}>Load saved version</button>.</div>}
   {error&&!quotaReached&&<div className="custom-alert" role="alert">{error} <button type="button" onClick={retry}>Retry nearby sentences</button></div>}
  </main>
  <aside id="custom-overview" className={`custom-overview ${overviewOpen?'is-open':''}`} aria-label="Emotion overview"><div className="custom-overview-content"><h2>Emotion overview</h2><p className="custom-overview-count" aria-live="polite">{complete.length} of {sentences.length} sentences analysed</p><div className="progress-track" role="img" aria-label={`${complete.length} of ${sentences.length} sentences analysed`}><div className="progress-fill" style={{width:`${sentences.length?complete.length/sentences.length*100:0}%`}}/></div><p className="custom-overview-note">Among analysed sentences at the current threshold. Emotions can overlap.</p>
   <div className="custom-bars">{readingEmotions.map(e=>{const count=complete.filter(s=>(results.get(s.key)?.scores?.[e]??0)>=threshold).length,percent=complete.length?count/complete.length*100:0;return <div key={e} className="custom-bar-row"><div><span className="custom-bar-label"><i style={{backgroundColor:emotionColors[e]}}/>{label(e)}</span><span className="custom-bar-number">{count} / {complete.length}</span></div><div className="custom-bar-track"><span style={{width:`${percent}%`,backgroundColor:emotionColors[e]}}/></div></div>;})}</div>
   <p className="custom-overview-note">Scroll through the text to complete the picture. Unmarked text may be unanalysed or below the threshold.</p>
  </div></aside>
 </div></div>;
}
