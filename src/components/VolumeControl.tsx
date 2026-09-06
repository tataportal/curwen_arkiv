'use client';
import {useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Volume2,VolumeX} from 'lucide-react';
import {getPreviewVolume,setPreviewVolume,subscribePreviewVolume,togglePreviewSound} from '@/lib/preview-volume';
export default function VolumeControl({floating=true}:{floating?:boolean}){
 const volume=useSyncExternalStore(subscribePreviewVolume,getPreviewVolume,()=>100);
 const [open,setOpen]=useState(false),[mounted,setMounted]=useState(false);
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 const Icon=volume===0?VolumeX:Volume2;
 const control=<div ref={root} className={'volume-control '+(floating?'is-floating':'is-inline')} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);button.current?.focus();}}}>
  <button ref={button} className="volume-trigger" aria-label="Volumen general" aria-expanded={open} aria-controls={id} title="Volumen general" onClick={()=>setOpen(v=>!v)}><Icon size={17} aria-hidden="true"/></button>
  {open&&<div className="volume-panel" id={id}>
   <div className="volume-label"><label htmlFor={id+'-range'}>Volumen</label><output htmlFor={id+'-range'}>{volume}%</output></div>
   <div className="volume-slider"><button aria-label={volume===0?'Activar sonido':'Silenciar previews'} onClick={togglePreviewSound}><Icon size={16} aria-hidden="true"/></button>
    <input id={id+'-range'} type="range" min="0" max="100" step="1" value={volume} onChange={e=>setPreviewVolume(Number(e.target.value))}/>
   </div>
  </div>}
 </div>;
 return floating?(mounted?createPortal(control,document.body):null):control;
}
