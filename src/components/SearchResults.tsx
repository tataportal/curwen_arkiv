import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { ClusteredSearchResult } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Highlight, TimestampLink } from './ArchivePrimitives';
import { episodeHref } from './archive-client';
export default function SearchResults({ results, query }: { results: ClusteredSearchResult[]; query: string }) {
  const groups = new Map<string, ClusteredSearchResult[]>();
  // Only the presentation is grouped; API conversation clusters remain intact.
  results.forEach(result => groups.set(result.youtube_id, [...(groups.get(result.youtube_id) || []), result]));
  return <div className="episode-results">{[...groups.entries()].map(([id, moments], index) => <article className="episode-result reveal" key={id} style={{ '--index': Math.min(index, 6) } as CSSProperties}>
    <header className="result-heading"><h2><Link href={episodeHref(id)}>{moments[0].video_title}</Link></h2>
      {moments[0].published_at && <time dateTime={moments[0].published_at}>{formatDate(moments[0].published_at)}</time>}
    </header>
    {moments.map(moment => <div className="occurrence" key={moment.cluster_id}>
      <TimestampLink youtubeId={id} seconds={moment.primary_start_seconds} />
      <div className="occurrence-text"><p><Highlight text={moment.combined_text} query={query} /></p>
        {moment.timestamps.length > 1 && <details className="cluster-details"><summary>Ver {moment.timestamps.length} menciones de este momento</summary>
          {moment.timestamps.map(ts => <div className="cue-evidence" key={ts.chunk_id + '-' + (ts.cue_index ?? ts.start_seconds)}>
            <TimestampLink youtubeId={id} seconds={ts.start_seconds} /><p><Highlight text={ts.text_snippet} query={query} /></p>
          </div>)}
        </details>}
      </div>
    </div>)}
  </article>)}</div>;
}
