import type { ClusteredSearchResult, SearchResponse } from './types';
import { CONCEPT_TERMS } from './concept-terms';

export type Evidence = { youtubeId:string; title:string; seconds:number; endSeconds?:number; text:string; precision:'cue'|'fragment'; chunkId:string };
export type EvidenceNode = { id:string; label:string; kind:'term'|'moment'; evidence?:Evidence[] };
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
    endSeconds:t.end_seconds,text:t.text_snippet,precision:result.timestamp_precision||'cue',chunkId:t.chunk_id}));
}
function uniqueEvidence(items:Evidence[]) {
  return [...new Map(items.map(e=>[e.youtubeId+':'+e.chunkId+':'+e.seconds,e])).values()];
}
function mentionDistance(text:string,from:string,to:string) {
  const words=normalizeTerm(text).split(' ');
  const a=normalizeTerm(from).split(' '),b=normalizeTerm(to).split(' ');
  const positions=(term:string[])=>words.flatMap((_,i)=>term.every((word,j)=>words[i+j]===word)?[i]:[]);
  const starts=positions(a),ends=positions(b);
  return Math.min(...starts.flatMap(i=>ends.map(j=>Math.max(0,j-i-a.length,i-j-b.length))));
}
export function buildEvidenceBranch(label:string,response:SearchResponse):NetworkBranch {
  const root=termId(label);
  const candidates=new Map<string,{label:string;concept:boolean;distance:number;evidence:Evidence[]}>();
  for(const result of response.results) {
    const all=resultEvidence(result);
    for(const evidence of all) {
      // FTS may stem words. Only literal co-mentions become term-to-term edges.
      if(!containsTerm(evidence.text,label)) continue;
      const concepts=CONCEPT_TERMS.filter(term=>containsTerm(evidence.text,term));
      for(const term of [...concepts,...transcriptTerms(evidence.text)]) {
        const id=termId(term);
        const concept=concepts.some(c=>termId(c)===id);
        if(id===root || (!concept&&(containsTerm(label,term) || containsTerm(term,label) || normalizeTerm(label).split(' ').every(word=>normalizeTerm(term).split(' ').includes(word))))) continue;
        const value=candidates.get(id)||{label:term,concept,distance:Infinity,evidence:[]};
        value.distance=Math.min(value.distance,mentionDistance(evidence.text,label,term));
        value.evidence.push(evidence); candidates.set(id,value);
      }
    }
  }
  const ranked=[...candidates.entries()].map(([id,c])=>({id,...c,evidence:uniqueEvidence(c.evidence)}))
    .filter(c=>c.concept||c.evidence.length>=2)
    .sort((a,b)=>Number(b.concept)-Number(a.concept)||b.evidence.length-a.evidence.length||a.distance-b.distance||a.label.localeCompare(b.label)).slice(0,8);
  const nodes:EvidenceNode[]=ranked.map(c=>({id:c.id,label:c.label,kind:'term'}));
  const edges:Relationship[]=ranked.map(c=>({id:[root,c.id].sort().join('::'),source:root,target:c.id,label:'Mencionados en el mismo fragmento',evidence:c.evidence}));
  // Episode titles and timestamps belong only to edge evidence. Never fill a
  // sparse branch with documents or terms lacking a literal supporting passage.
  return {nodes,edges};
}
export function buildCommonPaths(from:string,to:string,response:SearchResponse):ConnectionPath[] {
  const evidence=uniqueEvidence(response.results.flatMap(resultEvidence)).filter(e=>containsTerm(e.text,from)&&containsTerm(e.text,to));
  const distinct=[...new Map(evidence.map(e=>[e.youtubeId,e])).values()].slice(0,3);
  return distinct.map(e=>{
    const middle='moment:'+e.youtubeId+':'+e.seconds;
    return {id:middle,label:e.title,nodes:[{id:termId(from),label:from,kind:'term'},{id:termId(to),label:to,kind:'term'}],
      edges:[{id:[termId(from),termId(to)].sort().join('::'),source:termId(from),target:termId(to),label:'Mencionados en el mismo fragmento',evidence:[e]}]};
  });
}
