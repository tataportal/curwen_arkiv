'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {chronologicalMoments,conciseExcerpt,type EvidenceMoment} from '@/lib/evidence-presentation';
import {TimestampLink,Highlight} from './ArchivePrimitives';
import {archiveRequest,type EpisodeData} from './archive-client';
import VideoPreview from './VideoPreview';
function FullContext({item,query}:{item:EvidenceMoment;query:string}) {
  const [rows,setRows]=useState<{seconds:number;text:string}[]|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setFailed(false);setRows(null);
    void archiveRequest<{episode:EpisodeData|null}>('/api/episode/'+item.youtubeId,controller.signal).then(({episode})=>{
      if(controller.signal.aborted)return;if(!episode)throw new Error('Missing episode');
      const from=Math.max(0,item.seconds-25),to=(item.endSeconds??item.seconds+8)+25;
      const context=episode.chunks.flatMap(c=>c.cues?.length?c.cues.map(cue=>({seconds:cue.start_seconds,end:cue.end_seconds,text:cue.text})):[{seconds:c.start_seconds,end:c.end_seconds,text:c.text}])
        .filter(c=>c.end>=from&&c.seconds<=to).sort((a,b)=>a.seconds-b.seconds);
      if(!context.length)throw new Error('Missing context');setRows(context);
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[item.youtubeId,item.seconds,item.endSeconds,retry]);
  return <div className="full-moment-context" data-testid="full-context">
    {failed?<p role="alert">No se pudo cargar el contexto. <button className="text-action" onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>:!rows?<p role="status">Cargando contexto…</p>:
      rows.map((row,i)=><div className="context-cue" key={row.seconds+'-'+i}><TimestampLink youtubeId={item.youtubeId} seconds={row.seconds}/><p><Highlight text={row.text} query={query}/></p></div>)}
  </div>;
}
export function EvidenceList({items,query}:{items:EvidenceMoment[];query:string}) {
  const [preview,setPreview]=useState<string|null>(null),[context,setContext]=useState<string|null>(null);
  return <div className="compact-evidence-list">{chronologicalMoments(items).map(item=><article className="compact-moment" key={item.id} data-moment-id={item.id}>
    <div className="compact-moment-heading"><TimestampLink youtubeId={item.youtubeId} seconds={item.seconds}/><h3>{item.title}</h3></div>
    {context!==item.id&&<p className="compact-excerpt"><Highlight text={conciseExcerpt(item.text,query)} query={query}/></p>}
    <div className="moment-actions"><button className="text-action" aria-expanded={preview===item.id} onClick={()=>setPreview(p=>p===item.id?null:item.id)}>{preview===item.id?'Cerrar preview':'Preview'} ▷</button>
      <button className="text-action" aria-expanded={context===item.id} onClick={()=>{setPreview(null);setContext(c=>c===item.id?null:item.id);}}>{context===item.id?'Cerrar contexto':'Ver contexto completo'}</button>
      {item.precision==='fragment'&&<span className="source-precision">Inicio del fragmento</span>}
    </div>
    {preview===item.id&&<div className="list-video-preview"><VideoPreview youtubeId={item.youtubeId} seconds={item.seconds} title={item.title}/></div>}
    {context===item.id&&<FullContext item={item} query={query}/>}
  </article>)}</div>;
}
export function EvidenceDialog({items,label,onClose}:{items:EvidenceMoment[];label:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  return createPortal(<dialog ref={dialog} className="moments-dialog" aria-label={'Momentos: '+label} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="moments-dialog-header"><span>{label} · {items.length} {items.length===1?'momento':'momentos'}</span><button autoFocus className="text-action" onClick={onClose} aria-label="Cerrar momentos">Cerrar ×</button></div>
    <EvidenceList items={items} query={label}/>
  </dialog>,document.body);
}
