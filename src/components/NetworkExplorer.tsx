'use client';
import {useEffect,useRef,useState} from 'react';
import {Minus,Plus,Maximize2} from 'lucide-react';
import {archiveRequest} from './archive-client';
import {buildEvidenceBranch,buildCommonPaths,containsTerm,resultEvidence,termId,type EvidenceNode,type Relationship,type NetworkBranch} from '@/lib/evidence-network';
import {queryConcepts,searchExpression,evidenceMoments,type EvidenceMoment} from '@/lib/evidence-presentation';
import type {RetrievalResponse as SearchResponse} from '@/lib/retrieval/model';
import QuickEvidence,{type PreviewAnchor} from './QuickEvidence';
import AmbientBackdrop from './AmbientBackdrop';
import VolumeControl from './VolumeControl';
import {PREVIEW_LEAVE_DELAY_MS} from '@/lib/preview-buffer';
import {EvidenceDialog} from './EvidenceList';
type PositionedNode=EvidenceNode&{x:number;y:number;depth:number};
type Selection={id:string;label:string;anchor:PreviewAnchor;items:EvidenceMoment[];node?:PositionedNode;pinned:boolean};
export default function NetworkExplorer({query,compact=false,response,loading=false,onMoments}:{query:string;compact?:boolean;response?:SearchResponse|null;loading?:boolean;onMoments?:(items:EvidenceMoment[],label:string)=>void}) {
  const seeds=queryConcepts(query);
  const initial:PositionedNode[]=seeds.map((label,i)=>({id:termId(label),label,kind:'term',x:seeds.length>1?(i?180:-180):0,y:0,depth:0}));
  const [nodes,setNodes]=useState<PositionedNode[]>(initial),[edges,setEdges]=useState<Relationship[]>([]);
  const [popup,setPopup]=useState<Selection|null>(null),[list,setList]=useState<Selection|null>(null);
  const [status,setStatus]=useState<'idle'|'loading'|'empty'|'error'>('idle'),[zoom,setZoom]=useState(1);
  const viewport=useRef<HTMLDivElement>(null),plane=useRef<HTMLDivElement>(null);
  const pending=useRef<AbortController|null>(null),expanded=useRef(new Map<string,NetworkBranch>()),cache=useRef(new Map<string,SearchResponse>());
  const returnFocus=useRef<HTMLButtonElement|null>(null),skipFocus=useRef(false);
  const enterTimer=useRef<ReturnType<typeof setTimeout>|null>(null),leaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const offset=useRef({x:0,y:0}),drag=useRef<{x:number;y:number;dx:number;dy:number}|null>(null);
  const visibleNodes=nodes.filter(n=>n.kind==='term');
  function transform(z=zoom){if(plane.current)plane.current.style.transform='translate('+offset.current.x+'px,'+offset.current.y+'px) scale('+z+')';}
  useEffect(()=>{transform();},[zoom]);
  function clearTimers(){if(enterTimer.current)clearTimeout(enterTimer.current);if(leaveTimer.current)clearTimeout(leaveTimer.current);enterTimer.current=null;leaveTimer.current=null;}
  useEffect(()=>()=>{pending.current?.abort();clearTimers();},[]);
  useEffect(()=>{if(compact){clearTimers();setPopup(null);setList(null);}},[compact]);
  function fit(){
    if(!viewport.current||!visibleNodes.length)return;
    const xs=visibleNodes.map(n=>n.x),ys=visibleNodes.map(n=>n.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const z=Math.max(.15,Math.min(1,(viewport.current.clientWidth-48)/(maxX-minX+210),(viewport.current.clientHeight-64)/(maxY-minY+140)));
    offset.current={x:-(minX+maxX)/2*z,y:-(minY+maxY)/2*z};setZoom(z);transform(z);
  }
  useEffect(()=>{fit();if(!viewport.current)return;const resize=new ResizeObserver(()=>fit());resize.observe(viewport.current);return()=>resize.disconnect();},[nodes.length]);
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
  async function fetchResults(label:string,signal:AbortSignal){
    const saved=cache.current.get(label);if(saved)return saved;
    const result=await archiveRequest<SearchResponse>('/api/search?q='+encodeURIComponent(searchExpression(label)),signal);
    if(cache.current.size>=10)cache.current.delete(cache.current.keys().next().value!);
    cache.current.set(label,result);return result;
  }
  function applySingle(anchor:PositionedNode,result:SearchResponse){
    const branch=buildEvidenceBranch(anchor.label,result);expanded.current.set(anchor.id,branch);merge(anchor,branch);return branch.nodes.length;
  }
  useEffect(()=>{
    if(response===null)return;
    const controller=new AbortController();setStatus('loading');
    void (async()=>{
      const result=response??await fetchResults(query,controller.signal);
      if(controller.signal.aborted)return;cache.current.set(query,result);
      if(seeds.length===1){const count=applySingle(initial[0],result);setStatus(count?'idle':'empty');return;}
      const branches=await Promise.all(seeds.map(seed=>fetchResults(seed,controller.signal)));
      if(controller.signal.aborted)return;
      let count=0;branches.forEach((branch,i)=>{count+=applySingle(initial[i],branch);});
      const paths=buildCommonPaths(seeds[0],seeds[1],result);
      if(paths.length){const first=paths[0].edges[0];const relation={...first,evidence:paths.flatMap(p=>p.edges[0].evidence)};
        setEdges(previous=>[...previous.filter(e=>e.id!==relation.id),relation]);count++;}
      setStatus(count?'idle':'empty');
    })().catch(()=>{if(!controller.signal.aborted)setStatus('error');});
    return()=>controller.abort();
  },[query,response]);
  async function expand(node:PositionedNode){
    setPopup(null);clearTimers();const existing=expanded.current.get(node.id);
    if(existing){merge(node,existing,true);setStatus(existing.nodes.length?'idle':'empty');return;}
    pending.current?.abort();const controller=new AbortController();pending.current=controller;setStatus('loading');
    try{const result=await fetchResults(node.label,controller.signal);if(controller.signal.aborted)return;
      const branch=buildEvidenceBranch(node.label,result);expanded.current.set(node.id,branch);merge(node,branch);setStatus(branch.nodes.length?'idle':'empty');
    }catch{if(!controller.signal.aborted)setStatus('error');}
  }
  function selection(element:HTMLButtonElement,node?:PositionedNode,edge?:Relationship,pinned=false){
    const r=element.getBoundingClientRect();
    const related=edge?[edge]:edges.filter(e=>e.source===node?.id||e.target===node?.id);
    const own=node?cache.current.get(node.label):undefined;
    const raw=own?own.episodes.flatMap(e=>e.moments.flatMap(m=>resultEvidence(e,m))):related.flatMap(e=>e.evidence);
    return {id:edge?.id||node!.id,label:edge?nodes.find(n=>n.id===edge.source)?.label+' · '+nodes.find(n=>n.id===edge.target)?.label:node!.label,
      items:evidenceMoments(raw),anchor:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},node,pinned};
  }
  function show(element:HTMLButtonElement,node?:PositionedNode,edge?:Relationship,pinned=false,delay=false){
    if(compact||list)return;clearTimers();returnFocus.current=element;
    const next=selection(element,node,edge,pinned);
    if(!next.items.length)return;
    if(popup?.id===next.id){if(pinned&&!popup.pinned)setPopup({...popup,pinned:true});return;}
    if(delay)enterTimer.current=setTimeout(()=>{clearTimers();setPopup(next);},220);else setPopup(next);
  }
  function scheduleClose(){if(popup?.pinned||leaveTimer.current)return;leaveTimer.current=setTimeout(()=>{leaveTimer.current=null;setPopup(null);},PREVIEW_LEAVE_DELAY_MS);}
  function leave(){if(enterTimer.current)clearTimeout(enterTimer.current);enterTimer.current=null;scheduleClose();}
  function close(){clearTimers();setPopup(null);skipFocus.current=true;returnFocus.current?.focus();setTimeout(()=>{skipFocus.current=false;},0);}
  return <section className={'network-explorer '+(compact?'is-receded ':'')+(popup||list?'has-evidence-preview':'')} aria-label="Mapa de conceptos" aria-busy={loading||status==='loading'} onKeyDown={e=>{if(e.key==='Escape'&&popup){e.stopPropagation();close();}}}>
    <AmbientBackdrop/><VolumeControl/>
    <div className="network-viewport" ref={viewport} onPointerDown={e=>{
      if((e.target as Element).closest('button,input,a')||(e.pointerType==='touch'&&onMoments))return;
      clearTimers();setPopup(null);drag.current={x:e.clientX,y:e.clientY,dx:offset.current.x,dy:offset.current.y};e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e=>{if(!drag.current)return;offset.current={x:drag.current.dx+e.clientX-drag.current.x,y:drag.current.dy+e.clientY-drag.current.y};transform();}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <div className="network-plane" ref={plane}>
        <svg className="network-edges" viewBox="-600 -400 1200 800" aria-hidden="true">{edges.map(e=>{const a=visibleNodes.find(n=>n.id===e.source),b=visibleNodes.find(n=>n.id===e.target);return a&&b?<line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>:null;})}</svg>
        {edges.map(e=>{const a=visibleNodes.find(n=>n.id===e.source),b=visibleNodes.find(n=>n.id===e.target);return a&&b?<button key={e.id} className="edge-target" style={{left:'calc(50% + '+(a.x+b.x)/2+'px)',top:'calc(50% + '+(a.y+b.y)/2+'px)'}} aria-label={'Ver evidencia entre '+a.label+' y '+b.label}
          onPointerEnter={event=>{if(event.pointerType!=='touch')show(event.currentTarget,undefined,e,false,true);}} onPointerLeave={leave}
          onFocus={event=>{if(!skipFocus.current)show(event.currentTarget,undefined,e);}} onClick={event=>show(event.currentTarget,undefined,e,true)}><span>{e.evidence.length}</span></button>:null;})}
        {visibleNodes.map(node=><button key={node.id} className={'network-node '+(popup?.node?.id===node.id?'selected ':'')}
          style={{left:'calc(50% + '+node.x+'px)',top:'calc(50% + '+node.y+'px)',fontSize:Math.min(26,14/zoom)+'px'}} aria-label={node.label} aria-expanded={popup?.node?.id===node.id}
          onPointerEnter={event=>{if(event.pointerType!=='touch')show(event.currentTarget,node,undefined,false,true);}} onPointerLeave={leave}
          onFocus={event=>{if(!skipFocus.current)show(event.currentTarget,node);}} onClick={event=>{if(window.matchMedia("(hover: none)").matches&&popup?.node?.id!==node.id){show(event.currentTarget,node,undefined,true);}else void expand(node);}}>
          <span className="node-point" aria-hidden="true"/><span className="node-label">{node.label}</span></button>)}
      </div>
    </div>
    {nodes.length>1&&<div className="network-controls"><button className="icon-button" aria-label="Alejar mapa" disabled={zoom<=.25} onClick={()=>{close();setZoom(z=>Math.max(.25,z-.15));}}><Minus size={15}/></button><button className="icon-button" aria-label="Acercar mapa" disabled={zoom>=1.6} onClick={()=>{close();setZoom(z=>Math.min(1.6,z+.15));}}><Plus size={15}/></button><button className="icon-button" aria-label="Centrar mapa" onClick={()=>{close();fit();}}><Maximize2 size={14}/></button></div>}
    {status==='loading'&&!loading&&<p className="network-status" role="status">Buscando conceptos relacionados…</p>}
    {status==='error'&&<p className="network-status">No se pudo consultar esta rama. Vuelve a buscar.</p>}
    {status==='empty'&&!popup&&<p className="network-status">Sin conceptos relacionados con evidencia suficiente.</p>}
    {popup&&!list&&!compact&&<QuickEvidence pinned={popup.pinned} anchor={popup.anchor} label={popup.label} items={popup.items} onClose={close} onEnter={clearTimers} onLeave={scheduleClose} onMoments={()=>{clearTimers();if(onMoments){onMoments(popup.items,popup.label);setPopup(null);}else setList(popup);}} onExplore={popup.node?()=>void expand(popup.node!):undefined}/>}
    {list&&!compact&&<EvidenceDialog items={list.items} label={list.label} onClose={()=>{setList(null);close();}}/>}
  </section>;
}
