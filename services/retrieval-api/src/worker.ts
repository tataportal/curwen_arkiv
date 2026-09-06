import {retrieve,type RetrievalSource} from './retrieval/search';
import {normalizeQuery} from './retrieval/query';
import {RETRIEVAL_VERSION,type SpeechTimeline,type SpeechToken} from './retrieval/model';
import manifest from '../data/manifest.json';
type Env={ASSETS:{fetch(request:Request):Promise<Response>}};
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json; charset=utf-8','X-Retrieval-Version':RETRIEVAL_VERSION};
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{...headers,'Cache-Control':status===200?'public, max-age=300':'no-store'}});}
function source(env:Env,base:string):RetrievalSource {
 const metas=new Map(manifest.episodes.map(e=>[e.videoId,e]));
 return {snapshotId:manifest.snapshotId,async candidates(query){
  const ids=new Set<string>();const postings=manifest.postings as Record<string,string[]>;
  for(const alias of query.aliases){const lists=alias.words.map(w=>Object.hasOwn(postings,w)?postings[w]:[]).sort((a,b)=>a.length-b.length);const rest=lists.slice(1).map(x=>new Set(x));for(const id of lists[0]??[])if(rest.every(s=>s.has(id)))ids.add(id);}
  return [...ids].sort().map(id=>{const e=metas.get(id)!;return {videoId:id,title:e.title,publishedAt:e.publishedAt};});
 },async timeline(id,signal){
  signal?.throwIfAborted();const e=metas.get(id);if(!e)throw new RangeError('Episode outside approved snapshot');
  const r=await env.ASSETS.fetch(new Request(new URL('/data/'+e.file,base)));if(!r.ok)throw Error('Snapshot asset unavailable');
  const bytes=await r.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==e.sha256)throw Error('Snapshot checksum mismatch');
  const value=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json() as {version:string;videoId:string;tokens:[string,string,string,number,number,number,number][];sentences:SpeechTimeline['sentences']};
  if(value.version!==RETRIEVAL_VERSION||value.videoId!==id)throw Error('Invalid provenance');
  return {...value,rawCues:[],cleanCues:[],tokens:value.tokens.map(t=>({text:t[0],key:t[1],cueId:t[2],startSeconds:t[3],endSeconds:t[4],wordStartSeconds:t[5],explicitTime:!!t[6]} satisfies SpeechToken))};
 }};
}
// Serialize work per isolate to bound memory while parsing long episodes.
let running=Promise.resolve();
const responseCache=new Map<string,{body:string;expires:number}>();
let cacheBytes=0;
export default {async fetch(request:Request,env:Env){
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const url=new URL(request.url);
 if(url.pathname==='/health'||url.pathname==='/')return json({version:RETRIEVAL_VERSION,snapshotId:manifest.snapshotId,totalEpisodes:manifest.episodes.length,timestampField:'occurrence.cue_start_seconds'});
 if(url.pathname!=='/api/search')return json({error:'Not found'},404);
 try{
  const q=url.searchParams.get('q')||'',page=Number(url.searchParams.get('page')||1),size=Number(url.searchParams.get('page_size')||20);
  normalizeQuery(q);if(!Number.isSafeInteger(page)||page<1||page>1000000||!Number.isInteger(size)||size<1||size>100)throw new RangeError('Paginación inválida.');
  const cacheKey=q.trim()+'|'+page+'|'+size;
  const cached=responseCache.get(cacheKey);if(cached&&cached.expires>Date.now())return new Response(cached.body,{headers});
  const job=running.then(()=>retrieve(source(env,url.origin),q,page,size,{},request.signal));running=job.then(()=>{},()=>{});
  const result=json(await job);const body=await result.text();
  if(body.length<4000000){const old=responseCache.get(cacheKey);if(old){cacheBytes-=old.body.length;responseCache.delete(cacheKey);}
   while(cacheBytes+body.length>4000000&&responseCache.size){const first=responseCache.keys().next().value!;cacheBytes-=responseCache.get(first)!.body.length;responseCache.delete(first);}
   responseCache.set(cacheKey,{body,expires:Date.now()+300000});cacheBytes+=body.length;}
  return new Response(body,{headers:result.headers});
 }catch(e){console.error(e instanceof Error?e.message:'Retrieval failed');return json({error:e instanceof RangeError?e.message:'No se pudo consultar el archivo.'},e instanceof RangeError?400:503);}
}};
