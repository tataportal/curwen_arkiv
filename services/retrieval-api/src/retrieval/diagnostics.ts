import type {DiscussionMoment,RetrievalEpisode,RetrievalResponse} from './model';
export const LONG_MOMENT_SECONDS=180;
export function isLongMoment(moment:Pick<DiscussionMoment,'startSeconds'|'endSeconds'>) {
  return moment.endSeconds-moment.startSeconds>LONG_MOMENT_SECONDS;
}
/** Report continuity risks without changing boundaries, rank or occurrence counts. */
export function momentDiagnostics(episodes:RetrievalEpisode[]):RetrievalResponse['diagnostics'] {
  const longMoments=episodes.flatMap(e=>e.moments.filter(isLongMoment).map(m=>({
    momentId:m.momentId,videoId:e.videoId,episodeTitle:e.title,startSeconds:m.startSeconds,endSeconds:m.endSeconds,
    durationSeconds:Math.round((m.endSeconds-m.startSeconds)*1000)/1000,occurrenceCount:m.occurrenceCount,youtubeUrl:m.youtubeUrl,
  })));
  return {longMomentThresholdSeconds:LONG_MOMENT_SECONDS,totalLongMoments:longMoments.length,longMoments};
}
