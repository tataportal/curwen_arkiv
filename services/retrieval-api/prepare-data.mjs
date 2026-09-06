import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const input=process.argv[2];if(!input)throw Error('Provide the approved snapshot manifest');
const m=JSON.parse(readFileSync(input));if(m.episodes.length!==103)throw Error('Expected frozen 103-episode baseline');
mkdirSync('data',{recursive:true});const episodes=[];
for(const e of m.episodes){
 const bytes=readFileSync(resolve(input,'..',e.timelineFile));
 if(createHash('sha256').update(bytes).digest('hex')!==e.timelineSha256)throw Error('Checksum mismatch');
 const t=JSON.parse(gunzipSync(bytes));
 // Lossless token/sentence projection of the approved snapshot, no re-ingestion.
 const c={version:t.version,videoId:t.videoId,tokens:t.tokens.map(x=>[x.text,x.key,x.cueId,x.startSeconds,x.endSeconds,x.wordStartSeconds,x.explicitTime?1:0]),sentences:t.sentences};
 const packed=gzipSync(JSON.stringify(c));const file=e.videoId+'.json.gz';writeFileSync(join('data',file),packed);
 episodes.push({videoId:e.videoId,title:e.title,publishedAt:e.publishedAt,file,sha256:createHash('sha256').update(packed).digest('hex'),sourceSha256:e.sourceSha256});
}
writeFileSync('data/manifest.json',JSON.stringify({version:m.version,snapshotId:m.snapshotId,episodes,postings:m.postings}));
console.log('Prepared',episodes.length,'existing episodes');
