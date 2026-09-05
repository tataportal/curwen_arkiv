import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseVTTCues, parseAndChunkVTT, deduplicateRollingText } from '../src/lib/vtt-parser';
import { generateDeterministicChunkId } from '../src/lib/chunk-id';
const vtt = (body: string) => `WEBVTT\nKind: captions\nLanguage: es\n\n${body}`;
test('rolling overlap has no twelve-word cap', () => {
  const words = 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce';
  assert.equal(deduplicateRollingText('antes '+words, words+' después'), 'después');
  assert.equal(deduplicateRollingText(words, words), '');
});
test('source inline timestamp points to first NEW word, not rolling prefix', () => {
  const cues = parseVTTCues(vtt('00:00:00.000 --> 00:00:02.000\nhola amigos\n\n00:00:02.000 --> 00:00:05.000\nhola amigos<00:00:03.250><c> bienvenidos</c>'));
  assert.deepEqual(cues.map(c=>[c.start_seconds,c.text]), [[0,'hola amigos'],[3.25,'bienvenidos']]);
});
test('repeated speech after a pause is retained and numerical speech is not discarded', () => {
  const cues = parseVTTCues(vtt('1\n00:00:00.000 --> 00:00:01.000\n2026\n\n2\n00:00:10.000 --> 00:00:11.000\n2026'));
  assert.equal(cues.length,2); assert.equal(cues[1].text,'2026');
});
test('YouTube single-space payload lines, CRLF and markup are handled', () => {
  const cues = parseVTTCues(vtt('00:00:00.000 --> 00:00:02.000 align:start\n \nHola &amp; adiós').replace(/\n/g,'\r\n'));
  assert.equal(cues[0].text,'Hola & adiós');
});
test('every canonical cue survives chunking including short tails', () => {
  const source=vtt('00:00:00.000 --> 00:00:02.000\na\n\n00:01:10.000 --> 00:01:12.000\nfin');
  const cues=parseVTTCues(source), chunks=parseAndChunkVTT(source);
  assert.deepEqual(chunks.flatMap(c=>c.cues),cues);assert.equal(chunks.length,2);
});
test('corrupt and empty captions fail explicitly', () => {
  for(const source of ['garbage', 'WEBVTT\n\n',vtt('00:00:04.000 --> 00:00:01.000\nno'),vtt('00:XX:00.000 --> 00:00:10.000\nno')])assert.throws(()=>parseVTTCues(source));
});
test('real source cue sequence is stable and deterministic', () => {
  const name=fs.readdirSync('data/raw').filter(n=>n.endsWith('.vtt')).sort()[0];
  const source=fs.readFileSync('data/raw/'+name,'utf8');const a=parseAndChunkVTT(source),b=parseAndChunkVTT(source);
  assert.deepEqual(a,b);assert(a.length>0);
  assert.equal(a.flatMap(c=>c.cues).map(c=>c.text).join(' '),a.map(c=>c.text).join(' '));
  assert.equal(generateDeterministicChunkId('abcdefghijk',1.234,8.5),generateDeterministicChunkId('abcdefghijk',1.234,8.5));
});
test('YouTube final word timestamp may exceed display cue end by 10 ms', () => {
  const cues=parseVTTCues(vtt('00:00:00.000 --> 00:00:02.990\ntexto<00:00:03.000><c> final</c>'));
  assert.equal(cues[0].text,'texto final');assert.equal(cues[0].end_seconds,2.99);
});
