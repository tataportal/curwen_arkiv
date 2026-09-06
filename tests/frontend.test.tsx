import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SearchExperience from '../src/components/SearchExperience';
import SearchResults from '../src/components/SearchResults';
import NetworkExplorer from '../src/components/NetworkExplorer';
import { Highlight, TimestampLink } from '../src/components/ArchivePrimitives';
import type { ClusteredSearchResult } from '../src/lib/types';

test('initial home contains only the search instrument and accessible hidden text', () => {
  const html = renderToStaticMarkup(<SearchExperience />);
  assert.equal((html.match(/<input/g) || []).length, 1);
  assert(!html.includes('<nav'));
  assert(!html.includes('network-explorer'));
  assert(!html.includes('CURWEN ARCHIVE'));
});
test('timestamp links are exact external YouTube links, including fractional cue times', () => {
  const html = renderToStaticMarkup(<TimestampLink youtubeId="testvideo01" seconds={1112.9} />);
  assert(html.includes('https://youtube.com/watch?v=testvideo01&amp;t=1112.9'));
  assert(html.includes('18:32'));
  assert(html.includes('target="_blank"'));
  assert(html.includes('noopener noreferrer'));
});
test('safe literal highlighting never treats transcript text as HTML or query as regex', () => {
  const html = renderToStaticMarkup(<Highlight text={'<script>alert(1)</script> [a]'} query="[a]" />);
  assert(!html.includes('<script>'));
  assert(html.includes('<mark>[a]</mark>'));
});
test('compact moments keep independent clusters and defer all full context', () => {
  // Neutral test-only fixtures; never connected to the running application.
  const moment: ClusteredSearchResult = {
    cluster_id: 'one', video_id: 'video', youtube_id: 'testvideo01', video_title: 'Test episode',
    published_at: null, thumbnail_url: null, duration_seconds: null, primary_start_seconds: 751,
    primary_end_seconds: 784, primary_label: '12:31', youtube_jump_url: '', combined_text: 'Test text',
    headline: '', best_rank: 1, timestamps: [
      { chunk_id: 'a', start_seconds: 751, end_seconds: 764, label: '12:31', text_snippet: 'Test text' },
      { chunk_id: 'b', start_seconds: 769, end_seconds: 784, label: '12:49', text_snippet: 'Continued test text' },
    ],
  };
  const html = renderToStaticMarkup(<SearchResults results={[moment, { ...moment, cluster_id:'two', primary_start_seconds:1600, timestamps:[] }]} query="test" />);
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
 assert.equal(searchExpression('Vacunas, Keiko'),'"Vacunas" "Keiko"');
 const text='Antes. '.repeat(30)+'La compra de vacunas ocurrió durante la pandemia. Más contexto. '.repeat(10);
 const excerpt=conciseExcerpt(text,'vacunas');
 assert(excerpt.includes('vacunas'));assert(excerpt.length<=204);assert(!excerpt.includes('Antes. Antes. Antes. Antes.'));
 const e={youtubeId:'testvideo01',title:'episode',text:'Evidence',precision:'cue' as const,chunkId:'1',seconds:42};
 const items=evidenceMoments([e,e,{...e,chunkId:'2',seconds:12}]);
 assert.equal(items.length,2);assert.deepEqual(chronologicalMoments(items).map(i=>i.seconds),[12,42]);
});
