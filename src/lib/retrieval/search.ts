import {normalizeQuery} from './query';
import {findOccurrences} from './occurrences';
import {createMoments,retrievalConfig} from './moments';
import {momentDiagnostics} from './diagnostics';
import {RETRIEVAL_VERSION,type EpisodeMetadata,type RetrievalConfig,type RetrievalEpisode,type RetrievalResponse,type SearchQuery,type SpeechTimeline} from './model';
export interface RetrievalSource {
  snapshotId:string;
  // Candidate lookup is only a superset filter; never evidence or result boundaries.
  candidates(query:SearchQuery,signal?:AbortSignal):Promise<EpisodeMetadata[]>;
  timeline(videoId:string,signal?:AbortSignal):Promise<SpeechTimeline>;
}
export async function retrieve(source:RetrievalSource,queryText:string,page=1,pageSize=20,config:Partial<RetrievalConfig>={},signal?:AbortSignal):Promise<RetrievalResponse> {
  if(!Number.isSafeInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw new RangeError('Paginación inválida.');
  const parts=[...new Set(queryText.split(/\s*(?:,|\+)\s*/).map(s=>s.trim()).filter(Boolean))];
  if(parts.length>2)throw new RangeError('Busca como máximo dos conceptos.');
  const queries=parts.length===2?parts.map(normalizeQuery):null;
  const query=normalizeQuery(queryText),c=retrievalConfig(config),episodes:RetrievalEpisode[]=[];
  signal?.throwIfAborted();
  let candidates=query.normalized?await source.candidates(queries?.[0]??query,signal):[];
  if(queries){const other=new Set((await source.candidates(queries[1],signal)).map(e=>e.videoId));candidates=candidates.filter(e=>other.has(e.videoId));}
  for(const meta of candidates) {
    signal?.throwIfAborted();
    const timeline=await source.timeline(meta.videoId,signal);
    const groups=queries?.map(q=>findOccurrences(timeline,q));
    const occurrences=groups?groups.flat():findOccurrences(timeline,query);
    let moments=createMoments(timeline,query,occurrences,c);
    if(groups){const sets=groups.map(g=>new Set(g.map(o=>o.occurrenceId)));moments=moments.filter(m=>sets.every(ids=>m.occurrences.some(o=>ids.has(o.occurrenceId))));}
    if(!moments.length)continue;
    // Rank EPISODES by their best moment; present moments chronologically inside them.
    episodes.push({...meta,relevanceScore:Math.max(...moments.map(m=>m.relevanceScore)),moments});
  }
  episodes.sort((a,b)=>b.relevanceScore-a.relevanceScore||(b.publishedAt??'').localeCompare(a.publishedAt??'')||a.videoId.localeCompare(b.videoId));
  return {version:RETRIEVAL_VERSION,snapshotId:source.snapshotId,query:query.original,normalizedQuery:query.normalized,
    canonicalQuery:query.canonicalQuery,expandedTerms:query.aliases.map(a=>a.text),totalEpisodes:episodes.length,
    totalMoments:episodes.reduce((n,e)=>n+e.moments.length,0),totalOccurrences:episodes.reduce((n,e)=>n+e.moments.reduce((n,m)=>n+m.occurrenceCount,0),0),
    page,pageSize,paginationUnit:'episode',episodes:episodes.slice((page-1)*pageSize,page*pageSize),diagnostics:momentDiagnostics(episodes)};
}
