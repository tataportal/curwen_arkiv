'use client';
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Maximize2, X } from 'lucide-react';
import { TimestampLink, Highlight } from './ArchivePrimitives';
import { archiveRequest } from './archive-client';
import { buildEvidenceBranch, buildCommonPaths, termId, type EvidenceNode, type Evidence, type Relationship, type ConnectionPath, type NetworkBranch } from '@/lib/evidence-network';
import type { SearchResponse } from '@/lib/types';

type PositionedNode = EvidenceNode & {x:number;y:number;depth:number};
export default function NetworkExplorer({query,compact=false,response,loading=false}:{query:string;compact?:boolean;response?:SearchResponse|null;loading?:boolean}) {
  const seeds=query.split(/\s+\+\s+/).map(s=>s.trim()).filter(Boolean).slice(0,2);
  const initial:PositionedNode[]=seeds.map((label,i)=>({id:termId(label),label,kind:'term',x:seeds.length>1?(i?180:-180):0,y:0,depth:0}));
  const [nodes,setNodes]=useState<PositionedNode[]>(initial);
  const [edges,setEdges]=useState<Relationship[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [edge,setEdge]=useState<Relationship|null>(null);
  const [second,setSecond]=useState('');
  const [paths,setPaths]=useState<ConnectionPath[]>([]);
  const [pathIndex,setPathIndex]=useState(0);
  const [status,setStatus]=useState<'idle'|'loading'|'empty'|'error'>('idle');
  const [zoom,setZoom]=useState(1);
  const viewport=useRef<HTMLDivElement>(null);
  const plane=useRef<HTMLDivElement>(null);
  const inspector=useRef<HTMLElement>(null);
  const pending=useRef<AbortController|null>(null);
  const expanded=useRef(new Map<string,NetworkBranch>());
  const cache=useRef(new Map<string,SearchResponse>());
  const returnFocus=useRef<HTMLButtonElement|null>(null);
  const offset=useRef({x:0,y:0});
  const drag=useRef<{x:number;y:number;dx:number;dy:number}|null>(null);
  const selectedNode=nodes.find(n=>n.id===selected);
  const activePath=paths[pathIndex];
  const visibleNodes=nodes.filter(n=>n.kind!=='moment'||activePath?.nodes.some(p=>p.id===n.id));
  const incident=edges.filter(e=>(e.source===selected||e.target===selected)&&visibleNodes.some(n=>n.id===e.source)&&visibleNodes.some(n=>n.id===e.target));
  const evidence:Evidence[]=edge?.evidence || selectedNode?.evidence || incident[0]?.evidence || [];
  function transform(z=zoom) { if(plane.current) plane.current.style.transform='translate('+offset.current.x+'px,'+offset.current.y+'px) scale('+z+')'; }
  useEffect(()=>{transform();},[zoom]);
  useEffect(()=>()=>pending.current?.abort(),[]);
  function fit() {
    if(!viewport.current||!nodes.length)return;
    const xs=visibleNodes.map(n=>n.x),ys=visibleNodes.map(n=>n.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const z=Math.max(.15,Math.min(1,(viewport.current.clientWidth-48)/(maxX-minX+210),(viewport.current.clientHeight-64)/(maxY-minY+140)));
    offset.current={x:-(minX+maxX)/2*z,y:-(minY+maxY)/2*z};setZoom(z);transform(z);
  }
  useEffect(()=>{
    fit();
    if(!viewport.current)return;
    const resize=new ResizeObserver(()=>fit());
    resize.observe(viewport.current);
    return()=>resize.disconnect();
  },[nodes.length,pathIndex]);
  function merge(anchor:PositionedNode,branch:NetworkBranch,all=false) {
    const mobile=(viewport.current?.clientWidth||1000)<640;
    const limit=all?10:mobile?4:7;
    const choices=branch.nodes.slice(0,limit);
    setNodes(previous=>{
      const known=new Set(previous.map(n=>n.id));
      const children=choices.filter(n=>!known.has(n.id)).slice(0,Math.max(0,40-previous.length));
      const rx=mobile?125:310,ry=mobile?160:185;
      const start=anchor.depth===0?-Math.PI/2:Math.atan2(anchor.y,anchor.x)-1.1;
      const placed=[...previous];
      for(const [i,n] of children.entries()) {
        let angle=start+i/Math.max(children.length,1)*(anchor.depth===0?Math.PI*2:2.2),radius=1,x=0,y=0;
        for(let attempt=0;attempt<18;attempt++) {
          x=anchor.x+Math.cos(angle)*rx*radius;y=anchor.y+Math.sin(angle)*ry*radius;
          if(!placed.some(other=>Math.abs(other.x-x)<(mobile?105:170)&&Math.abs(other.y-y)<75))break;
          angle+=.37;radius+=.07;
        }
        placed.push({...n,x,y,depth:anchor.depth+1});
      }
      return placed;
    });
    const ids=new Set([anchor.id,...choices.map(n=>n.id)]);
    setEdges(previous=>[...previous,...branch.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)&&!previous.some(old=>old.id===e.id))]);
  }
  function showPath(path:ConnectionPath) {
    setNodes(previous=>{
      const placed=[...previous];
      for(const [i,n] of path.nodes.entries()) {
        if(placed.some(old=>old.id===n.id))continue;
        if(n.kind==='term')placed.push({...n,x:i?210:-210,y:0,depth:0});
      }
      const from=placed.find(n=>n.id===path.nodes[0].id)!;
      const to=placed.find(n=>n.id===path.nodes.at(-1)!.id)!;
      const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
      for(const n of path.nodes.filter(n=>n.kind==='moment')) {
        if(placed.some(old=>old.id===n.id))continue;
        let x=0,y=0;
        for(let distance=120;distance<=600;distance+=60) {
          x=(from.x+to.x)/2-dy/length*distance;y=(from.y+to.y)/2+dx/length*distance;
          if(!placed.some(other=>other.kind!=='moment'&&Math.abs(other.x-x)<150&&Math.abs(other.y-y)<80))break;
        }
        placed.push({...n,x,y,depth:0});
      }
      return placed.slice(0,40);
    });
    setEdges(previous=>[...previous,...path.edges.filter(e=>!previous.some(old=>old.id===e.id))]);
    setEdge(path.edges[0]);inspector.current?.scrollTo({top:0,behavior:'instant'});
  }
  function applyPaths(next:ConnectionPath[]) {
    setPaths(next);setPathIndex(0);
    if(next[0])showPath(next[0]);
  }
  async function fetchResults(label:string,signal:AbortSignal) {
    const saved=cache.current.get(label);if(saved)return saved;
    const result=await archiveRequest<SearchResponse>('/api/search?q='+encodeURIComponent(label),signal);
    if(cache.current.size>=10)cache.current.delete(cache.current.keys().next().value!);
    cache.current.set(label,result);return result;
  }
  useEffect(()=>{
    if(!response)return;
    cache.current.set(query,response);
    if(seeds.length===2) {
      const next=buildCommonPaths(seeds[0],seeds[1],response);
      applyPaths(next);setStatus(next.length?'idle':'empty');return;
    }
    const branch=buildEvidenceBranch(query,response);
    expanded.current.set(initial[0].id,branch);merge(initial[0],branch);
    setStatus(branch.nodes.length?'idle':'empty');
  },[response]);
  useEffect(()=>{
    if(response!==undefined)return;
    const controller=new AbortController();setStatus('loading');
    void fetchResults(query,controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      if(seeds.length===2){const next=buildCommonPaths(seeds[0],seeds[1],result);applyPaths(next);setStatus(next.length?'idle':'empty');}
      else{const branch=buildEvidenceBranch(query,result);expanded.current.set(initial[0].id,branch);merge(initial[0],branch);setStatus(branch.nodes.length?'idle':'empty');}
    }).catch(()=>{if(!controller.signal.aborted)setStatus('error');});
    return()=>controller.abort();
  },[query,response===undefined]);
  async function expand(node:PositionedNode) {
    setSelected(node.id);setEdge(null);setPaths([]);
    if(node.kind!=='term'){setStatus('idle');return;}
    const existing=expanded.current.get(node.id);
    if(existing){merge(node,existing,true);setStatus(existing.nodes.length?'idle':'empty');return;}
    pending.current?.abort();const controller=new AbortController();pending.current=controller;setStatus('loading');
    try {
      const result=await fetchResults(node.label,controller.signal);if(controller.signal.aborted)return;
      const branch=buildEvidenceBranch(node.label,result);expanded.current.set(node.id,branch);merge(node,branch);
      setStatus(branch.nodes.length?'idle':'empty');
    }catch{if(!controller.signal.aborted)setStatus('error');}
  }
  async function connect() {
    const label=second.trim();if(!label||!selectedNode||termId(label)===selectedNode.id)return;
    const from=selectedNode;setSecond('');
    setNodes(previous=>previous.some(n=>n.id===termId(label))?previous:[...previous,{id:termId(label),label,kind:'term' as const,x:from.x+270,y:from.y+30,depth:0}].slice(0,40));
    pending.current?.abort();const controller=new AbortController();pending.current=controller;setStatus('loading');
    try {
      const q='"'+from.label.replace(/"/g,'')+'" "'+label.replace(/"/g,'')+'"';
      const result=await fetchResults(q,controller.signal);if(controller.signal.aborted)return;
      const next=buildCommonPaths(from.label,label,result);applyPaths(next);setStatus(next.length?'idle':'empty');
    }catch{if(!controller.signal.aborted)setStatus('error');}
  }
  const close=()=>{setSelected(null);setEdge(null);returnFocus.current?.focus();};
  return <section className={'network-explorer '+(compact?'is-receded':'')} aria-label="Mapa de menciones" aria-busy={loading||status==='loading'}>
    <div className="network-viewport" ref={viewport} onPointerDown={e=>{
      if((e.target as Element).closest('button,input,a'))return;
      drag.current={x:e.clientX,y:e.clientY,dx:offset.current.x,dy:offset.current.y};e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e=>{
      if(!drag.current)return;offset.current={x:drag.current.dx+e.clientX-drag.current.x,y:drag.current.dy+e.clientY-drag.current.y};transform();
    }} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <div className="network-plane" ref={plane}>
        <svg className="network-edges" viewBox="-600 -400 1200 800" aria-hidden="true">
          {edges.map(e=>{const a=visibleNodes.find(n=>n.id===e.source),b=visibleNodes.find(n=>n.id===e.target);return a&&b?<line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={edge?.id===e.id||activePath?.edges.some(p=>p.id===e.id)?'active':''}/>:null;})}
        </svg>
        {edges.map(e=>{const a=visibleNodes.find(n=>n.id===e.source),b=visibleNodes.find(n=>n.id===e.target);return a&&b?<button key={e.id} className="edge-target" style={{left:'calc(50% + '+(a.x+b.x)/2+'px)',top:'calc(50% + '+(a.y+b.y)/2+'px)'}} aria-label={'Ver evidencia entre '+a.label+' y '+b.label}
          onClick={event=>{returnFocus.current=event.currentTarget;setEdge(e);setSelected(e.target);}}><span>{e.evidence.length}</span></button>:null;})}
        {visibleNodes.map(node=><button key={node.id} className={'network-node '+(node.id===selected?'selected ':'')+(node.kind!=='term'?'document-node ':'')+(activePath&&!activePath.nodes.some(n=>n.id===node.id)?'distant':'')}
          style={{left:'calc(50% + '+node.x+'px)',top:'calc(50% + '+node.y+'px)',fontSize:Math.min(26,14/zoom)+'px'}}
          aria-pressed={node.id===selected} aria-label={node.label}
          onClick={event=>{returnFocus.current=event.currentTarget;void expand(node);}}>
          <span className="node-point" aria-hidden="true"/><span className="node-label">{node.label}</span>
        </button>)}
      </div>
    </div>
    {nodes.length>1&&<div className="network-controls">
      <button className="icon-button" aria-label="Alejar mapa" disabled={zoom<=.25} onClick={()=>setZoom(z=>Math.max(.25,z-.15))}><Minus size={15}/></button>
      <button className="icon-button" aria-label="Acercar mapa" disabled={zoom>=1.6} onClick={()=>setZoom(z=>Math.min(1.6,z+.15))}><Plus size={15}/></button>
      <button className="icon-button" aria-label="Centrar mapa" onClick={fit}><Maximize2 size={14}/></button>
    </div>}
    {response===undefined&&status==='error'&&!selectedNode&&<p className="network-status">No se pudo consultar la red. Vuelve a buscar.</p>}
    {status==='empty'&&!selectedNode&&<p className="network-status">Sin conceptos relacionados con evidencia suficiente.</p>}
    {(selectedNode||edge)&&<aside ref={inspector} className="network-inspector reveal" aria-label="Evidencia de la conexión" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
      <button className="inspector-close icon-button" aria-label="Cerrar evidencia" onClick={close}><X size={16}/></button>
      <h2>{edge?nodes.find(n=>n.id===edge.source)?.label+' · '+nodes.find(n=>n.id===edge.target)?.label:selectedNode?.label}</h2>
      <p className="secondary" role="status">{status==='loading'?'Buscando menciones…':status==='error'?'No se pudo consultar esta rama.':status==='empty'?'No se encontraron co-menciones para esta selección.':edge?.label||'Conexiones encontradas en los momentos consultados.'}</p>
      {status==='error'&&selectedNode&&<button className="text-action" onClick={()=>void expand(selectedNode)}>Reintentar</button>}
      {evidence.length>0&&<div className="evidence-list">{evidence.slice(0,8).map((item,i)=><div className="network-evidence" key={item.chunkId+'-'+item.seconds+'-'+i}>
        <TimestampLink youtubeId={item.youtubeId} seconds={item.seconds}/><span className="evidence-precision">{item.precision==='fragment'?'inicio del fragmento':''}</span>
        <h3>{item.title}</h3><p><Highlight text={item.text} query={selectedNode?.label||query}/></p>
      </div>)}</div>}
      {selectedNode?.kind==='term'&&<form className="second-entity" onSubmit={e=>{e.preventDefault();void connect();}}>
        <label htmlFor="second-entity" className="sr-only">Conectar con otro término</label><input id="second-entity" value={second} onChange={e=>setSecond(e.target.value)} placeholder="Conectar con otro término" maxLength={120}/>
        <button disabled={!second.trim()} aria-label="Buscar conexión">↵</button>
      </form>}
      {paths.length>0&&<nav className="path-switcher" aria-label="Fragmentos compartidos">{paths.map((p,i)=><button key={p.id} aria-pressed={i===pathIndex} onClick={()=>{
        setPathIndex(i);showPath(p);
      }}>Fragmento {i+1}</button>)}</nav>}
      {incident.length>1&&<div className="related-evidence">{incident.map(e=><button key={e.id} className="text-action" onClick={()=>setEdge(e)}>{nodes.find(n=>n.id===(e.source===selected?e.target:e.source))?.label} ↗</button>)}</div>}
    </aside>}
  </section>;
}
