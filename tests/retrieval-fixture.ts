import {buildTimeline,parseRawVTT} from '../src/lib/retrieval/timeline';
import {normalizeQuery} from '../src/lib/retrieval/query';
import {findOccurrences} from '../src/lib/retrieval/occurrences';
import {createMoments} from '../src/lib/retrieval/moments';
import type {RetrievalResponse,RetrievalEpisode} from '../src/lib/retrieval/model';
export function fixture(text='Archive Subject meets Central Library.',query='Archive Subject',id='testvideo01'):RetrievalEpisode {
 const timeline=buildTimeline(id,parseRawVTT(id,'WEBVTT\n\n00:00:12.340 --> 00:00:15.000\n'+text+'\n'));
 return {videoId:id,title:'Test episode',publishedAt:null,relevanceScore:1,moments:createMoments(timeline,normalizeQuery(query),findOccurrences(timeline,normalizeQuery(query)))};
}
export function response(episodes:RetrievalEpisode[]=[]):RetrievalResponse {return {version:'cue-retrieval-1',snapshotId:'test',query:'archive',normalizedQuery:'archive',canonicalQuery:null,expandedTerms:[],page:1,pageSize:20,paginationUnit:'episode',episodes,totalEpisodes:episodes.length,totalMoments:episodes.reduce((n,e)=>n+e.moments.length,0),totalOccurrences:episodes.reduce((n,e)=>n+e.moments.reduce((n,m)=>n+m.occurrenceCount,0),0),diagnostics:{longMomentThresholdSeconds:180,totalLongMoments:0,longMoments:[]}};}
