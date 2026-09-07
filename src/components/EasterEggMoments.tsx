'use client';

import clips from '@/data/easter-egg-clips.json';
import type {SearchOccurrence} from '@/lib/retrieval/model';
import {demoDate} from '@/lib/commercial-demo';
import {buildYouTubeTimestampUrl,formatTimestamp} from '@/lib/utils';
import VideoPreview from './VideoPreview';

export default function EasterEggMoments({activeId,setActiveId}:{activeId:string|null;setActiveId:(id:string|null)=>void}) {
 return <>{clips.map(clip=><section className="demo-episode" key={clip.id}>
  <header><a href={buildYouTubeTimestampUrl(clip.episode.videoId,clip.playbackStart)} target="_blank" rel="noopener noreferrer"><img src={`https://i.ytimg.com/vi/${clip.episode.videoId}/mqdefault.jpg`} alt="" loading="lazy"/><span>{clip.episode.title}<small>{demoDate(clip.episode.publishedAt)}</small></span></a></header>
  <article className="demo-result" data-easter-egg-id={clip.id}>
   <a className="demo-timestamp" href={buildYouTubeTimestampUrl(clip.episode.videoId,clip.playbackStart)} target="_blank" rel="noopener noreferrer" aria-label={`Ver clip desde ${formatTimestamp(clip.playbackStart)}`}>{formatTimestamp(clip.playbackStart)} ↗</a>
   <div><h3>{clip.title}</h3><div className="demo-moment-actions"><button className="text-action" aria-expanded={activeId===clip.id} onClick={()=>setActiveId(activeId===clip.id?null:clip.id)}>{activeId===clip.id?'Cerrar video':'▷ Ver video'}</button></div>
    {activeId===clip.id&&<div className="demo-inline-video"><VideoPreview continuous youtubeId={clip.episode.videoId} occurrence={clip.occurrence as SearchOccurrence} contextStartSeconds={clip.playbackStart} title={clip.title}/></div>}
    <details className="demo-egg-transcript"><summary>Extracto de transcripción</summary><p>{clip.excerpt}</p></details>
   </div>
  </article>
 </section>)}</>;
}
