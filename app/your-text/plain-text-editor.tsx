'use client';
import {useEffect,useRef} from 'react';
import {EditorState,StateEffect,StateField} from '@codemirror/state';
import {closeHoverTooltips,Decoration,EditorView,hoverTooltip,tooltips,type DecorationSet} from '@codemirror/view';
import {emotionColors,type ReadingEmotion} from '../../src/lib/reading-emotions';
import {customTextLimit} from '../../src/lib/custom-text';

export type Mark={from:number;to:number;emotions:ReadingEmotion[]};
const setMarks=StateEffect.define<DecorationSet>();
const markField=StateField.define<DecorationSet>({
 create:()=>Decoration.none,
 update(value,transaction){
  let next=value.map(transaction.changes);
  for(const effect of transaction.effects)if(effect.is(setMarks))next=effect.value;
  return next;
 },
 provide:field=>EditorView.decorations.from(field),
});
function bands(emotions:ReadingEmotion[]){return `linear-gradient(to bottom,${emotions.flatMap((e,i)=>{const color=`${emotionColors[e]}30`;return [`${color} ${i/emotions.length*100}%`,`${color} ${(i+1)/emotions.length*100}%`];}).join(',')})`;}
function decorations(marks:Mark[]):DecorationSet{
 return Decoration.set(marks.filter(m=>m.to>m.from).map(m=>Decoration.mark({class:'custom-emotion-mark',attributes:{'data-jev-highlight':m.emotions.join(' '),style:`background-image:${bands(m.emotions)}`}}).range(m.from,m.to)),true);
}
export default function PlainTextEditor({value,marks,onChange,onVisible,onCursor,onLimit}:{value:string;marks:Mark[];onChange:(value:string)=>void;onVisible:(ranges:{from:number;to:number}[])=>void;onCursor:(position:number)=>void;onLimit:()=>void}){
 const host=useRef<HTMLDivElement>(null),view=useRef<EditorView|null>(null);
 const marksRef=useRef(marks);marksRef.current=marks;
 const callbacks=useRef({onChange,onVisible,onCursor,onLimit});callbacks.current={onChange,onVisible,onCursor,onLimit};
 useEffect(()=>{
  if(!host.current)return;
  let frame=0;
  const viewport=(editor:EditorView)=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const box=editor.scrollDOM.getBoundingClientRect();if(!box.height)return;
    // visibleRanges can include an entire wrapped paragraph. Pixel positions keep
    // on-scroll model calls tied to what the reader can actually see.
    const from=editor.posAtCoords({x:box.left+12,y:box.top+3},false);
    const to=editor.posAtCoords({x:box.right-18,y:box.bottom-3},false);
    callbacks.current.onVisible([{from:Math.min(from,to),to:Math.max(from,to)}]);
   });
  };
  const editor=new EditorView({parent:host.current,state:EditorState.create({doc:value,extensions:[
   markField,EditorView.lineWrapping,
   tooltips({parent:document.body}),
   hoverTooltip((editor,position)=>{
    const mark=marksRef.current.find(item=>item.from<=position&&position<item.to);
    if(!mark)return null;
    return {pos:mark.from,end:mark.to,above:true,create(view){
     const dom=document.createElement('div');dom.className='custom-emotion-tooltip';dom.setAttribute('role','tooltip');
     dom.setAttribute('aria-label',`JEV suggests: ${mark.emotions.map(e=>e[0].toUpperCase()+e.slice(1)).join(', ')}`);
     for(const emotion of mark.emotions){const chip=document.createElement('span');chip.className='emotion-hint-item';chip.style.backgroundColor=emotionColors[emotion];chip.textContent=emotion[0].toUpperCase()+emotion.slice(1);dom.append(chip);}
     return {dom,getCoords:()=>view.coordsAtPos(position)??view.dom.getBoundingClientRect()};
    }};
   },{hoverTime:160}),
   EditorState.transactionFilter.of(transaction=>{if(transaction.newDoc.length<=customTextLimit)return transaction;callbacks.current.onLimit();return []; }),EditorView.updateListener.of(update=>{
   if(update.docChanged){
    callbacks.current.onChange(update.state.doc.toString());
    if(update.startState.doc.length===0&&update.state.doc.length>500)requestAnimationFrame(()=>{if(view.current!==update.view)return;update.view.dispatch({selection:{anchor:0}});update.view.scrollDOM.scrollTop=0;viewport(update.view);});
   }
   if(update.docChanged||update.viewportChanged)viewport(update.view);
   if(update.selectionSet||update.docChanged)callbacks.current.onCursor(update.state.selection.main.head);
  })]})});
  view.current=editor;
  const onScroll=()=>viewport(editor);editor.scrollDOM.addEventListener('scroll',onScroll,{passive:true});
  viewport(editor);
  return()=>{editor.scrollDOM.removeEventListener('scroll',onScroll);cancelAnimationFrame(frame);editor.destroy();view.current=null;};
 // The editor owns its DOM for this text. Parent updates dispatch through the effect below.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{const editor=view.current;if(editor&&editor.state.doc.toString()!==value)editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:value}});},[value]);
 useEffect(()=>{view.current?.dispatch({effects:[setMarks.of(decorations(marks)),closeHoverTooltips]});},[marks]);
 return <div ref={host} className="custom-editor" aria-label="Your text"/>;
}
