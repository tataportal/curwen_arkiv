/** Bounded deterministic enrichment of the existing 24 curated moments. No inference/ingestion. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import data from '../src/data/commercial-demo.json';
import {parseRawVTT,buildTimeline} from '../src/lib/retrieval/timeline';
import {findOccurrences} from '../src/lib/retrieval/occurrences';
import {normalizeQuery,lexical} from '../src/lib/retrieval/query';
import type {SpeechTimeline} from '../src/lib/retrieval/model';
const root=process.argv[2];if(!root)throw Error('Pass canonical data/raw directory');
const names=await readdir(root),sources=new Map<string,{sha:string;timeline:SpeechTimeline}>();
const evidence:Record<string,Record<string,unknown>>={};
for(const m of data.moments){
 const id=m.episode.videoId;
 if(!sources.has(id)){
  const filename=names.find(n=>n.includes('_'+id+'_')&&n.endsWith('.vtt'));assert(filename,id+' source missing');
  const raw=await readFile(root+'/'+filename,'utf8');
  sources.set(id,{sha:createHash('sha256').update(raw).digest('hex'),timeline:buildTimeline(id,parseRawVTT(id,raw))});
 }
 const source=sources.get(id)!;assert.equal(source.sha,m.sourceHash,id+' source changed');
 const timeline=source.timeline,from=Math.min(...m.context.map(c=>c.tokenStart)),to=Math.max(...m.context.map(c=>c.tokenEnd));
 evidence[m.id]={};
 for(const topic of m.topics){
  const normalized=lexical(topic.quote);
  const quotes=findOccurrences(timeline,{original:topic.quote,normalized,canonicalQuery:topic.quote,aliases:[{text:topic.quote,normalized,words:normalized.split(' ')}]})
   .filter(o=>o.tokenStart>=from&&o.tokenEnd<=to).sort((a,b)=>Math.abs(a.cue_start_seconds-m.occurrence.cue_start_seconds)-Math.abs(b.cue_start_seconds-m.occurrence.cue_start_seconds));
  assert(quotes.length,m.id+' quote not found: '+topic.label);
  const quote=quotes[0];
  const mention=findOccurrences(timeline,normalizeQuery(topic.label)).find(o=>o.tokenStart>=quote.tokenStart&&o.tokenEnd<=quote.tokenEnd);
  const occurrence=mention??quote;
  const rawCue=timeline.rawCues.find(c=>c.cueId===occurrence.cueId)!;
  assert.equal(rawCue.startSeconds,occurrence.cue_start_seconds);
  const at=timeline.sentences.findIndex(c=>c.tokenStart<=occurrence.tokenStart&&c.tokenEnd>occurrence.tokenStart);assert(at>=0);
  // Retain prior speech, never just a relabelled clock. A wider source window is request-only.
  const excerpt=timeline.sentences.slice(Math.max(0,at-1),at+1);
  const context=timeline.sentences.filter(c=>c.endSeconds>=occurrence.cue_start_seconds-20&&c.startSeconds<=occurrence.endSeconds+25);
  evidence[m.id][topic.label]={label:topic.label,quote:topic.quote,anchorType:mention?'concept-mention':'supporting-quote',occurrence,excerpt:excerpt.map(c=>c.text).join(' '),excerptCueIds:[...new Set(excerpt.flatMap(c=>c.cueIds))],context,sourceHash:source.sha};
 }
}
const output={version:'commercial-topic-evidence-v1',moments:evidence};
const serialized=JSON.stringify(output,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(await readFile('src/data/commercial-topic-evidence.json','utf8'),serialized,'Stored topic evidence differs from raw source');
else await writeFile('src/data/commercial-topic-evidence.json',serialized);
console.log(JSON.stringify({moments:Object.keys(evidence).length,topics:Object.values(evidence).reduce((n,t)=>n+Object.keys(t).length,0),episodes:sources.size,inferenceCalls:0,check:process.argv.includes('--check')}));
