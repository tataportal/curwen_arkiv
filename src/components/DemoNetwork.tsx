'use client';

import {useEffect,useRef,useState} from 'react';
import type {DemoMoment} from '@/lib/commercial-demo';
import {initialDemoGraph,expandDemoGraph,type DemoGraph} from '@/lib/commercial-network';
import {nodePlane,nodeTypeSize,connectionPath,projectNode} from '@/lib/network-presentation';
import AmbientBackdrop from './AmbientBackdrop';

export type DemoAnchor={left:number;right:number;top:number;bottom:number};
export type DemoSelection={label:string;items:DemoMoment[];anchor:DemoAnchor;expanded:boolean;path?:string[]};

export default function DemoNetwork({label,items,overview=false,onPreview,onLeave,activeLabel,busy,onGraphChange,onMoments}: {label:string;items:DemoMoment[];overview?:boolean;onPreview:(selection:DemoSelection)=>void;onLeave:()=>void;activeLabel:string;busy:boolean;onGraphChange:()=>void;onMoments:(items:DemoMoment[],path:string[])=>void}) {
 const [focused,setFocused]=useState<string|null>(null);
 const [graph,setGraph]=useState(()=>initialDemoGraph(label,items,overview)),[history,setHistory]=useState<{graph:DemoGraph;pan:{x:number;y:number};focused:string|null}[]>([]),[pan,setPan]=useState({x:0,y:0}),[size,setSize]=useState({width:1000,height:550});
 const initial=useRef(initialDemoGraph(label,items,overview));
 const focusedNode=graph.nodes.find(n=>n.id===focused);
 const viewport=useRef<HTMLDivElement>(null),plane=useRef<HTMLDivElement>(null),motionTime=useRef(0),pointer=useRef<{x:number;y:number;px:number;py:number}|null>(null);
 const bounds={x:Math.max(...initial.current.nodes.map(n=>Math.abs(projectNode(n).x)))+120,y:Math.max(...initial.current.nodes.map(n=>Math.abs(projectNode(n).y)))+75};
 const fit=Math.min(1,size.width/(2*bounds.x),size.height/(2*bounds.y)),scale=fit;
 useEffect(()=>{const el=viewport.current;if(!el)return;const resize=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));resize.observe(el);return()=>resize.disconnect();},[]);
 useEffect(()=>{
  const surface=plane.current;if(!surface)return;let frame=0,last=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const tick=(now:number)=>{
   const dt=last?Math.min(now-last,50):0;last=now;
   const disabled=viewport.current?.parentElement?.querySelector('.ambient-backdrop.is-disabled');
   const interacting=!!surface.querySelector('.demo-node:focus-visible,.demo-node:hover')||pointer.current;
   if(!busy&&!disabled&&!reduced.matches&&!interacting&&!document.hidden){
    motionTime.current+=dt;const seconds=motionTime.current/1000;
    const offsets=graph.nodes.map(node=>projectNode(node,seconds));
    surface.querySelectorAll<HTMLElement>('.demo-node').forEach((node,i)=>{node.style.left=offsets[i].x+'px';node.style.top=offsets[i].y+'px';});
    surface.querySelectorAll<SVGPathElement>('[data-connection]').forEach((line,i)=>{const edge=graph.edges[i],a=offsets[graph.nodes.findIndex(n=>n.id===edge.from)],b=offsets[graph.nodes.findIndex(n=>n.id===edge.to)];line.setAttribute('d',connectionPath(a,b,edge.from+edge.to));});
   }
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[busy,graph]);
 function remember(){setHistory(h=>[...h,{graph,pan,focused}]);}
 function expand(id:string){onGraphChange();const next=expandDemoGraph(graph,id,items);if(next!==graph){if(next.nodes.length!==graph.nodes.length||next.edges.length!==graph.edges.length)remember();setGraph(next);}setFocused(id);}
 function recenter(){if(!focusedNode)return;onGraphChange();remember();setPan({x:-projectNode(focusedNode).x*scale,y:-projectNode(focusedNode).y*scale});}
 function back(){const prior=history[history.length-1];if(!prior)return;onGraphChange();setGraph(prior.graph);setPan(prior.pan);setFocused(prior.focused);setHistory(history.slice(0,-1));}

 const actionNode=focusedNode??(history.length?graph.nodes[0]:undefined);
 const projected=actionNode?projectNode(actionNode,motionTime.current/1000):{x:0,y:0};
 const offset={x:projected.x*scale+pan.x,y:projected.y*scale+pan.y};
 const menuWidth=Math.min(360,size.width-24);
 const menuLeft=Math.max(menuWidth/2+12,Math.min(size.width-menuWidth/2-12,size.width/2+offset.x));
 const nodeTop=size.height/2+offset.y;
 const menuTop=Math.max(8,Math.min(size.height-72,nodeTop+(nodeTop+125>size.height?-72:65)));
 const isCentered=Math.hypot(offset.x,offset.y)<10;
 const actions=actionNode&&!busy&&(actionNode.depth>0||!isCentered||history.length>0)&&<div className="demo-node-actions" role="toolbar" aria-label={'Acciones de '+actionNode.label} style={{left:menuLeft,top:menuTop,maxWidth:size.width-24}}>
  {!actionNode.navigationOnly&&actionNode.depth>0&&<button onClick={()=>onMoments(actionNode.items,actionNode.path)}>Ver {actionNode.items.length} {actionNode.items.length===1?'momento':'momentos'} ↓</button>}
  {focusedNode&&!isCentered&&<button onClick={recenter}>Recentrar</button>}
  {history.length>0&&<button onClick={back}>← Regresar</button>}
 </div>;
 return <div className={'demo-network'+(busy?' has-evidence-preview':'')} data-idle-paused={busy}>
  <AmbientBackdrop controls={false}/>
  <div ref={viewport} className="demo-network-viewport" onPointerDown={e=>{if((e.target as HTMLElement).closest('button,[role=toolbar]')||e.button!==0)return;remember();pointer.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(pointer.current)setPan({x:pointer.current.px+e.clientX-pointer.current.x,y:pointer.current.py+e.clientY-pointer.current.y});}} onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}>
   <div ref={plane} className="demo-network-plane" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${scale})`}} aria-label="Red de conceptos con evidencia">
    <svg className="demo-network-lines" viewBox="-2000 -1600 4000 3200" aria-hidden="true">{graph.edges.map(edge=>{const a=graph.nodes.find(n=>n.id===edge.from)!,b=graph.nodes.find(n=>n.id===edge.to)!;return <path data-connection key={edge.from+'|'+edge.to} d={connectionPath(projectNode(a),projectNode(b),edge.from+edge.to)} className={edge.from==='root'?'':'is-branch'} data-from={a.label} data-to={b.label} data-evidence-count={edge.momentIds.length}/>;})}</svg>
    {graph.nodes.map(node=><button key={node.id} className={'demo-node'+(node.depth===0?' is-center':node.depth===1?' is-near':' is-far')+(activeLabel===node.label?' is-active':'')+(focused===node.id?' is-selected':'')} style={{left:projectNode(node).x,top:projectNode(node).y,width:(node.depth===0?290:190)/scale,fontSize:Math.min(85,nodeTypeSize(node)*projectNode(node).k/scale)}} disabled={node.navigationOnly} aria-label={node.label+' · '+node.items.length+(node.items.length===1?' momento':' momentos')} aria-expanded={!node.navigationOnly&&node.depth<2?node.expanded:undefined} title={node.navigationOnly?'Explora uno de los cuatro personajes':node.depth===2?'Nivel 2 · ver momentos':node.expanded?'Asociaciones desplegadas':'Expandir asociaciones'} data-plane={nodePlane(node)} data-node-id={node.id} data-depth={node.depth} onPointerEnter={e=>{if(!node.navigationOnly&&e.pointerType==='mouse')onPreview({label:node.label,items:node.items,anchor:e.currentTarget.getBoundingClientRect().toJSON(),expanded:false,path:node.path});}} onPointerLeave={onLeave} onFocus={e=>{if(!node.navigationOnly&&e.currentTarget.matches(':focus-visible'))onPreview({label:node.label,items:node.items,anchor:e.currentTarget.getBoundingClientRect().toJSON(),expanded:false,path:node.path});}} onClick={()=>expand(node.id)}><i/><span>{node.label}{node.depth>0&&node.depth<2&&<small>{node.expanded?'':'+'}</small>}</span></button>)}
   </div>
   {actions}
  </div>

 </div>;
}
