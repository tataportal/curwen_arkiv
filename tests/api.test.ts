import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as searchRoute } from '../src/app/api/search/route';
import { GET as episodesRoute } from '../src/app/api/episodes/route';
import { GET as episodeRoute } from '../src/app/api/episode/[youtube_id]/route';
import { getEpisodeByYoutubeId, getEpisodes, searchTranscript } from '../src/lib/search';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://archive-test.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-key';
const originalFetch=globalThis.fetch;
function response(body:unknown,status=200,total?:number) {return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...(total!=null?{'content-range':`0-23/${total}`}:{})}});}
test('database failure is HTTP 503, not a successful zero-result search',async()=>{
  globalThis.fetch=async()=>response({code:'PGRST202',message:'RPC missing'},404);
  try {const res=await searchRoute(new NextRequest('http://localhost/api/search?q=archivo'));assert.equal(res.status,503);assert((await res.json()).error);}finally{globalThis.fetch=originalFetch;}
});
test('zero matches are HTTP 200 with accurate zero totals',async()=>{
  globalThis.fetch=async()=>response({query:'nada',page:1,page_size:20,total_clusters:0,total_chunk_hits:0,total_occurrences:0,results:[]});
  try {const res=await searchRoute(new NextRequest('http://localhost/api/search?q=nada'));assert.equal(res.status,200);assert.equal((await res.json()).total_occurrences,0);}finally{globalThis.fetch=originalFetch;}
});
test('invalid pagination and video IDs are HTTP 400',async()=>{
  assert.equal((await episodesRoute(new NextRequest('http://localhost/api/episodes?page=-1'))).status,400);
  assert.equal((await episodeRoute(new NextRequest('http://localhost/api/episode/bad'),{params:Promise.resolve({youtube_id:'bad'})})).status,400);
});
test('catalog page beyond 100 and server filtering preserve exact total',async()=>{
  let url='';globalThis.fetch=async(u)=>{url=String(u);return response([{youtube_id:'abcdefghijk',transcript_chunks:[{count:5}]}],200,477);};
  try {const r=await getEpisodes(6,24,'archivo','asc');assert.equal(r.total,477);assert.equal(r.episodes[0].chunk_count,5);assert.match(url,/offset=120/);assert.match(url,/title=ilike/);}finally{globalThis.fetch=originalFetch;}
});
test('episode retrieves all transcript pages and propagates second-page failure',async()=>{
  let fail=false;
  globalThis.fetch=async(u)=>{const url=new URL(String(u));if(url.pathname.endsWith('/videos'))return response({id:'v',youtube_id:'abcdefghijk'});
    const offset=Number(url.searchParams.get('offset')||0);if(fail&&offset>0)return response({message:'database down'},500);
    return response(Array.from({length:Math.min(500,1105-offset)},(_,i)=>({id:String(offset+i)})),200,1105);};
  try {assert.equal((await getEpisodeByYoutubeId('abcdefghijk'))?.chunks.length,1105);fail=true;await assert.rejects(()=>getEpisodeByYoutubeId('abcdefghijk'));}finally{globalThis.fetch=originalFetch;}
});
test('environment variables are resolved after importing helpers',async()=>{
  globalThis.fetch=async()=>response({query:'archivo',page:1,page_size:20,total_clusters:0,total_chunk_hits:0,total_occurrences:0,results:[]});
  try {assert.equal((await searchTranscript('archivo')).total_clusters,0);}finally{globalThis.fetch=originalFetch;}
});
