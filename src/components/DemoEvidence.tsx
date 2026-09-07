'use client';

import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {DemoSelection} from './DemoNetwork';
import {demoOccurrence} from '@/lib/commercial-demo';
import VideoPreview from './VideoPreview';
import {insidePreviewBuffer,PREVIEW_LEAVE_DELAY_MS} from '@/lib/preview-buffer';
import {buildYouTubeTimestampUrl,evidenceStartSeconds,formatTimestamp} from '@/lib/utils';

export default function DemoEvidence({selection,onClose,onExpand,onMoments}:{selection:DemoSelection;onClose:()=>void;onExpand:()=>void;onMoments:()=>void}) {
 const card=useRef<HTMLDivElement>(null),leave=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [position,setPosition]=useState({left:24,top:120}),[index,setIndex]=useState(0);
 const moment=selection.items[index]??selection.items[0];
 const expanded=selection.expanded;
 const restoreFocus=useRef<Element|null>(null);
 useLayoutEffect(()=>{
  const place=()=>{const width=card.current?.offsetWidth??380,height=card.current?.offsetHeight??300,a=selection.anchor;
   const left=a.right+18+width<innerWidth-16?a.right+18:a.left-width-18;
   setPosition({left:Math.max(16,Math.min(innerWidth-width-16,left)),top:Math.max(16,Math.min(innerHeight-height-16,a.top-32))});};
  place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);
 },[selection.anchor,expanded]);
 useEffect(()=>{
  if(expanded)return;
  const move=(e:PointerEvent)=>{if(e.pointerType==='touch'||!card.current)return;
   if((e.target as HTMLElement).closest?.('.volume-control')||insidePreviewBuffer(e.clientX,e.clientY,selection.anchor,card.current.getBoundingClientRect())||card.current.contains(document.activeElement)){if(leave.current)clearTimeout(leave.current);leave.current=null;}
   else if(!leave.current)leave.current=setTimeout(onClose,PREVIEW_LEAVE_DELAY_MS);
  };
  const scroll=()=>onClose();document.addEventListener('pointermove',move);window.addEventListener('scroll',scroll,{passive:true});
  return()=>{document.removeEventListener('pointermove',move);window.removeEventListener('scroll',scroll);if(leave.current)clearTimeout(leave.current);leave.current=null;};
 },[selection.anchor,expanded,onClose]);
 useEffect(()=>{
  if(!expanded)return;
  restoreFocus.current=document.activeElement;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  card.current?.querySelector<HTMLButtonElement>('[aria-label="Cerrar preview"]')?.focus({preventScroll:true});
  return()=>{document.body.style.overflow=overflow;(restoreFocus.current as HTMLElement|null)?.focus?.({preventScroll:true});};
 },[expanded]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 if(!moment)return null;
 const timestamp=buildYouTubeTimestampUrl(moment.episode.videoId,evidenceStartSeconds(demoOccurrence(moment).cue_start_seconds));
 return createPortal(<><div className={'demo-preview-scrim'+(expanded?' is-expanded':'')} onClick={onClose} aria-hidden="true"/>
  <div ref={card} role="dialog" aria-modal={expanded||undefined} aria-label={'Preview: '+selection.label} className={'demo-evidence'+(expanded?' is-expanded':'')} style={expanded?undefined:position} onKeyDown={e=>{if(!expanded||e.key!=='Tab')return;const focusable=card.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input');if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}} onClickCapture={e=>{if(!expanded&&(e.target as HTMLElement).closest('.preview-video-link')){e.preventDefault();e.stopPropagation();onExpand();}}}>
   <header><span>{selection.label}</span><button onClick={onClose} aria-label="Cerrar preview">×</button></header>
   <VideoPreview continuous key={demoOccurrence(moment).occurrenceId} youtubeId={moment.episode.videoId} occurrence={demoOccurrence(moment)} title={moment.title}/>
   <div className="demo-evidence-copy">
    <div className="demo-evidence-title"><a className="demo-timestamp" data-cue-start-seconds={demoOccurrence(moment).cue_start_seconds} href={timestamp} target="_blank" rel="noopener noreferrer">{formatTimestamp(demoOccurrence(moment).cue_start_seconds)} ↗</a><h2><button onClick={onExpand}>{moment.selectedEvidence?'«'+moment.selectedEvidence.quote+'»':moment.title}</button></h2></div>
    {moment.selectedEvidence&&<p className="demo-note">{moment.selectedEvidence.anchorType==='concept-mention'?'Mención de ':'Cita sobre '}{moment.selectedEvidence.label} · {moment.title}</p>}
    {!expanded&&<button className="demo-preview-hint" onClick={onExpand}>Clic en el video para ampliar ↗</button>}
    {expanded&&<p className="demo-note">Video desde {formatTimestamp(evidenceStartSeconds(demoOccurrence(moment).cue_start_seconds))} · hasta 3 s antes de la mención. Los resúmenes y el contexto están en los momentos de abajo.</p>}
    <div className="demo-evidence-actions"><button className="text-action" onClick={onMoments}>Ver {selection.items.length} {selection.items.length===1?'momento':'momentos'} ↓</button>{expanded&&selection.items.length>1&&<div><button aria-label="Momento anterior" disabled={index===0} onClick={()=>{setIndex(index-1);}}>←</button><span>{index+1} / {selection.items.length}</span><button aria-label="Momento siguiente" disabled={index===selection.items.length-1} onClick={()=>{setIndex(index+1);}}>→</button></div>}</div>
   </div>
  </div></>,document.body);
}
