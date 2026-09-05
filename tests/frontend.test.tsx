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
  assert(html.includes('https://youtube.com/watch?v=testvideo01&amp;t=1112'));
  assert(html.includes('18:32'));
  assert(html.includes('target="_blank"'));
  assert(html.includes('noopener noreferrer'));
});
test('safe literal highlighting never treats transcript text as HTML or query as regex', () => {
  const html = renderToStaticMarkup(<Highlight text={'<script>alert(1)</script> [a]'} query="[a]" />);
  assert(!html.includes('<script>'));
  assert(html.includes('<mark>[a]</mark>'));
});
test('episode sections retain independent API clusters and nested cue evidence', () => {
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
  assert.equal((html.match(/<article/g) || []).length, 1);
  assert.equal((html.match(/class="occurrence"/g) || []).length, 2);
  assert.equal((html.match(/<details/g) || []).length, 1);
  assert(!html.includes('<iframe'));
});
test('unconnected graph never invents edges; a pair of user terms remains unconnected', () => {
  const html = renderToStaticMarkup(<NetworkExplorer query="Term A + Term B" />);
  assert.equal((html.match(/class="network-node /g) || []).length, 2);
  assert(!html.includes('<line'));
  assert(!html.includes('network-evidence'));
});
