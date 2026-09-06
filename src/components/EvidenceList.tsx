'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {chronologicalMoments,momentTopic,momentExcerpt,type EvidenceMoment} from '@/lib/evidence-presentation';
import {TimestampLink,Highlight} from './ArchivePrimitives';
import {buildYouTubeTimestampUrl,evidenceStartSeconds} from '@/lib/utils';
import VolumeControl from './VolumeControl';
import VideoPreview from './VideoPreview';
function FullContext({item,query}:{item:EvidenceMoment;query:string}) {
  return <div className="full-moment-context" data-testid="full-context">
    <div className="context-occurrences">{item.occurrences.map(o=><TimestampLink key={o.occurrenceId} youtubeId={item.youtubeId} seconds={o.cue_start_seconds}/>)}</div>
    {item.fullContext.map((row,i)=><div className="context-cue" key={i}><p><Highlight text={row.text} query={query}/></p></div>)}
  </div>;
}
export function EvidenceList({items,query}:{items:EvidenceMoment[];query:string}) {
  const [preview,setPreview]=useState<string|null>(null),[context,setContext]=useState<string|null>(null);
  return <div className="compact-evidence-list">{chronologicalMoments(items).map(item=><article className="compact-moment" key={item.id} data-moment-id={item.id} data-occurrence-id={item.occurrence.occurrenceId} data-cue-start-seconds={item.occurrence.cue_start_seconds} data-processed={item.processed?.version}>
    <a className="moment-source" href={buildYouTubeTimestampUrl(item.youtubeId,evidenceStartSeconds(item.occurrence.cue_start_seconds))} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={'https://i.ytimg.com/vi/'+encodeURIComponent(item.youtubeId)+'/mqdefault.jpg'} alt="" loading="lazy" width="88" height="50"/>
      <span><small>{/brutalidad/i.test(item.title)?'Brutalidad Política':'Curwen'}</small><span>{item.title} ↗</span></span>
    </a>
    <div className="compact-moment-heading"><TimestampLink youtubeId={item.youtubeId} seconds={item.occurrence.cue_start_seconds}/><h3>{momentTopic(item,query)}</h3></div>
    {context!==item.id&&<p className="compact-excerpt"><Highlight text={momentExcerpt(item,query)} query={query}/></p>}
    {item.processed&&item.processed.topics.length>0&&<p className="moment-topics">{[...new Set(item.processed.topics)].slice(0,3).join(' · ')}</p>}
    <div className="moment-actions"><button className="text-action" aria-expanded={preview===item.id} onClick={()=>setPreview(p=>p===item.id?null:item.id)}>{preview===item.id?'Cerrar preview':'Preview'} ▷</button>
      <button className="text-action" aria-expanded={context===item.id} onClick={()=>{setPreview(null);setContext(c=>c===item.id?null:item.id);}}>{context===item.id?'Cerrar contexto':'Ver contexto completo'}</button>
      {item.longMoment&&<span className="source-precision">Momento de más de 3 min · revisar continuidad</span>}
    </div>
    {preview===item.id&&<div className="list-video-preview"><VideoPreview youtubeId={item.youtubeId} occurrence={item.occurrence} title={item.processed?.title??item.title}/></div>}
    {context===item.id&&<FullContext item={item} query={query}/>}
  </article>)}</div>;
}
export function EvidenceDialog({items,label,onClose}:{items:EvidenceMoment[];label:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  return createPortal(<dialog ref={dialog} className="moments-dialog" aria-label={'Momentos: '+label} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="moments-dialog-header"><span>{label} · {items.length} {items.length===1?'momento':'momentos'}</span><VolumeControl floating={false}/><button autoFocus className="text-action" onClick={onClose} aria-label="Cerrar momentos">Cerrar ×</button></div>
    <EvidenceList items={items} query={label}/>
  </dialog>,document.body);
}
