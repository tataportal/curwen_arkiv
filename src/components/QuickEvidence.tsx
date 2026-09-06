'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {EvidenceMoment} from '@/lib/evidence-presentation';
import VideoPreview from './VideoPreview';
import {insidePreviewBuffer} from '@/lib/preview-buffer';
import {TimestampLink} from './ArchivePrimitives';
export type PreviewAnchor={left:number;top:number;right:number;bottom:number};
export default function QuickEvidence({anchor,label,items,onClose,onEnter,onLeave,onMoments,onExplore,pinned=false}:{anchor:PreviewAnchor;label:string;items:EvidenceMoment[];onClose:()=>void;onEnter:()=>void;onLeave:()=>void;onMoments:()=>void;onExplore?:()=>void;pinned?:boolean}) {
  const card=useRef<HTMLDivElement>(null),[position,setPosition]=useState({left:12,top:120});
  useLayoutEffect(()=>{
    const place=()=>{const width=card.current?.offsetWidth||384,height=card.current?.offsetHeight||330;
      const left=anchor.right+16+width<innerWidth-12?anchor.right+16:anchor.left-width-16;
      setPosition({left:Math.max(12,Math.min(innerWidth-width-12,left)),top:Math.max(12,Math.min(innerHeight-height-12,anchor.top-60))});};
    place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);
  },[anchor,items.length]);
  useLayoutEffect(()=>{if(pinned)card.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});},[pinned]);
  useEffect(()=>{
    if(pinned)return;
    const move=(event:PointerEvent)=>{
      if(event.pointerType==='touch'||!card.current)return;
      if(insidePreviewBuffer(event.clientX,event.clientY,anchor,card.current.getBoundingClientRect()))onEnter();
      else if(!card.current.contains(document.activeElement))onLeave();
    };
    document.addEventListener('pointermove',move);
    return()=>document.removeEventListener('pointermove',move);
  },[anchor,pinned,onEnter,onLeave]);
  const first=items[0];
  return createPortal(<div ref={card} role="dialog" aria-label={'Preview: '+label} className="quick-evidence" data-occurrence-id={items[0]?.occurrence.occurrenceId} data-cue-start-seconds={items[0]?.occurrence.cue_start_seconds} style={position} onPointerEnter={onEnter} onPointerLeave={onLeave} onFocus={onEnter} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
    <div className="quick-evidence-heading"><span>{label}</span><button aria-label="Cerrar preview" onClick={onClose}>×</button></div>
    {first?<><VideoPreview continuous key={first.id} youtubeId={first.youtubeId} occurrence={first.occurrence} title={first.title}/><div className="quick-caption"><TimestampLink youtubeId={first.youtubeId} seconds={first.occurrence.cue_start_seconds}/><p>{first.title}</p></div></>:<p className="quick-empty">Sin evidencia disponible para esta selección.</p>}
    <div className="quick-actions">{items.length>0&&<button className="text-action" onClick={onMoments}>Ver {items.length} {items.length===1?'momento':'momentos'} ↗</button>}{onExplore&&<button className="text-action" onClick={onExplore}>Explorar concepto →</button>}</div>
  </div>,document.body);
}
