import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchTranscript,getEpisodeByYoutubeId} from '../src/lib/search';
import {groupIndexedFragments,type IndexedFragment} from '../src/lib/legacy-search';
import {buildEvidenceBranch,buildCommonPaths,containsTerm} from '../src/lib/evidence-network';
import type {SearchResponse,ClusteredSearchResult,Video} from '../src/lib/types';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://archive-test.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-key';
const original=globalThis.fetch;
const video:Video={id:'v',youtube_id:'testvideo01',title:'Test episode',published_at:'2026-01-01',description:null,duration_seconds:5000,thumbnail_url:null,youtube_url:null};
const fragment=(i:number,start:number,text='Archive Subject and Central Library'):IndexedFragment=>({id:String(i),video_id:'v',start_seconds:start,end_seconds:start+30,text,videos:video});
const reply=(data:unknown,status=200,count?:number)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...(count===undefined?{}:{'content-range':'0-499/'+count})}});
test('missing RPC uses live full-text rows, counts all groups before paginating',async()=>{
  const rows=Array.from({length:501},(_,i)=>fragment(i,i*200));
  globalThis.fetch=async(u)=>{
    const url=new URL(String(u));if(url.pathname.includes('/rpc/'))return reply({code:'PGRST202',message:'RPC missing'},404);
    assert(url.searchParams.get('search_vector')?.includes('wfts(spanish)'));
    const offset=Number(url.searchParams.get('offset')||0);return reply(rows.slice(offset,offset+500),200,rows.length);
  };
  try{const r=await searchTranscript('Archive Subject',26,20);assert.equal(r.total_clusters,501);assert.equal(r.results.length,1);assert.equal(r.timestamp_precision,'fragment');assert.equal(r.total_episodes,1);}finally{globalThis.fetch=original;}
});
test('real RPC permission failures are not silently downgraded to an empty search',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return reply({code:'42501',message:'Permission denied'},403);};
 try{await assert.rejects(()=>searchTranscript('archive'));assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('legacy episode without cues still returns actual transcript fields',async()=>{
 const selects:string[]=[];globalThis.fetch=async(u)=>{
  const url=new URL(String(u));if(url.pathname.endsWith('/videos'))return reply(video);
  const select=url.searchParams.get('select')||'';selects.push(select);
  return select.includes('cues')?reply({code:'42703',message:'column transcript_chunks.cues does not exist'},400):reply([fragment(0,20)],200,1);
 };
 try{const r=await getEpisodeByYoutubeId('testvideo01');assert.equal(r?.chunks[0].start_seconds,20);assert.equal(selects.length,2);assert(!selects[1].includes('cues'));}finally{globalThis.fetch=original;}
});
test('discussion grouping joins neighboring fragments but preserves distant moments',()=>{
 const r=groupIndexedFragments('archive',[fragment(1,0),fragment(2,45),fragment(3,250)]);
 assert.equal(r.length,2);assert.equal(r.find(c=>c.primary_start_seconds===0)?.timestamps.length,2);
});
const moment=(id:string,text:string):ClusteredSearchResult=>({...groupIndexedFragments('Archive Subject',[fragment(Number(id),Number(id)*200,text)])[0]});
const response=(moments:ClusteredSearchResult[]):SearchResponse=>({query:'Archive Subject',page:1,page_size:20,total_clusters:moments.length,total_occurrences:moments.length,total_chunk_hits:moments.length,results:moments});
test('every co-mention edge quotes text containing both terms and real source seconds',()=>{
 const r=response([moment('1','Archive Subject meets Central Library.'),moment('2','Central Library mentions Archive Subject.')]);
 const branch=buildEvidenceBranch('Archive Subject',r);
 const relation=branch.edges.find(e=>e.target==='term:central library');
 assert(relation);assert.equal(relation.evidence.length,2);
 for(const e of relation.evidence){assert(containsTerm(e.text,'Archive Subject'));assert(containsTerm(e.text,'Central Library'));assert(e.seconds>=0);}
});
test('an unrelated capitalized name never creates a term edge',()=>{
 const r=response([moment('1','Central Library discusses Another Place.'),moment('2','Another Place includes Central Library.')]);
 assert(!buildEvidenceBranch('Archive Subject',r).edges.some(e=>e.target.startsWith('term:')));
});
test('paths require both terms in the same evidence fragment, not merely the same episode',()=>{
 const separate=response([moment('1','Archive Subject only.'),moment('2','Central Library only.')]);
 assert.equal(buildCommonPaths('Archive Subject','Central Library',separate).length,0);
 const together=response([moment('3','Archive Subject discusses Central Library.')]);
 assert.equal(buildCommonPaths('Archive Subject','Central Library',together)[0].edges.length,2);
});
test('literal boundaries prevent partial surname or accent errors',()=>{
 assert(containsTerm('Interviene José Pérez.','jose perez'));assert(!containsTerm('Interviene Josefina.','jose'));
});
