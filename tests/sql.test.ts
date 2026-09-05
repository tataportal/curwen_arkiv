import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { testDatabase } from './database';
let db:PGlite;
before(async()=>{ db=await testDatabase(); });
after(async()=>{await db?.close();});
const metadata={youtube_id:'abcdefghijk',title:'Test fixture',published_at:'2026-09-05T00:00:00Z',duration_seconds:40000};
function chunk(start:number,text:string,index:number,search?:any[]) {
  const cue={cue_index:index,start_seconds:start,end_seconds:start+1,text};
  return {id:randomUUID(),start_seconds:start,end_seconds:start+1,text,cues:[cue],search_cues:search||[cue],search_text:(search||[cue]).map(c=>c.text).join(' ')};
}
async function replace(chunks:any[],episode=metadata) {
  const hash=createHash('sha256').update(JSON.stringify({chunks,episode})).digest('hex');
  return (await db.query<{r:any}>('select replace_archive_episode($1,$2,$3,$4) r',[JSON.stringify(episode),JSON.stringify(chunks),hash,'2.0.0'])).rows[0].r;
}
async function search(q:string,page=1,size=20) {return (await db.query<{r:any}>('select search_archive($1,$2,$3) r',[q,page,size])).rows[0].r;}
test('atomic replacement, no-op re-run, removed chunks and rollback on a late write failure',async()=>{
  const a=chunk(1,'archivo original',0),b=chunk(70,'segunda parte',1);
  assert.equal((await replace([a,b])).status,'replaced');assert.equal((await replace([a,b])).status,'unchanged');
  const before=(await db.query<any>('select * from videos')).rows;
  await assert.rejects(()=>replace([a,{...b,id:'not-a-uuid'}],{...metadata,title:'Must roll back'}));
  assert.deepEqual((await db.query<any>('select * from videos')).rows,before);
  assert.equal((await db.query<any>('select count(*)::int n from transcript_chunks')).rows[0].n,2);
  await replace([a]);assert.equal((await db.query<any>('select count(*)::int n from transcript_chunks')).rows[0].n,1);
  await assert.rejects(()=>replace([]));
});
test('Spanish stemming and quoted phrases across chunk/cue boundaries retain exact first cue timestamp',async()=>{
  const second={cue_index:1,start_seconds:61.25,end_seconds:62.5,text:'ilegales en el país'};
  const first={cue_index:0,start_seconds:59.5,end_seconds:60.5,text:'minería'};
  const a=chunk(59.5,'minería',0,[first,second]);a.end_seconds=60.5;a.cues=[first];
  const b=chunk(61.25,second.text,1);b.end_seconds=62.5;b.cues=[second];b.search_cues=[second];
  await replace([a,b]);
  for(const q of ['minería ilegal','"minería ilegales"']){const r=await search(q);assert.equal(r.total_occurrences,1);assert.equal(r.results[0].start_seconds,59.5);assert.equal(r.results[0].end_seconds,62.5);}
  const old=await db.query<any>('select * from search_transcript_chunks($1)', ['minería']);assert.equal(old.rows.length,1);assert.match(String(old.rows[0].headline),/<mark>/);
});
test('all >80 matches paginate with exact totals, deterministic order and complete clusters',async()=>{
  const chunks=Array.from({length:135},(_,i)=>{
    const a={cue_index:i*2,start_seconds:i*200,end_seconds:i*200+1,text:'archivo verificable'};
    const b={cue_index:i*2+1,start_seconds:i*200+10,end_seconds:i*200+11,text:'archivo verificable'};
    return {...chunk(i*200,'archivo verificable archivo verificable',i*2),end_seconds:b.end_seconds,cues:[a,b],search_cues:[a,b],search_text:a.text+' '+b.text};
  });
  await replace(chunks);
  const seen=new Set();
  for(let page=1;page<=7;page++) {const r=await search('archivo',page);assert.equal(r.total_occurrences,270);assert.equal(r.total_chunk_hits,135);assert.equal(r.total_clusters,135);
    for(const row of r.results){assert.equal(row.timestamps.length,2);assert(!seen.has(row.grp));seen.add(row.grp);}}
  assert.equal(seen.size,135);const beyond=await search('archivo',20);assert.equal(beyond.total_clusters,135);assert.deepEqual(beyond.results,[]);
  const empty=await search('inexistente');assert.equal(empty.total_occurrences,0);assert.deepEqual(empty.results,[]);
  assert.equal((await search('el la de')).total_occurrences,0);
});
test('anonymous writes are denied; reads and search remain public',async()=>{
  assert.equal((await db.query<any>("select has_function_privilege('anon','replace_archive_episode(jsonb,jsonb,text,text)','EXECUTE') ok")).rows[0].ok,false);
  await db.exec('SET ROLE anon');
  try {assert((await search('archivo')).total_occurrences>0);await assert.rejects(()=>replace([chunk(5,'forbidden',0)]));}finally{await db.exec('RESET ROLE');}
});
test('real episode round-trip preserves every cue and repeat import is unchanged',async()=>{
  const { discoverCorpus,prepareEpisode }=await import('../src/lib/ingestion');
  const corpus=discoverCorpus('data/raw');
  const pair=corpus.pairs.find(p=>p.metadata.youtube_id==='T9ojaSxdyGw')!;
  const prepared=prepareEpisode(pair);
  const call=async()=> (await db.query<{r:any}>('select replace_archive_episode($1,$2,$3,$4) r',
    [JSON.stringify(prepared.metadata),JSON.stringify(prepared.chunks),prepared.source_hash,prepared.parser_version])).rows[0].r;
  assert.equal((await call()).status,'replaced');assert.equal((await call()).status,'unchanged');
  const stored=await db.query<any>('select c.* from transcript_chunks c join videos v on v.id=c.video_id where v.youtube_id=$1 order by c.start_seconds',[pair.metadata.youtube_id]);
  assert.deepEqual(stored.rows.map(c=>({id:c.id,text:c.text,cues:c.cues,search_cues:c.search_cues})),prepared.chunks.map(c=>({id:c.id,text:c.text,cues:c.cues,search_cues:c.search_cues})));
  const start=performance.now();const found=await search('Keiko');
  assert(found.total_occurrences>0);
  const cues=prepared.chunks.flatMap(c=>c.cues);
  for(const group of found.results.filter((r:any)=>r.youtube_id===pair.metadata.youtube_id))for(const occurrence of group.timestamps){
    const source=cues.find(c=>c.cue_index===occurrence.cue_index);assert(source);assert.equal(occurrence.start_seconds,source.start_seconds);
  }
  console.log(`Real episode: ${prepared.chunks.length} chunks, ${cues.length} cues; Keiko ${found.total_occurrences} occurrences; search ${Math.round(performance.now()-start)} ms`);
});
