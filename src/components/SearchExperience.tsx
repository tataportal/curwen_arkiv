'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Pagination from './Pagination';
import {EvidenceList} from './EvidenceList';
import {searchExpression,resultMoments,type EvidenceMoment} from '@/lib/evidence-presentation';
import {ArchiveError} from './ArchivePrimitives';
import {archiveRequest,type SearchResponse} from './archive-client';
const NetworkExplorer=dynamic(()=>import('./NetworkExplorer'));
const DEFAULT_QUERY='Corrupción';
export default function SearchExperience(){
 const [query,setQuery]=useState(DEFAULT_QUERY),[activeQuery,setActiveQuery]=useState(DEFAULT_QUERY);
 const [data,setData]=useState<SearchResponse|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[page,setPage]=useState(1);
 const [selection,setSelection]=useState<{items:EvidenceMoment[];label:string}|null>(null),[belowMap,setBelowMap]=useState(false);
 const pending=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null),hero=useRef<HTMLElement>(null),moments=useRef<HTMLElement>(null);
 const search=useCallback(async(value:string,nextPage=1,history=true)=>{
  pending.current?.abort();const controller=new AbortController();pending.current=controller;const q=value.trim();
  setQuery(q);setActiveQuery(q);setPage(nextPage);setError(false);setData(null);setSelection(null);
  if(history){const url=new URL(window.location.href);url.search='';url.searchParams.set('q',q);if(nextPage>1)url.searchParams.set('page',String(nextPage));window.history.pushState(null,'',url);}
  if(!q){setLoading(false);return;}setLoading(true);
  try{const result=await archiveRequest<SearchResponse>('/api/search?q='+encodeURIComponent(searchExpression(q))+'&page='+nextPage,controller.signal);if(!controller.signal.aborted)setData(result);}
  catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{
  const restore=()=>{const params=new URLSearchParams(window.location.search),p=Number(params.get('page')||1);void search(params.has('q')?params.get('q')! :DEFAULT_QUERY,Number.isSafeInteger(p)&&p>0?p:1,false);};
  restore();window.addEventListener('popstate',restore);return()=>{pending.current?.abort();window.removeEventListener('popstate',restore);};
 },[search]);
 useEffect(()=>{const node=hero.current;if(!node)return;const observer=new IntersectionObserver(([entry])=>setBelowMap(entry.intersectionRatio<.45),{threshold:[.45]});observer.observe(node);return()=>observer.disconnect();},[]);
 function goToMoments(){requestAnimationFrame(()=>{moments.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});moments.current?.focus({preventScroll:true});});}
 function newSearch(){void search('');window.scrollTo({top:0,behavior:'instant'});input.current?.focus();}
 const items=selection?.items??(data?resultMoments(data.episodes):[]),label=selection?.label??activeQuery;
 return <div className={'search-experience '+(activeQuery?'is-active':'')}>
  <section className="search-hero" ref={hero} aria-label="Explorar conceptos">
   <h1 className="sr-only">Curwen Arkiv · explorar conversaciones</h1>
   {activeQuery&&<div className="home-network"><NetworkExplorer key={activeQuery} query={activeQuery} compact={belowMap} response={data} loading={loading} onMoments={(next,label)=>{setSelection({items:next,label});goToMoments();}}/></div>}
   <div className="search-anchor"><form role="search" className={'search-field '+(loading?'is-loading':'')} onSubmit={e=>{e.preventDefault();void search(query);input.current?.focus();window.scrollTo({top:0,behavior:'instant'});}}>
    <label htmlFor="archive-search" className="sr-only">Buscar un tema</label><input ref={input} id="archive-search" type="text" autoComplete="off" maxLength={500} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar un tema" enterKeyHint="search" onKeyDown={e=>{if(e.key==='Escape')newSearch();}}/>
    <button type="submit" className="search-submit" aria-label="Buscar" disabled={!query.trim()}>↵</button>
   </form></div>
   <div className="hero-feedback" role="status" aria-live="polite">{error?<ArchiveError retry={()=>void search(activeQuery,page,false)}/>:!loading&&data?(data.totalMoments?<button className="text-action" onClick={()=>{setSelection(null);goToMoments();}}>Ver {data.totalMoments.toLocaleString('es-PE')} momentos ↓</button>:<p>No encontré menciones de “{activeQuery}”. Prueba otro tema.</p>):<span>{loading?'Buscando menciones de “'+activeQuery+'”…':''}</span>}</div>
  </section>
  {activeQuery&&data&&data.totalMoments>0&&<section ref={moments} id="moments" className="moments-page" aria-label={'Momentos sobre '+label} tabIndex={-1}>
   <header className="moments-page-header"><div><p className="moments-eyebrow">Momentos</p><h2>{label}</h2><p className="moments-count">{selection?items.length:data.totalMoments} momentos · {selection?new Set(items.map(i=>i.youtubeId)).size:data.totalEpisodes} episodios</p></div><button className="text-action" onClick={()=>{window.scrollTo({top:0,behavior:'instant'});input.current?.focus();}}>Volver al mapa ↑</button></header>
   {selection&&<button className="text-action" onClick={()=>setSelection(null)}>Ver todos los momentos de {activeQuery}</button>}
   <EvidenceList items={items} query={label}/>
   {!selection&&<Pagination page={page} pageSize={data.pageSize} total={data.totalEpisodes} onChange={p=>{void search(activeQuery,p).then(goToMoments);}}/>}
   <nav className="context-nav" aria-label="Archivo"><button onClick={newSearch}>Nueva búsqueda</button><Link href="/episodes">Archivo ↗</Link></nav>
  </section>}
 </div>;
}
