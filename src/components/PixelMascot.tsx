'use client';

import {useEffect,useId,useRef,useState} from 'react';

export const MASCOT_PHRASES=['El todo good','Mi amorcito otaku','Pelao chivo','El 3 polvos'] as const;
// The generator returned an opaque PNG. Clip its display to the pixel silhouette;
// retain the original raster, including its light highlights, without color keying.
const silhouette='M195 100H328V123H378V151H407V178H431V254H458V230H485V203H511V177H537V152H692V177H744V204H771V230H799V255H822V179H847V152H873V126H900V99H1036V125H1062V150H1086V177H1111V203H1137V254H1164V280H1112V255H1088V228H1060V204H1010V230H984V306H959V359H985V410H1012V490H985V520H1036V546H1060V572H1086V598H1111V626H1137V653H1188V679H1210V704H1158V731H1108V757H1036V731H1012V782H985V834H959V886H932V938H905V965H879V991H853V1018H800V1044H773V1070H744V1097H693V1123H665V1157H614V1130H589V1103H562V1077H509V1051H458V1024H431V998H406V971H379V945H353V919H329V867H302V815H277V762H251V738H223V763H169V738H116V712H64V686H38V658H64V631H91V605H116V578H169V552H195V526H222V499H247V422H274V370H300V344H327V293H352V240H352V216H324V189H274V189H248V215H222V241H197V269H171V294H146V315H120V282H116V232H142V180H169V152H195Z';

export default function PixelMascot({paused=false}:{paused?:boolean}) {
 const [clicks,setClicks]=useState(0),[speaking,setSpeaking]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),id=useId().replace(/:/g,'');
 const phrase=MASCOT_PHRASES[(Math.max(1,clicks)-1)%MASCOT_PHRASES.length];
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{if(paused){setSpeaking(false);if(timer.current)clearTimeout(timer.current);}},[paused]);
 function speak(){if(timer.current)clearTimeout(timer.current);setClicks(n=>n+1);setSpeaking(true);timer.current=setTimeout(()=>setSpeaking(false),3800);}
 return <aside className={'pixel-mascot'+(speaking?' is-speaking':'')} data-paused={paused} aria-label="Mascota de Curwen Arkiv">
  <div className="mascot-bubble" role="status" aria-live="polite" aria-atomic="true">{speaking&&<span key={clicks}>{phrase}</span>}</div>
  <button type="button" className="mascot-trigger" aria-label="Hablar con la mascota" onClick={speak} onKeyDown={e=>{if(e.key==='Escape'){setSpeaking(false);if(timer.current)clearTimeout(timer.current);}}}>
   <span className="mascot-idle"><span className="mascot-reaction" key={clicks}>
    <svg viewBox="0 0 1254 1254" aria-hidden="true" className="mascot-sprite"><defs><clipPath id={id}><path d={silhouette}/></clipPath></defs><image href={(process.env.NEXT_PUBLIC_ASSET_BASE_PATH||'')+'/mascot/chivo-pixel-v1.png'} width="1254" height="1254" clipPath={`url(#${id})`}/></svg>
   </span></span>
  </button>
 </aside>;
}
