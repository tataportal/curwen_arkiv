'use client';
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Maximize2, X } from 'lucide-react';
import { TimestampLink } from './ArchivePrimitives';

export type Evidence = { youtubeId: string; title: string; seconds: number };
export type NetworkNode = { id: string; label: string; x: number; y: number; depth: number };
export type Relationship = { id: string; source: string; target: string; label: string; evidence: Evidence[] };
export type ConnectionPath = { id: string; label: string; nodeIds: string[]; edges: Relationship[] };
export type NetworkSource = {
  neighbors: (id: string, signal: AbortSignal) => Promise<{ nodes: Omit<NetworkNode, 'x' | 'y' | 'depth'>[]; edges: Relationship[] }>;
  paths: (from: string, to: string, signal: AbortSignal) => Promise<ConnectionPath[]>;
};
// No source is connected until verified relationships and evidence are available.
export default function NetworkExplorer({ query, compact = false, source }: { query: string; compact?: boolean; source?: NetworkSource }) {
  const seeds = query.split(/\s+\+\s+/).map(s => s.trim()).filter(Boolean).slice(0, 2);
  const [nodes, setNodes] = useState<NetworkNode[]>(() => seeds.map((label, i) => ({ id: 'query:' + label, label, x: seeds.length > 1 ? (i ? 165 : -165) : 0, y: 0, depth: 0 })));
  const [edges, setEdges] = useState<Relationship[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [edge, setEdge] = useState<Relationship | null>(null);
  const [second, setSecond] = useState('');
  const [paths, setPaths] = useState<ConnectionPath[]>([]);
  const [pathIndex, setPathIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'unavailable' | 'empty' | 'error'>(source ? 'idle' : 'unavailable');
  const [zoom, setZoom] = useState(1);
  const expanded = useRef(new Set<string>());
  const pending = useRef<AbortController | null>(null);
  const plane = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const transform = () => {
    if (plane.current) plane.current.style.transform = 'translate(' + offset.current.x + 'px,' + offset.current.y + 'px) scale(' + zoom + ')';
  };
  useEffect(transform, [zoom]);
  function fit() {
    if (!viewport.current || !nodes.length) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const z = Math.min(1, viewport.current.clientWidth / (maxX - minX + 220), viewport.current.clientHeight / (maxY - minY + 160));
    offset.current = { x: -(minX + maxX) / 2 * z, y: -(minY + maxY) / 2 * z };
    setZoom(z);
    if (plane.current) plane.current.style.transform = 'translate(' + offset.current.x + 'px,' + offset.current.y + 'px) scale(' + z + ')';
  }
  useEffect(() => { fit(); }, [nodes.length]);
  const selectedNode = nodes.find(n => n.id === selected);
  const activePath = paths[pathIndex];
  async function expand(node: NetworkNode) {
    setSelected(node.id); setEdge(null);
    if (!source) { setStatus('unavailable'); return; }
    if (expanded.current.has(node.id)) { setStatus('idle'); return; }
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setStatus('loading');
    try {
      const branch = await source.neighbors(node.id, controller.signal);
      if (controller.signal.aborted) return;
      // A relationship without transcript evidence cannot enter the visible graph.
      const backed = branch.edges.filter(e => e.evidence.length > 0);
      const existing = new Set(nodes.map(n => n.id));
      const children = branch.nodes.filter(n => !existing.has(n.id) && backed.some(e => e.source === n.id || e.target === n.id)).slice(0, Math.max(0, 40 - nodes.length));
      const positioned = children.map((n, i) => ({ ...n, x: node.x + Math.cos(i / Math.max(children.length, 1) * Math.PI * 2 - Math.PI / 2) * 185, y: node.y + Math.sin(i / Math.max(children.length, 1) * Math.PI * 2 - Math.PI / 2) * 130, depth: node.depth + 1 }));
      const ids = new Set([...nodes, ...positioned].map(n => n.id));
      setNodes(old => [...old, ...positioned]);
      setEdges(old => [...old, ...backed.filter(e => ids.has(e.source) && ids.has(e.target) && !old.some(v => v.id === e.id))]);
      expanded.current.add(node.id); setStatus(children.length ? 'idle' : 'empty');
    } catch { if (!controller.signal.aborted) setStatus('error'); }
  }
  async function connect(label: string) {
    const trimmed = label.trim();
    if (!trimmed || !selectedNode || trimmed.toLocaleLowerCase() === selectedNode.label.toLocaleLowerCase()) return;
    const id = 'query:' + trimmed;
    setNodes(old => old.some(n => n.id === id) ? old : [...old.slice(0, 39), { id, label: trimmed, x: selectedNode.x + 260, y: selectedNode.y + 40, depth: 0 }]);
    setSecond(''); setPaths([]);
    if (!source) { setStatus('unavailable'); return; }
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setStatus('loading');
    try {
      const result = await source.paths(selectedNode.id, id, controller.signal);
      if (!controller.signal.aborted) {
        const backed = result.filter(p => p.edges.length > 0 && p.edges.every(e => e.evidence.length > 0));
        setPaths(backed); setPathIndex(0); setStatus(backed.length ? 'idle' : 'empty');
      }
    } catch { if (!controller.signal.aborted) setStatus('error'); }
  }
  const close = () => { setSelected(null); setEdge(null); returnFocus.current?.focus(); };
  return <section className={'network-explorer ' + (compact ? 'is-receded' : '')} aria-label="Mapa de la búsqueda">
    <div className="network-viewport" ref={viewport} onPointerDown={e => {
      if ((e.target as HTMLElement).closest('button, input, a')) return;
      drag.current = { x: e.clientX, y: e.clientY, dx: offset.current.x, dy: offset.current.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e => {
      if (!drag.current) return;
      offset.current = { x: drag.current.dx + e.clientX - drag.current.x, y: drag.current.dy + e.clientY - drag.current.y }; transform();
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="network-plane" ref={plane}>
        <svg className="network-edges" viewBox="-600 -400 1200 800" aria-hidden="true">
          {edges.map(e => { const from = nodes.find(n => n.id === e.source); const to = nodes.find(n => n.id === e.target); return from && to ? <line key={e.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={activePath?.edges.some(v => v.id === e.id) || e.source === selected || e.target === selected ? 'active' : ''} /> : null; })}
        </svg>
        {nodes.map(node => <button key={node.id} className={'network-node ' + (node.id === selected ? 'selected' : '') + (activePath && !activePath.nodeIds.includes(node.id) ? 'distant' : '')}
          style={{ left: 'calc(50% + ' + node.x + 'px)', top: 'calc(50% + ' + node.y + 'px)' }} aria-pressed={node.id === selected}
          onClick={e => { returnFocus.current = e.currentTarget; void expand(node); }}>
          <span className="node-point" aria-hidden="true" /><span>{node.label}</span>
        </button>)}
      </div>
    </div>
    {nodes.length > 1 && <div className="network-controls">
      <button className="icon-button" aria-label="Alejar mapa" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, z - .15))}><Minus size={15} /></button>
      <button className="icon-button" aria-label="Acercar mapa" disabled={zoom >= 1.6} onClick={() => setZoom(z => Math.min(1.6, z + .15))}><Plus size={15} /></button>
      <button className="icon-button" aria-label="Centrar mapa" onClick={fit}><Maximize2 size={14} /></button>
    </div>}
    {(selectedNode || edge) && <aside className="network-inspector reveal" aria-label="Explorar nodo" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <button className="inspector-close icon-button" aria-label="Cerrar detalle del nodo" onClick={close}><X size={16} /></button>
      <h2>{edge ? edge.label : selectedNode?.label}</h2>
      <p className="secondary" role="status">{status === 'loading' ? 'Consultando conexiones…' : status === 'unavailable' ? 'Las conexiones con evidencia aún no están disponibles.' : status === 'error' ? 'No se pudieron consultar las conexiones.' : status === 'empty' ? 'No hay conexiones con evidencia para esta selección.' : ''}</p>
      {status === 'error' && selectedNode && <button className="text-action" onClick={() => void expand(selectedNode)}>Reintentar</button>}
      {selectedNode && <form className="second-entity" onSubmit={e => { e.preventDefault(); void connect(second); }}>
        <label htmlFor="second-entity" className="sr-only">Conectar con otro término</label>
        <input id="second-entity" value={second} onChange={e => setSecond(e.target.value)} placeholder="Conectar con otro término" maxLength={120} />
        <button disabled={!second.trim()} aria-label="Añadir segundo término">↵</button>
      </form>}
      {paths.length > 0 && <nav className="path-switcher" aria-label="Rutas de conexión">{paths.map((p, i) => <button key={p.id} aria-pressed={i === pathIndex} onClick={() => setPathIndex(i)}>{p.label}</button>)}</nav>}
      {edges.filter(e => e.source === selected || e.target === selected).map(e => <button className="text-action" key={e.id} onClick={() => setEdge(e)}>{e.label} ↗</button>)}
      {(edge?.evidence || activePath?.edges.flatMap(e => e.evidence) || []).map((item, i) => <div className="network-evidence" key={item.youtubeId + '-' + item.seconds + '-' + i}><TimestampLink youtubeId={item.youtubeId} seconds={item.seconds} /><p>{item.title}</p></div>)}
    </aside>}
  </section>;
}
