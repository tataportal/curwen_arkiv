import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseRawVTT} from '../src/lib/retrieval/timeline';
import data from '../src/data/commercial-demo.json';
const root=process.argv[2];if(!root)throw Error('Pass canonical data/raw directory');
const names=await readdir(root),sources=new Map();
for(const m of data.moments){
 const id=m.episode.videoId;
 if(!sources.has(id)){
  const filename=names.find(n=>n.includes('_'+id+'_')&&n.endsWith('.vtt'));assert(filename,id+' source missing');
  const text=await readFile(root+'/'+filename,'utf8');
  sources.set(id,{sha:createHash('sha256').update(text).digest('hex'),cues:parseRawVTT(id,text)});
 }
 const source=sources.get(id);assert.equal(source.sha,m.sourceHash,id+' source changed');
 const cue=source.cues.find((c:any)=>c.cueId===m.occurrence.cueId);assert(cue,m.id+' cue missing');
 assert.equal(cue.startSeconds,m.occurrence.cue_start_seconds,m.id+' timestamp altered');
 assert(m.context.some(c=>c.cueIds.includes(cue.cueId)),m.id+' no source context');
}
console.log(JSON.stringify({verifiedMoments:data.moments.length,sourceEpisodes:sources.size,rawHashesAndCueTimestamps:'pass',inferenceCalls:0}));
