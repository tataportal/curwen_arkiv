import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CommercialDemo from '../src/components/CommercialDemo';
import {DEMO_MOMENTS,PEOPLE,demoSearch,demoGroups,normalizeDemo} from '../src/lib/commercial-demo';
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
 assert(html.includes('cobertura parcial'));assert(html.includes('Lo público y lo privado'));
 assert(html.includes('Copiar momento'));assert(html.includes('Comparar momentos'));
 assert(!html.includes('<iframe'));assert(!html.includes('Buscando'));assert(!html.includes('semantic-v2'));
 assert(html.includes('Mención '));assert(html.includes('histórico completo'));
});
