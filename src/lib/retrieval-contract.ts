import {RETRIEVAL_VERSION,type RetrievalResponse} from './retrieval/model';
export function validateRetrievalResponse(data:unknown):asserts data is RetrievalResponse {
 const r=data as RetrievalResponse;
 if(r?.version!==RETRIEVAL_VERSION||r.paginationUnit!=='episode'||!Array.isArray(r.episodes))throw Error('Contrato de retrieval incompatible');
 for(const e of r.episodes)for(const m of e.moments){
  if(m.processed){const p=m.processed;
   if(p.version!=='semantic-v2.0'||typeof p.title!=='string'||!p.title.trim()||typeof p.excerpt!=='string'||typeof p.primaryFamily!=='string'||!Array.isArray(p.topics)||p.topics.some(t=>typeof t!=='string')||!['high','medium','low'].includes(p.eligibility)||(p.summary!==null&&typeof p.summary!=='string')||(p.eligibility==='low'&&p.summary!==null))throw Error('Presentación semántica incompatible');
  }
  if(!m.occurrences?.length||!m.evidenceTokens?.length)throw Error('Falta evidencia de cue');
  for(const o of m.occurrences)if(!Number.isFinite(o.cue_start_seconds)||o.cue_start_seconds<0||!o.cueId||o.videoId!==e.videoId)throw Error('Falta timestamp de ocurrencia');
 }
}
