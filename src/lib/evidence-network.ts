import type { ClusteredSearchResult, SearchResponse } from './types';

export type Evidence = { youtubeId:string; title:string; seconds:number; text:string; precision:'cue'|'fragment'; chunkId:string };
export type EvidenceNode = { id:string; label:string; kind:'term'|'episode'|'moment'; evidence?:Evidence[] };
export type Relationship = { id:string; source:string; target:string; label:string; evidence:Evidence[] };
export type NetworkBranch = { nodes:EvidenceNode[]; edges:Relationship[] };
export type ConnectionPath = { id:string; label:string; nodes:EvidenceNode[]; edges:Relationship[] };

export function normalizeTerm(text:string) { return text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
export function termId(label:string) { return 'term:' + normalizeTerm(label); }
export function containsTerm(text:string,term:string) {
  return (' '+normalizeTerm(text)+' ').includes(' '+normalizeTerm(term)+' ');
}
const discourse = new Set('Pero Entonces Bueno Porque Aunque Ahora Además Miren Mira Señor Señora Doctor Doctora Candidato Presidenta Presidente Congresista Oye Hola Sí No Si El La Los Las Un Una Eso Esa Ese Esto Esta Este Don Doña'.split(' '));
const ignored = new Set(['muy buenas','buenas tardes','buenas noches','buenos dias','brutalidad politica','puntualidad politica','muchas gracias','por favor','por supuesto','sin embargo','asi es','youtube premium']);
// Candidate terms are literal spans in the transcript, not invented entities or
// semantic claims. Require repeat evidence before displaying a candidate branch.
export function transcriptTerms(text:string):string[] {
  const matches = text.match(/(?<![\p{L}\p{M}])(?:\p{Lu}[\p{Ll}\p{M}]+|\p{Lu}{2,})(?:\s+(?:(?:de|del|la|las|los|y|por|el|al)\s+){0,2}(?:\p{Lu}[\p{Ll}\p{M}]+|\p{Lu}{2,})){1,4}(?![\p{L}\p{M}])|(?<![\p{L}\p{M}])\p{Lu}{3,8}(?![\p{L}\p{M}])/gu) || [];
  const terms=matches.map(raw=>{
    const parts=raw.replace(/\s+/g,' ').trim().split(' ');
    while(parts.length>1 && discourse.has(parts[0])) parts.shift();
    return parts.join(' ');
  }).filter(label=>label.length>=3 && label.length<=64 && !ignored.has(normalizeTerm(label)) && !discourse.has(label));
  return [...new Set(terms)];
}
export function resultEvidence(result:ClusteredSearchResult):Evidence[] {
  return result.timestamps.map(t=>({youtubeId:result.youtube_id,title:result.video_title,seconds:t.start_seconds,
    text:t.text_snippet,precision:result.timestamp_precision||'cue',chunkId:t.chunk_id}));
}
function uniqueEvidence(items:Evidence[]) {
  return [...new Map(items.map(e=>[e.youtubeId+':'+e.chunkId+':'+e.seconds,e])).values()];
}
export function buildEvidenceBranch(label:string,response:SearchResponse):NetworkBranch {
  const root=termId(label);
  const candidates=new Map<string,{label:string;evidence:Evidence[]}>();
  const episodes=new Map<string,Evidence[]>();
  for(const result of response.results) {
    const all=resultEvidence(result);
    episodes.set(result.youtube_id,[...(episodes.get(result.youtube_id)||[]),...all]);
    for(const evidence of all) {
      // FTS may stem words. Only literal co-mentions become term-to-term edges.
      if(!containsTerm(evidence.text,label)) continue;
      for(const term of transcriptTerms(evidence.text)) {
        const id=termId(term);
        if(id===root || containsTerm(label,term) || containsTerm(term,label) || normalizeTerm(label).split(' ').every(word=>normalizeTerm(term).split(' ').includes(word))) continue;
        const value=candidates.get(id)||{label:term,evidence:[]};
        value.evidence.push(evidence); candidates.set(id,value);
      }
    }
  }
  const ranked=[...candidates.entries()].map(([id,c])=>({id,...c,evidence:uniqueEvidence(c.evidence)}))
    .filter(c=>c.evidence.length>=2).sort((a,b)=>b.evidence.length-a.evidence.length||a.label.localeCompare(b.label)).slice(0,8);
  const nodes:EvidenceNode[]=ranked.map(c=>({id:c.id,label:c.label,kind:'term'}));
  const edges:Relationship[]=ranked.map(c=>({id:[root,c.id].sort().join('::'),source:root,target:c.id,label:'Mencionados en el mismo fragmento',evidence:c.evidence}));
  // Episodes are evidence nodes, never represented as political relationships.
  // They also make every successful search explorable when no repeated named
  // phrase is present in the retrieved text.
  const episodeCount=ranked.length>=3?2:Math.max(3,6-ranked.length);
  for(const [id,items] of [...episodes.entries()].slice(0,episodeCount)) {
    const evidence=uniqueEvidence(items);
    if(!evidence.length) continue;
    const nodeId='episode:'+id;
    nodes.push({id:nodeId,label:evidence[0].title,kind:'episode',evidence});
    edges.push({id:root+'::'+nodeId,source:root,target:nodeId,label:'Mención en este episodio',evidence});
  }
  return {nodes,edges};
}
export function buildCommonPaths(from:string,to:string,response:SearchResponse):ConnectionPath[] {
  const evidence=uniqueEvidence(response.results.flatMap(resultEvidence)).filter(e=>containsTerm(e.text,from)&&containsTerm(e.text,to));
  const distinct=[...new Map(evidence.map(e=>[e.youtubeId,e])).values()].slice(0,3);
  return distinct.map(e=>{
    const middle='moment:'+e.youtubeId+':'+e.seconds;
    return {id:middle,label:e.title,nodes:[{id:termId(from),label:from,kind:'term'},{id:middle,label:'Fragmento compartido',kind:'moment',evidence:[e]},{id:termId(to),label:to,kind:'term'}],
      edges:[{id:termId(from)+'::'+middle,source:termId(from),target:middle,label:'Mención en el mismo fragmento',evidence:[e]},
        {id:middle+'::'+termId(to),source:middle,target:termId(to),label:'Mención en el mismo fragmento',evidence:[e]}]};
  });
}
