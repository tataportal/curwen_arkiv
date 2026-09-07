'use client';

import {useState} from 'react';
import type {DemoMoment} from '@/lib/commercial-demo';
import {demoGroups,demoDate} from '@/lib/commercial-demo';
import {buildYouTubeTimestampUrl,evidenceStartSeconds,formatTimestamp} from '@/lib/utils';
import VideoPreview from './VideoPreview';

export default function DemoMomentList({items,activeId,setActiveId}:{items:DemoMoment[];activeId:string|null;setActiveId:(id:string|null)=>void}) {
 const [contextId,setContextId]=useState<string|null>(null),[copied,setCopied]=useState<string|null>(null);
 async function copy(moment:DemoMoment){const url=new URL(window.location.href),release=url.searchParams.get('demo');url.search='';if(release)url.searchParams.set('demo',release);url.searchParams.set('person',moment.person);url.searchParams.set('moment',moment.id);try{await navigator.clipboard.writeText(url.toString());setCopied(moment.id);}catch{window.prompt('Copia el enlace del momento',url.toString());}}
 return <>{demoGroups(items).map(group=><section className="demo-episode" key={group[0].episode.videoId}>
  <header><a href={buildYouTubeTimestampUrl(group[0].episode.videoId,evidenceStartSeconds(group[0].occurrence.cue_start_seconds))} target="_blank" rel="noopener noreferrer"><img src={'https://i.ytimg.com/vi/'+group[0].episode.videoId+'/mqdefault.jpg'} alt="" loading="lazy"/><span>{group[0].episode.title}<small>{demoDate(group[0].episode.publishedAt)} · {group.length} {group.length===1?'momento':'momentos'}</small></span></a></header>
  {group.map(m=><article className="demo-result" id={'moment-'+m.id} key={m.id} data-moment-id={m.id}>
   <a className="demo-timestamp" data-cue-start-seconds={m.occurrence.cue_start_seconds} href={buildYouTubeTimestampUrl(m.episode.videoId,evidenceStartSeconds(m.occurrence.cue_start_seconds))} target="_blank" rel="noopener noreferrer">{formatTimestamp(m.occurrence.cue_start_seconds)} ↗</a>
   <div><h3>{m.title}</h3><p>{m.summary}</p>
    <div className="demo-moment-actions"><button className="text-action" aria-expanded={activeId===m.id} onClick={()=>setActiveId(activeId===m.id?null:m.id)}>{activeId===m.id?'Cerrar video':'▷ Ver video'}</button><button className="text-action" aria-expanded={contextId===m.id} onClick={()=>setContextId(contextId===m.id?null:m.id)}>{contextId===m.id?'Cerrar contexto':'Ver contexto completo'}</button><button className="text-action" onClick={()=>void copy(m)}>{copied===m.id?'Enlace copiado ✓':'Copiar enlace ↗'}</button></div>
    {activeId===m.id&&<div className="demo-inline-video"><VideoPreview continuous youtubeId={m.episode.videoId} occurrence={m.occurrence} title={m.title}/><p className="demo-note">Video desde {formatTimestamp(evidenceStartSeconds(m.occurrence.cue_start_seconds))} · hasta 3 s antes de la mención.</p></div>}
    {contextId===m.id&&<div className="demo-context"><h4>Conexiones respaldadas en este pasaje</h4>{m.topics.map(t=><p key={t.label}><strong>{t.label}</strong> · «{t.quote}»</p>)}<h4>Transcripción alrededor de la mención</h4><p className="demo-note">Transcripción automática. El resumen conserva la atribución del programa; no verifica por separado sus afirmaciones.</p>{m.context.map((c,i)=><p key={i}><a href={buildYouTubeTimestampUrl(m.episode.videoId,evidenceStartSeconds(c.startSeconds))} target="_blank" rel="noopener noreferrer">{formatTimestamp(c.startSeconds)}</a> {c.text}</p>)}</div>}
   </div>
  </article>)}
 </section>)}</>;
}
