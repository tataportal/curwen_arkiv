import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CommercialDemo from '../src/components/CommercialDemo';
import {DEMO_MOMENTS,PEOPLE,demoSearch,demoGroups,normalizeDemo,demoDate,demoConnections} from '../src/lib/commercial-demo';
import {buildYouTubeTimestampUrl,evidenceStartSeconds} from '../src/lib/utils';
test('demo is capped per person and every summary and connection has transcript provenance',()=>{
 assert.equal(DEMO_MOMENTS.length,24);assert.equal(new Set(DEMO_MOMENTS.map(m=>m.id)).size,24);
 for(const person of PEOPLE){const moments=demoSearch(person.id,'');assert(moments.length>0&&moments.length<=25);}
 for(const m of DEMO_MOMENTS){
  const text=m.context.map(c=>c.text).join(' ').toLowerCase();
  assert(text.includes(m.quote.toLowerCase()),m.id+' unsupported quote');
  assert(m.summary.length>90&&m.title.length>10);assert.equal(m.review.status,'transcript-reviewed');
  for(const t of m.topics)assert(text.includes(t.quote.toLowerCase()),m.id+' '+t.label);
  assert.equal(m.occurrence.videoId,m.episode.videoId);assert(m.occurrence.cueId.startsWith(m.episode.videoId+':'));
  assert(m.context.some(c=>c.cueIds.includes(m.occurrence.cueId)),m.id+' missing cue');
  assert(Number.isFinite(m.occurrence.cue_start_seconds));
  assert.equal(new URL(buildYouTubeTimestampUrl(m.episode.videoId,evidenceStartSeconds(m.occurrence.cue_start_seconds))).searchParams.get('t'),Math.max(0,Math.floor(m.occurrence.cue_start_seconds)-3)+'s');
 }
});
test('search handles public names, transcription aliases and multiword topics within partial coverage',()=>{
 assert.equal(demoSearch('all','RLA').length,6);assert.equal(demoSearch('all','Magali').length,6);
 assert(demoSearch('all','Chibolin').length>=6);assert(demoSearch('chibolin','media training').length>0);
 assert(demoSearch('magaly','Jefferson Farfán').length>0);assert.equal(demoSearch('all','zzzzzz').length,0);
 assert.equal(normalizeDemo('LÓPEZ ALIAGA'),'lopez aliaga');
});
test('comparison uses one episode group and chronological source cues',()=>{
 const groups=demoGroups([...DEMO_MOMENTS].reverse());assert.equal(groups.length,new Set(DEMO_MOMENTS.map(m=>m.episode.videoId)).size);
 for(const g of groups)assert.deepEqual(g.map(m=>m.occurrence.cue_start_seconds),g.map(m=>m.occurrence.cue_start_seconds).sort((a,b)=>a-b));
});
test('demo renders usable results without API waits, experimental processing or autoplay',()=>{
 const html=renderToStaticMarkup(<CommercialDemo/>);
 assert(html.includes('ARKIV'));assert(!html.includes('cobertura parcial'));assert(!html.includes('Ambiente'));assert(html.includes('Lo público y lo privado'));
 assert(html.includes('Red de conceptos con evidencia'));assert(html.includes('Ver 6 momentos'));
 assert(html.indexOf('demo-results')>html.indexOf('demo-hero-bottom'));
 assert(!html.includes('Encuentra qué se dijo'));assert(!html.includes('demo-feature'));
 assert(html.includes('ambient-backdrop'));assert(html.includes('Ver video'));assert(html.includes('Ver contexto completo'));
 assert(!html.includes('<iframe'));assert(!html.includes('Buscando'));assert(!html.includes('semantic-v2'));
 assert(html.includes('data-cue-start-seconds'));assert(!html.includes('histórico completo'));
});

test('dates match static HTML in UTC and client rendering in Peru',()=>{
 const previous=process.env.TZ;
 try {for(const zone of ['UTC','America/Lima','Asia/Tokyo']){process.env.TZ=zone;assert.equal(demoDate('2024-09-05'),'5 set. 2024');assert.equal(demoDate('2026-09-04T00:25:19+00:00'),'3 set. 2026');}}
 finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('expanding a concept only exposes neighbours with shared reviewed evidence',()=>{
 for(const person of PEOPLE){
  const scope=demoSearch(person.id,'');
  for(const first of demoConnections(scope)){
   assert(first.items.length>0);
   for(const neighbour of demoConnections(first.items)){
    assert(neighbour.items.length>0);
    for(const m of neighbour.items){
     assert(m.topics.some(t=>t.label===first.label));
     assert(m.topics.some(t=>t.label===neighbour.label));
     assert(scope.some(source=>source.id===m.id));
    }
   }
  }
 }
 const keiko=demoConnections(demoSearch('keiko',''));
 const cerimedo=keiko.find(n=>n.label==='Cerimedo')!;
 assert.equal(cerimedo.items.length,2);
 assert(demoConnections(cerimedo.items).some(n=>n.label==='Brad Parscale'));
 assert(!demoConnections(cerimedo.items).some(n=>n.label==='ONPE'));
});

import {initialDemoGraph,expandDemoGraph} from '../src/lib/commercial-network';
test('click expansion preserves the root, existing nodes and edges across multiple branches',()=>{
 const scope=demoSearch('keiko','');
 const initial=initialDemoGraph('Keiko Fujimori',scope);
 const first=expandDemoGraph(initial,'topic:Cerimedo',scope);
 assert(first.nodes.length>initial.nodes.length);
 const second=expandDemoGraph(first,'topic:Fuerza Popular',scope);
 for(const before of [initial,first]){
  assert.equal(second.nodes[0].label,'Keiko Fujimori');
  for(const node of before.nodes){const kept=second.nodes.find(n=>n.id===node.id)!;assert(kept);assert.equal(kept.x,node.x);assert.equal(kept.y,node.y);}
  for(const edge of before.edges)assert(second.edges.some(e=>e.from===edge.from&&e.to===edge.to));
 }
 for(const edge of second.edges){
  assert(edge.momentIds.length>0);const a=second.nodes.find(n=>n.id===edge.from)!,b=second.nodes.find(n=>n.id===edge.to)!;
  assert(edge.momentIds.every(id=>a.items.some(m=>m.id===id)&&b.items.some(m=>m.id===id)));
 }
 assert.equal(expandDemoGraph(second,'topic:Cerimedo',scope),second);
});

test('demo expansion stops at depth two and retains the exact path evidence',()=>{
 const scope=demoSearch('keiko','');let graph=initialDemoGraph('Keiko Fujimori',scope);
 for(const node of [...graph.nodes].filter(n=>n.id!=='root'))graph=expandDemoGraph(graph,node.id,scope);
 const deep=graph.nodes.filter(n=>n.depth===2);assert(deep.length>0);
 for(const node of deep){assert.equal(expandDemoGraph(graph,node.id,scope),graph);assert.equal(node.path.length,3);for(const m of node.items)assert(node.path.slice(1).every(label=>m.topics.some(t=>t.label===label)));}
 assert(graph.nodes.every(n=>n.depth<=2));
});

import {projectNode,connectionPath} from '../src/lib/network-presentation';
test('perspective and lateral connections preserve evidence and the root anchor',()=>{
 const graph=initialDemoGraph('Keiko Fujimori',demoSearch('keiko',''));
 assert.deepEqual(projectNode(graph.nodes[0],0),{x:0,y:0,k:1});assert.deepEqual(projectNode(graph.nodes[0],80),{x:0,y:0,k:1});
 assert(new Set(graph.nodes.slice(1).map(n=>Math.round(Math.hypot(n.x,n.y)))).size>4);
 const lateral=graph.edges.filter(e=>e.from!=='root');assert(lateral.length>0);
 for(const edge of lateral){const a=graph.nodes.find(n=>n.id===edge.from)!,b=graph.nodes.find(n=>n.id===edge.to)!;assert(edge.momentIds.every(id=>a.items.some(m=>m.id===id)&&b.items.some(m=>m.id===id)));assert(connectionPath(projectNode(a),projectNode(b),edge.from+edge.to).includes(' Q '));}
 for(const n of graph.nodes){const p=projectNode(n,40);assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.k>0);}
});

import {focusDemoMoment,demoOccurrence} from '../src/lib/commercial-demo';
import DemoMomentList from '../src/components/DemoMomentList';
test('La República and inteligencia artificial retain the shared moment but use different source mentions',()=>{
 const base=DEMO_MOMENTS.find(m=>m.id==='8b3deb13a354')!;
 const newspaper=focusDemoMoment(base,'La República'),ai=focusDemoMoment(base,'inteligencia artificial');
 assert.equal(newspaper.id,ai.id);assert.equal(newspaper.occurrence,base.occurrence);assert.equal(ai.occurrence,base.occurrence);
 assert.equal(base.occurrence.cue_start_seconds,3084.64);
 assert.equal(demoOccurrence(newspaper).cue_start_seconds,3064.44);assert.equal(demoOccurrence(ai).cue_start_seconds,3181.359);
 assert.equal(evidenceStartSeconds(demoOccurrence(newspaper).cue_start_seconds),3061);
 assert.equal(evidenceStartSeconds(demoOccurrence(ai).cue_start_seconds),3178);
 assert.notEqual(newspaper.selectedEvidence!.quote,ai.selectedEvidence!.quote);
 for(const m of [newspaper,ai]){
  const html=renderToStaticMarkup(<DemoMomentList items={[m]} activeId={null} setActiveId={()=>{}}/>);
  assert(html.includes(m.selectedEvidence!.quote));assert(html.includes('Mención de '));
  assert(html.includes('t='+evidenceStartSeconds(demoOccurrence(m).cue_start_seconds)+'s'));
  assert(!html.includes('t=3081s'));assert(m.selectedEvidence!.excerptCueIds.length>1);
 }
});
test('all 68 curated topic connections have a dedicated source anchor, with nonliteral topics labelled honestly',()=>{
 let total=0,nonliteral=0;
 for(const m of DEMO_MOMENTS)for(const t of m.topics){
  const selected=focusDemoMoment(m,t.label),e=selected.selectedEvidence!;total++;
  assert(e);assert.equal(e.quote,t.quote);assert.equal(e.occurrence.videoId,m.episode.videoId);
  assert(e.context.some(c=>c.cueIds.includes(e.occurrence.cueId)));
  assert(e.context.some(c=>c.startSeconds<=e.occurrence.cue_start_seconds));
  assert(e.sourceHash.length===64);assert.equal(focusDemoMoment(selected).occurrence,m.occurrence);
  if(e.anchorType==='supporting-quote')nonliteral++;
 }
 assert.equal(total,68);assert(nonliteral>0);
 const security=focusDemoMoment(DEMO_MOMENTS.find(m=>m.id==='08265f25da0c')!,'seguridad');
 const html=renderToStaticMarkup(<DemoMomentList items={[security]} activeId={null} setActiveId={()=>{}}/>);
 assert(html.includes('Cita sobre '));assert(!html.includes('Mención de '));
});
