// Node-only snapshot adapter. Never imported by the static browser bundle.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {RETRIEVAL_VERSION,type EpisodeMetadata,type SearchQuery,type SpeechTimeline} from './model';
import type {RetrievalSource} from './search';
export interface SnapshotEpisode extends EpisodeMetadata {
  sourceFile:string; sourceSha256:string; timelineFile:string; timelineSha256:string;
  rawCueCount:number; cleanTokenCount:number;
}
export interface RetrievalSnapshot {
  version:string; snapshotId:string; createdAt:string; baselineCapturedAt:string;
  episodes:SnapshotEpisode[]; postings:Record<string,string[]>;
}
export const sha256=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
export async function openSnapshot(manifestPath=process.env.RETRIEVAL_SNAPSHOT_PATH||'reports/retrieval/snapshot.json'):Promise<RetrievalSource> {
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8')) as RetrievalSnapshot;
  if(manifest.version!==RETRIEVAL_VERSION) throw new Error('Rebuild retrieval snapshot for this processing version');
  const root=path.resolve(path.dirname(manifestPath));
  const byId=new Map(manifest.episodes.map(e=>[e.videoId,e]));
  const cache=new Map<string,SpeechTimeline>();
  return {snapshotId:manifest.snapshotId,
    async candidates(query:SearchQuery) {
      const ids=new Set<string>();
      for(const alias of query.aliases) {
        const lists=alias.words.map(w=>Object.hasOwn(manifest.postings,w)?manifest.postings[w]:[]).sort((a,b)=>a.length-b.length);
        const rest=lists.slice(1).map(list=>new Set(list));
        for(const id of lists[0]??[])if(rest.every(set=>set.has(id)))ids.add(id);
      }
      return [...ids].sort().map(id=>{const e=byId.get(id);if(!e)throw new Error('Invalid candidate index');return {videoId:id,title:e.title,publishedAt:e.publishedAt};});
    },
    async timeline(videoId,signal) {
      signal?.throwIfAborted();if(cache.has(videoId))return cache.get(videoId)!;
      const meta=byId.get(videoId);if(!meta)throw new Error('Video outside retrieval snapshot');
      const bytes=await fs.readFile(path.resolve(root,meta.timelineFile),{signal});
      if(sha256(bytes)!==meta.timelineSha256)throw new Error('Retrieval snapshot checksum mismatch');
      const timeline=JSON.parse(gunzipSync(bytes).toString('utf8')) as SpeechTimeline;
      if(timeline.videoId!==videoId||timeline.version!==manifest.version)throw new Error('Invalid timeline provenance');
      cache.set(videoId,timeline);if(cache.size>4)cache.delete(cache.keys().next().value!);
      return timeline;
    }};
}
