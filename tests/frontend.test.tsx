import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SearchExperience from '../src/components/SearchExperience';
import SearchResults from '../src/components/SearchResults';
import NetworkExplorer from '../src/components/NetworkExplorer';
import { Highlight, TimestampLink } from '../src/components/ArchivePrimitives';
import {fixture,response} from './retrieval-fixture';
import {validateRetrievalResponse} from '../src/lib/retrieval-contract';
import {resultMoments} from '../src/lib/evidence-presentation';

test('initial home contains only the search instrument and accessible hidden text', () => {
  const html = renderToStaticMarkup(<SearchExperience />);
  assert.equal((html.match(/<input/g) || []).length, 1);
  assert(!html.includes('<nav'));
  assert(!html.includes('network-explorer'));
  assert(!html.includes('CURWEN ARCHIVE'));
});
test('timestamp links use the whole second containing the cue for YouTube compatibility', () => {
  const html = renderToStaticMarkup(<TimestampLink youtubeId="testvideo01" seconds={1112.9} />);
  assert(html.includes('https://www.youtube.com/watch?v=testvideo01&amp;t=1109s'));
  assert(html.includes('18:29'));
  assert(html.includes('target="_blank"'));
  assert(html.includes('noopener noreferrer'));
});
test('safe literal highlighting never treats transcript text as HTML or query as regex', () => {
  const html = renderToStaticMarkup(<Highlight text={'<script>alert(1)</script> [a]'} query="[a]" />);
  assert(!html.includes('<script>'));
  assert(html.includes('<mark>[a]</mark>'));
});
test('compact moments keep independent clusters and defer all full context', () => {
  const episode=fixture();
  const two={...episode,videoId:'testvideo02',moments:episode.moments.map(m=>({...m,momentId:'two'}))};
  const html=renderToStaticMarkup(<SearchResults episodes={[episode,two]} query="Archive"/>);
  assert.equal((html.match(/<article/g) || []).length, 2);
  assert.equal((html.match(/class="compact-moment"/g) || []).length, 2);
  assert(!html.includes('Continued test text'));
  assert.equal((html.match(/Ver contexto completo/g)||[]).length,2);
  assert(!html.includes('<iframe'));
});
test('unconnected graph never invents edges; a pair of user terms remains unconnected', () => {
  const html = renderToStaticMarkup(<NetworkExplorer query="Term A + Term B" />);
  assert.equal((html.match(/class="network-node /g) || []).length, 2);
  assert(!html.includes('<line'));
  assert(!html.includes('network-evidence'));
  assert(!html.includes('network-inspector'));
});

import {conciseExcerpt,queryConcepts,searchExpression,chronologicalMoments,evidenceMoments} from '../src/lib/evidence-presentation';
test('query pairs and short excerpts retain source words, not invented connections',()=>{
 assert.deepEqual(queryConcepts('Vacunas, Keiko'),['Vacunas','Keiko']);
 assert.deepEqual(queryConcepts('Vacunas + Keiko'),['Vacunas','Keiko']);
 assert.equal(searchExpression('Vacunas, Keiko'),'Vacunas, Keiko');
 const text='Antes. '.repeat(30)+'La compra de vacunas ocurrió durante la pandemia. Más contexto. '.repeat(10);
 const excerpt=conciseExcerpt(text,'vacunas');
 assert(excerpt.includes('vacunas'));assert(excerpt.length<=204);assert(!excerpt.includes('Antes. Antes. Antes. Antes.'));
 const e=resultMoments([fixture()])[0];
 const items=evidenceMoments([e,e,{...e,momentId:'two',seconds:42}]);
 assert.equal(items.length,2);assert.deepEqual(chronologicalMoments(items).map(i=>i.seconds),[12.34,42]);
});

test('processed moments render reviewed content while preserving the matching cue timestamp',()=>{
 const episode=fixture();
 episode.moments[0].startSeconds=0;
 episode.moments[0].processed={version:'semantic-v2.0',title:'Debate sobre la biblioteca',summary:'Se comenta una propuesta para la biblioteca.',excerpt:'Archive Subject meets Central Library.',eligibility:'medium',primaryFamily:'SOCIEDAD',topics:['Bibliotecas','Acceso a la cultura']};
 const payload=response([episode]);validateRetrievalResponse(payload);
 const html=renderToStaticMarkup(<SearchResults episodes={[episode]} query="Archive"/>);
 assert(html.includes('Debate sobre la biblioteca'));assert(html.includes('Central Library'));
 assert(html.includes('Test episode'));assert(html.includes('Bibliotecas · Acceso a la cultura'));
 assert(html.includes('data-cue-start-seconds="12.34"'));assert(html.includes('t=9s'));
 assert(!html.includes('Se comenta una propuesta'));assert(!html.includes('full-moment-context'));
});
test('low-quality processed content requires a neutral title and literal excerpt without a generated summary',()=>{
 const episode=fixture();
 episode.moments[0].processed={version:'semantic-v2.0',title:'Mención de Archive Subject',summary:null,excerpt:'Archive Subject meets Central Library.',eligibility:'low',primaryFamily:'SOCIEDAD',topics:[]};
 validateRetrievalResponse(response([episode]));
 const html=renderToStaticMarkup(<SearchResults episodes={[episode]} query="Archive"/>);
 assert(html.includes('Mención de Archive Subject'));assert(html.includes('Central Library'));
 episode.moments[0].processed.summary='Unsupported polished summary';
 assert.throws(()=>validateRetrievalResponse(response([episode])),/semántica/);
});

test('evidence lead-in clamps to zero without changing cue identity',()=>{
 const html=renderToStaticMarkup(<TimestampLink youtubeId="testvideo01" seconds={1.25}/>);
 assert(html.includes('t=0s'));assert(html.includes('00:00'));assert(html.includes('data-cue-start-seconds="1.25"'));
});

test('moment excerpt recovers preceding cue text while retaining original evidence time',async()=>{
 const {momentExcerpt}=await import('../src/lib/evidence-presentation');
 const {evidenceStartSeconds}=await import('../src/lib/utils');
 const item=resultMoments([fixture()])[0];
 item.occurrence={...item.occurrence,cue_start_seconds:12.34};
 item.evidenceTokens=[
  {text:'Anterior fuera.',key:'fuera',cueId:'old',startSeconds:1,endSeconds:8,wordStartSeconds:1,explicitTime:false},
  {text:'Contexto previo.',key:'previo',cueId:'before',startSeconds:8.5,endSeconds:11,wordStartSeconds:8.5,explicitTime:false},
  {text:'Archive Subject.',key:'archive',cueId:'match',startSeconds:12.34,endSeconds:15,wordStartSeconds:12.34,explicitTime:false}
 ];
 assert.equal(evidenceStartSeconds(12.34),9);
 assert.equal(momentExcerpt(item,'Archive'),'Contexto previo. Archive Subject.');
 assert.equal(item.occurrence.cue_start_seconds,12.34);
});
