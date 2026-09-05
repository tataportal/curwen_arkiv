import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClusteredSearchResult, SearchResponse, Video } from './types';
import { buildYouTubeTimestampUrl, formatTimestamp } from './utils';

export type IndexedFragment = { id:string; video_id:string; start_seconds:number; end_seconds:number; text:string; videos:Video };
export function groupIndexedFragments(query:string, hits:IndexedFragment[]):ClusteredSearchResult[] {
  const sorted = [...hits].sort((a,b)=>a.video_id.localeCompare(b.video_id)||a.start_seconds-b.start_seconds||a.id.localeCompare(b.id));
  const groups:ClusteredSearchResult[] = [];
  for (const hit of sorted) {
    const previous = groups.at(-1);
    const same = previous?.video_id === hit.video_id && hit.start_seconds - previous.primary_end_seconds <= 90 && hit.end_seconds - previous.primary_start_seconds <= 120;
    const timestamp = { chunk_id:hit.id, start_seconds:hit.start_seconds, end_seconds:hit.end_seconds, label:formatTimestamp(hit.start_seconds), text_snippet:hit.text };
    if (same && previous) {
      previous.primary_end_seconds = Math.max(previous.primary_end_seconds,hit.end_seconds);
      previous.combined_text += ' … ' + hit.text;
      previous.timestamps.push(timestamp);
    } else {
      groups.push({cluster_id:hit.id,video_id:hit.video_id,youtube_id:hit.videos.youtube_id,video_title:hit.videos.title,
        published_at:hit.videos.published_at,thumbnail_url:hit.videos.thumbnail_url,duration_seconds:hit.videos.duration_seconds,
        primary_start_seconds:hit.start_seconds,primary_end_seconds:hit.end_seconds,primary_label:timestamp.label,
        youtube_jump_url:buildYouTubeTimestampUrl(hit.videos.youtube_id,hit.start_seconds),combined_text:hit.text,
        headline:'',best_rank:0,timestamps:[timestamp],timestamp_precision:'fragment'});
    }
  }
  // Match density then date, with stable tie breakers. No arbitrary 80-hit cap.
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  groups.forEach(g=>{ g.best_rank = words.reduce((n,w)=>n + g.combined_text.toLocaleLowerCase().split(w).length-1,0) / Math.sqrt(Math.max(g.combined_text.length,1)); });
  return groups.sort((a,b)=>b.best_rank-a.best_rank||(b.published_at||'').localeCompare(a.published_at||'')||a.youtube_id.localeCompare(b.youtube_id)||a.primary_start_seconds-b.primary_start_seconds);
}
export async function searchIndexedFragments(db:SupabaseClient,query:string,page:number,pageSize:number,signal?:AbortSignal):Promise<SearchResponse> {
  const batchSize=500;
  async function batch(offset:number) {
    let request=db.from('transcript_chunks')
      .select('id,video_id,start_seconds,end_seconds,text,videos!inner(id,youtube_id,title,published_at,thumbnail_url,duration_seconds)',{count:'exact'})
      .textSearch('search_vector',query,{config:'spanish',type:'websearch'})
      .order('video_id').order('start_seconds').order('id').range(offset,offset+batchSize-1);
    if(signal) request=request.abortSignal(signal);
    const response=await request;
    if(response.error || !response.data || response.count===null) throw new Error(response.error?.message||'Missing search response');
    return {hits:response.data as unknown as IndexedFragment[],total:response.count};
  }
  const first=await batch(0);
  const hits=[...first.hits];
  // Read all matches before clustering/pagination; nearby fragments cannot split
  // at HTTP page boundaries. Three read requests maximum at a time.
  for(let offset=batchSize;offset<first.total;offset+=batchSize*3) {
    const offsets=[offset,offset+batchSize,offset+batchSize*2].filter(n=>n<first.total);
    const pages=await Promise.all(offsets.map(batch));
    for(const p of pages) hits.push(...p.hits);
  }
  signal?.throwIfAborted();
  const unique=[...new Map(hits.map(h=>[h.id,h])).values()];
  const groups=groupIndexedFragments(query,unique);
  return {query,page,page_size:pageSize,total_clusters:groups.length,total_chunk_hits:unique.length,total_occurrences:unique.length,
    total_episodes:new Set(unique.map(h=>h.video_id)).size,timestamp_precision:'fragment',results:groups.slice((page-1)*pageSize,page*pageSize)};
}
