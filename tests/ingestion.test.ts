import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverCorpus, prepareEpisode, corpusHasIssues } from '../src/lib/ingestion';
function fixture(run:(dir:string)=>void) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'curwen-test-'));try{run(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
const source='WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nArchivo de prueba';
const meta={id:'_bc_def-ghi',title:'Archivo',upload_date:'20260905'};
test('unique metadata IDs, orphans, playlist exclusion and duplicates are counted independently',()=>fixture(dir=>{
  fs.writeFileSync(path.join(dir,'a.info.json'),JSON.stringify(meta));
  fs.writeFileSync(path.join(dir,'duplicate.info.json'),JSON.stringify(meta));
  fs.writeFileSync(path.join(dir,'a.es-orig.vtt'),source);
  fs.writeFileSync(path.join(dir,'playlist.info.json'),JSON.stringify({id:'channel',_type:'playlist'}));
  fs.writeFileSync(path.join(dir,'missing.info.json'),JSON.stringify({...meta,id:'12345678901'}));
  fs.writeFileSync(path.join(dir,'20260905_abcdefghijk_orphan.vtt'),source);
  const {summary,pairs}=discoverCorpus(dir,477);
  assert.equal(summary.unique_videos,2);assert.equal(summary.valid_pairs,1);assert.equal(pairs.length,1);
  assert.deepEqual(summary.missing_vtt,['12345678901']);assert.deepEqual(summary.missing_json,['abcdefghijk']);
  assert.equal(summary.duplicates.json.length,1);assert.equal(summary.excluded_nonvideo_json.length,1);assert(corpusHasIssues(summary));
}));
test('conflicting transcripts are not selected silently',()=>fixture(dir=>{
  fs.writeFileSync(path.join(dir,'a.info.json'),JSON.stringify(meta));
  fs.writeFileSync(path.join(dir,meta.id+'.vtt'),source);fs.writeFileSync(path.join(dir,meta.id+'.es-orig.vtt'),source+' cambiado');
  const r=discoverCorpus(dir,1);assert.equal(r.pairs.length,0);assert.deepEqual(r.summary.conflicting_duplicate_ids,[meta.id]);
}));
test('preparation is deterministic and keeps cross-boundary cue context',()=>fixture(dir=>{
  const file=path.join(dir,'a.vtt');fs.writeFileSync(file,source+'\n\n00:01:01.000 --> 00:01:02.000\nSegunda parte');
  fs.writeFileSync(path.join(dir,'a.info.json'),JSON.stringify(meta));
  const pair=discoverCorpus(dir,1).pairs[0],a=prepareEpisode(pair),b=prepareEpisode(pair);
  assert.deepEqual(a,b);assert.equal(a.chunks.length,2);assert.equal(a.chunks[0].search_cues.length,2);
  fs.writeFileSync(file,source+' cambiado');assert.notEqual(prepareEpisode(pair).source_hash,a.source_hash);
}));
