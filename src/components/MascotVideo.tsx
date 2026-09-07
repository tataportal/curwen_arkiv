'use client';

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {getPreviewVolume,subscribePreviewVolume} from '@/lib/preview-volume';
import VolumeControl from './VolumeControl';

export default function MascotVideo({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),video=useRef<HTMLVideoElement>(null);
 const [blocked,setBlocked]=useState(false),[failed,setFailed]=useState(false);
 const src=(process.env.NEXT_PUBLIC_ASSET_BASE_PATH||'')+'/video/pelaogood-v1.mp4';
 useEffect(()=>{
  const modal=dialog.current,player=video.current;if(!modal||!player)return;let alive=true;
  player.src=src;
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';modal.showModal();
  const applyVolume=()=>{const volume=getPreviewVolume();player.volume=volume/100;player.muted=volume===0;};
  applyVolume();const unsubscribe=subscribePreviewVolume(applyVolume);
  void player.play().catch(()=>{if(alive)setBlocked(true);});
  return()=>{alive=false;unsubscribe();player.pause();player.removeAttribute('src');player.load();modal.close();document.body.style.overflow=overflow;previous?.focus({preventScroll:true});};
 },[src]);
 return createPortal(<dialog ref={dialog} className="mascot-video-dialog" aria-label="El pelao good" onCancel={e=>{e.preventDefault();onClose();}}>
  <button className="mascot-video-close" autoFocus aria-label="Cerrar video del pelao" onClick={onClose}>×</button>
  <VolumeControl floating={false}/>
  <video ref={video} src={src} playsInline preload="none" controls onPlaying={()=>setBlocked(false)} onEnded={onClose} onError={()=>setFailed(true)}/>
  {blocked&&!failed&&<button className="mascot-video-play" onClick={()=>void video.current?.play().catch(()=>setBlocked(true))}>Reproducir ▷</button>}
  {failed&&<p className="mascot-video-error">No se pudo reproducir el video. <a href={src} target="_blank" rel="noopener noreferrer">Abrir video ↗</a></p>}
 </dialog>,document.body);
}
