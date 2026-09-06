import type {Evidence} from './evidence-network';
import type {ClusteredSearchResult} from './types';
export interface EvidenceMoment extends Evidence { id:string; context:Evidence[] }
export function queryConcepts(query:string):string[] {
  return [...new Set(query.split(/\s*(?:,|\+)\s*/).map(s=>s.trim()).filter(Boolean))].slice(0,2);
}
export function searchExpression(query:string) {
  const terms=queryConcepts(query);
  return terms.length>1?terms.map(t=>'"'+t.replaceAll('"','')+'"').join(' '):query;
}
/** Short literal excerpt, never a generated summary. */
export function conciseExcerpt(text:string,query:string,max=200) {
  const clean=text.replace(/\s+/g,' ').trim();
  const terms=queryConcepts(query).flatMap(t=>t.split(/\s+/)).filter(t=>t.length>2);
  const positions=terms.map(t=>clean.toLocaleLowerCase().indexOf(t.toLocaleLowerCase())).filter(i=>i>=0);
  const at=positions.length?Math.min(...positions):0;
  const sentences=[...new Intl.Segmenter('es',{granularity:'sentence'}).segment(clean)];
  const index=Math.max(0,sentences.findIndex(s=>s.index<=at&&s.index+s.segment.length>at));
  let start=sentences[index]?.index||0;
  if(at-start>max-40){start=Math.max(start,at-50);const space=clean.indexOf(' ',start);if(space>=0&&space<at)start=space+1;}
  const last=sentences[Math.min(index+1,sentences.length-1)];
  const limit=last?last.index+last.segment.length:clean.length;
  let end=Math.min(start+max,limit);
  if(end<limit){const space=clean.lastIndexOf(' ',end);if(space>start)end=space;}
  return (start?'… ':'')+clean.slice(start,end).trim()+(end<clean.length?' …':'');
}
export function evidenceMoments(evidence:Evidence[]):EvidenceMoment[] {
  return [...new Map(evidence.map(e=>[e.youtubeId+':'+e.chunkId+':'+e.seconds,e])).entries()]
    .map(([id,e])=>({...e,id,context:[e]}));
}
export function resultMoments(results:ClusteredSearchResult[]):EvidenceMoment[] {
  return results.map(r=>({id:r.cluster_id,youtubeId:r.youtube_id,title:r.video_title,seconds:r.primary_start_seconds,
    endSeconds:r.primary_end_seconds,text:r.combined_text,precision:r.timestamp_precision||'cue',chunkId:r.timestamps[0]?.chunk_id||r.cluster_id,
    context:r.timestamps.map(t=>({youtubeId:r.youtube_id,title:r.video_title,seconds:t.start_seconds,endSeconds:t.end_seconds,
      text:t.text_snippet,precision:r.timestamp_precision||'cue',chunkId:t.chunk_id}))}));
}
export function chronologicalMoments(items:EvidenceMoment[]) {
  const groups=new Map<string,EvidenceMoment[]>();
  for(const item of items)groups.set(item.youtubeId,[...(groups.get(item.youtubeId)||[]),item]);
  return [...groups.values()].flatMap(group=>group.sort((a,b)=>a.seconds-b.seconds));
}
