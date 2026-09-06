'use client';
import type {SearchOccurrence} from '@/lib/retrieval/model';
import {useEffect,useRef,useState} from 'react';
import {loadYouTubeAPI,type YouTubePlayer} from '@/lib/youtube-api';
import {buildYouTubeTimestampUrl,formatTimestamp} from '@/lib/utils';
export const PREVIEW_SECONDS=8;
export default function VideoPreview({youtubeId,occurrence,title}:{youtubeId:string;occurrence:SearchOccurrence;title:string}) {
  const host=useRef<HTMLDivElement>(null),player=useRef<YouTubePlayer|null>(null);
  const [state,setState]=useState('loading'),[observedStart,setObservedStart]=useState<number|null>(null);
  const firstPlaying=useRef(false);
  const start=occurrence.cue_start_seconds;
  if(!Number.isFinite(start)||start<0||occurrence.videoId!==youtubeId)throw new Error('Preview requires a valid cue occurrence');
  const play=()=>{setState('playing');player.current?.mute();player.current?.loadVideoById({videoId:youtubeId,startSeconds:start,endSeconds:start+PREVIEW_SECONDS});};
  useEffect(()=>{
    let disposed=false,stopped=false,instance:YouTubePlayer|undefined;
    const container=host.current;if(!container)return;
    setState('loading');setObservedStart(null);firstPlaying.current=false;const mount=document.createElement('div');container.replaceChildren(mount);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    loadYouTubeAPI().then(api=>{
      if(disposed)return;
      instance=new api.Player(mount,{videoId:youtubeId,playerVars:{start:Math.floor(start),autoplay:0,mute:1,playsinline:1,controls:0,rel:0,origin:window.location.origin},events:{
        onReady:e=>{if(disposed)return;player.current=e.target;e.target.mute();container.querySelector('iframe')?.setAttribute('tabindex','-1');
          if(reduced||document.hidden){e.target.seekTo(start,true);e.target.pauseVideo();setState('paused');}
          else {e.target.loadVideoById({videoId:youtubeId,startSeconds:start,endSeconds:start+PREVIEW_SECONDS});setState('playing');}},
        onStateChange:e=>{if(disposed)return;if(e.data===1){stopped=false;if(!firstPlaying.current&&player.current){firstPlaying.current=true;setObservedStart(player.current.getCurrentTime());}}if(e.data===0){stopped=true;setState('ended');}},
        onAutoplayBlocked:()=>{if(!disposed)setState('paused');},
        onError:()=>{if(!disposed)setState('error');},
      }});
    }).catch(()=>{if(!disposed)setState('error');});
    const interval=setInterval(()=>{const time=player.current?.getCurrentTime();if(!stopped&&time!=null&&time>=start+PREVIEW_SECONDS){stopped=true;player.current?.pauseVideo();setState('ended');}},200);
    const hide=()=>{if(document.hidden){player.current?.pauseVideo();setState('paused');}};
    document.addEventListener('visibilitychange',hide);
    return()=>{disposed=true;clearInterval(interval);document.removeEventListener('visibilitychange',hide);player.current=null;instance?.destroy();container.replaceChildren();};
  },[youtubeId,start]);
  return <div className="video-preview" data-preview-state={state} data-start-seconds={start} data-observed-start-seconds={observedStart??undefined} data-end-seconds={start+PREVIEW_SECONDS}>
    <a className="preview-video-link" href={buildYouTubeTimestampUrl(youtubeId,start)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${title} en YouTube desde ${formatTimestamp(start)}`}>
      <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt=""/>
      <div ref={host} className="preview-player" aria-hidden="true"/>
    </a>
    {state==='error'?<span className="preview-status">Preview no disponible · abrir en YouTube ↗</span>:
      (state==='paused'||state==='ended')&&<button className="preview-replay" onClick={play}>{state==='ended'?'Repetir preview':'Reproducir preview'} ↻</button>}
  </div>;
}
