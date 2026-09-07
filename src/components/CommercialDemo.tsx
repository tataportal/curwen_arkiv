'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {DEMO_MOMENTS,PEOPLE,demoSearch,normalizeDemo,focusDemoMoment} from '@/lib/commercial-demo';
import DemoNetwork,{type DemoSelection} from './DemoNetwork';
import DemoEvidence from './DemoEvidence';
import VolumeControl from './VolumeControl';
import DemoMomentList from './DemoMomentList';

export default function CommercialDemo() {
 const [person,setPerson]=useState('keiko'),[query,setQuery]=useState(''),[input,setInput]=useState('Keiko');
 const [listPath,setListPath]=useState<string[]>([]),[activeVideo,setActiveVideo]=useState<string|null>(null);
 const [connection,setConnection]=useState(''),[preview,setPreview]=useState<DemoSelection|null>(null),[listFilter,setListFilter]=useState<string[]|null>(null);
 const hover=useRef<ReturnType<typeof setTimeout>|null>(null),hoverBlockedUntil=useRef(0),hero=useRef<HTMLElement>(null),moments=useRef<HTMLElement>(null);
 const results=demoSearch(person,query).filter(m=>!connection||m.topics.some(t=>t.label===connection));
 const shown=(listFilter?results.filter(m=>listFilter.includes(m.id)):results).map(m=>focusDemoMoment(m,listPath.at(-1)??connection));
 const who=PEOPLE.find(p=>p.id===person),label=connection||query||who?.fullName||'El archivo';
 const close=useCallback(()=>{if(hover.current)clearTimeout(hover.current);setPreview(null);},[]);
 const cancelHover=useCallback(()=>{if(hover.current)clearTimeout(hover.current);},[]);
 useEffect(()=>()=>{if(hover.current)clearTimeout(hover.current);},[]);
 function restore() {
  const p=new URLSearchParams(window.location.search),q=p.get('q')??'',legacy=PEOPLE.find(x=>x.aliases.some(a=>a===normalizeDemo(q))),selectedPerson=p.get('person');
  const nextPerson=PEOPLE.some(x=>x.id===selectedPerson)||selectedPerson==='all'?selectedPerson!:legacy?.id??(q?'all':'keiko');
  setPerson(nextPerson);setQuery(legacy?'':q);setInput(legacy?.name??(q||PEOPLE.find(p=>p.id===nextPerson)?.name||''));setConnection(p.get('topic')??'');setListFilter(null);setListPath([]);setActiveVideo(null);close();
  const shared=DEMO_MOMENTS.find(m=>m.id===p.get('moment'));
  if(shared){setPerson(shared.person);setQuery('');setConnection('');setListFilter([shared.id]);setListPath([PEOPLE.find(p=>p.id===shared.person)?.name??'',shared.topics.some(t=>t.label===p.get('topic'))?p.get('topic')!:shared.title]);setActiveVideo(shared.id);requestAnimationFrame(()=>moments.current?.scrollIntoView({behavior:'instant'}));}
 }
 useEffect(()=>{restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
 function navigate(nextPerson:string,q='',topic='') {
  const url=new URL(window.location.href),release=url.searchParams.get('demo');url.search='';if(release)url.searchParams.set('demo',release);url.searchParams.set('person',nextPerson);if(q)url.searchParams.set('q',q);if(topic)url.searchParams.set('topic',topic);
  hoverBlockedUntil.current=Date.now()+650;window.history.pushState(null,'',url);setPerson(nextPerson);setConnection(topic);setQuery(q);setInput(q||PEOPLE.find(p=>p.id===nextPerson)?.name||'');setListFilter(null);setListPath([]);setActiveVideo(null);close();
 }
 function search(q:string){const match=PEOPLE.find(p=>p.aliases.some(a=>a===normalizeDemo(q)));navigate(match?.id??'all',match?'':q);}
 function showPreview(next:DemoSelection) {
  next={...next,items:next.items.map(m=>focusDemoMoment(m,next.path?.at(-1)??next.label))};
  cancelHover();
  if(!next.expanded&&Date.now()<hoverBlockedUntil.current)return;
  if(next.expanded){setActiveVideo(null);setPreview(next);return;}
  if(preview?.expanded||preview?.label===next.label)return;
  hover.current=setTimeout(()=>{setActiveVideo(null);setPreview(next);},260);
 }
 function showMoments(ids:string[]|null=null,path:string[]=[]){close();setActiveVideo(null);setListPath(path);setListFilter(ids);requestAnimationFrame(()=>{moments.current?.scrollIntoView({block:'start',behavior:'instant'});moments.current?.focus({preventScroll:true});});}
 return <div className="commercial-demo">
  <section className="demo-hero" ref={hero} aria-label="Explorar el archivo">
   <header className="demo-header"><a href="?person=keiko" className="demo-wordmark">CURWEN <span>ARKIV</span></a></header>
   <div className="demo-search-anchor">
    <form role="search" className="search-field" onSubmit={e=>{e.preventDefault();search(input);}}><label htmlFor="demo-search" className="sr-only">Buscar en Curwen Arkiv</label><input id="demo-search" value={input} onChange={e=>setInput(e.target.value)} placeholder="Buscar en el archivo" maxLength={200}/><button aria-label="Buscar" type="submit" className="demo-search-submit">↵</button></form>
    <nav aria-label="Explorar personajes">{PEOPLE.map(p=><button key={p.id} aria-pressed={person===p.id} onClick={()=>navigate(p.id)}>{p.name}</button>)}<button aria-pressed={person==='all'} onClick={()=>navigate('all')}>Todos</button></nav>
   </div>
   {connection&&<div className="demo-breadcrumb"><button onClick={()=>navigate(person,query)}>← {who?.name||query||'Archivo'}</button><span>/ {connection}</span></div>}
   {results.length>0?<DemoNetwork key={person+query+connection} label={label} items={results} onPreview={showPreview} onLeave={cancelHover} onGraphChange={()=>{close();hoverBlockedUntil.current=Date.now()+650;}} onMoments={(items,path)=>showMoments(items.map(m=>m.id),path)} activeLabel={preview?.label??''} busy={!!preview||!!activeVideo}/>:<div className="demo-empty"><h2>No hay coincidencias en esta selección.</h2><p>Prueba con Keiko, RLA, Chibolín o Magaly.</p><button className="text-action" onClick={()=>navigate('keiko')}>Volver a la red ↗</button></div>}
   <div className="demo-hero-bottom"><p>Explora un concepto · clic para expandir</p><button onClick={()=>showMoments()} aria-label={'Ver '+results.length+' momentos'}>Ver {results.length} momentos <span>↓</span></button></div>
  </section>
  <VolumeControl/>
  {preview&&<DemoEvidence key={preview.label} selection={preview} onClose={close} onExpand={()=>setPreview({...preview,expanded:true})} onMoments={()=>showMoments(preview.items.map(m=>m.id),preview.path??[label,preview.label])}/>}
  <section ref={moments} tabIndex={-1} className="demo-results" aria-label="Momentos por episodio">
   <div className="demo-section-title"><div><p className="demo-kicker">Evidencia · {shown.length} {shown.length===1?'momento':'momentos'} · {new Set(shown.map(m=>m.episode.videoId)).size} {new Set(shown.map(m=>m.episode.videoId)).size===1?'episodio':'episodios'}</p><h2>{listPath.length?listPath.join(' → '):label}</h2></div><button className="text-action" onClick={()=>{close();setActiveVideo(null);hero.current?.scrollIntoView({behavior:'instant'});}}>Volver a la red ↑</button></div>
   {listFilter&&<button className="text-action" onClick={()=>{setListFilter(null);setListPath([]);setActiveVideo(null);}}>Ver todos los momentos de {label} ×</button>}
   <DemoMomentList key={listPath.join("|")} items={shown} activeId={activeVideo} setActiveId={id=>{close();setActiveVideo(id);}}/>

  </section>
 </div>;
}
