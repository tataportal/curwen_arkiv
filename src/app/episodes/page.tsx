'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { formatDate, formatTimestamp } from '@/lib/utils';
import Pagination from '@/components/Pagination';
import { archiveRequest, episodeHref, type EpisodeList } from '@/components/archive-client';
import { ArchiveError, LoadingLine } from '@/components/ArchivePrimitives';
export default function EpisodesPage() {
  const [data, setData] = useState<EpisodeList | null>(null);
  const [filter, setFilter] = useState('');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false);
    const timer = setTimeout(async () => {
      try {
        const result = await archiveRequest<EpisodeList>('/api/episodes?page=' + page + '&q=' + encodeURIComponent(filter) + '&order=' + order, controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, filter, order, retry]);
  return <div className="document-page archive-page">
    <h1>Archivo</h1>
    <div className="archive-filters">
      <label className="sr-only" htmlFor="episode-filter">Buscar por título</label>
      <input id="episode-filter" value={filter} placeholder="Buscar por título" onChange={e => { setFilter(e.target.value); setPage(1); }} />
      <label className="sr-only" htmlFor="episode-order">Orden de publicación</label>
      <select id="episode-order" value={order} onChange={e => { setOrder(e.target.value as 'desc' | 'asc'); setPage(1); }}><option value="desc">Más recientes</option><option value="asc">Más antiguos</option></select>
    </div>
    {loading ? <LoadingLine label="Consultando episodios" /> : error ? <ArchiveError retry={() => setRetry(v => v + 1)} /> : data && <>
      <p className="archive-count" role="status">{data.total.toLocaleString('es-PE')} capítulos</p>
      {data.episodes.length ? <div>{data.episodes.map((ep, i) => <Link href={episodeHref(ep.youtube_id)} className="archive-row reveal" key={ep.youtube_id} style={{ '--index': Math.min(i, 6) } as CSSProperties}>
        <time dateTime={ep.published_at || undefined}>{formatDate(ep.published_at) || 'Sin fecha'}</time><h2>{ep.title}</h2>
        <span className="archive-duration">{ep.duration_seconds ? formatTimestamp(ep.duration_seconds) : ''}<span aria-hidden="true">↗</span></span>
      </Link>)}</div> : <div className="quiet-state"><p>{filter ? 'No hay capítulos que coincidan con “' + filter + '”.' : 'Todavía no hay capítulos disponibles.'}</p></div>}
      <Pagination page={page} pageSize={data.page_size} total={data.total} onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
    </>}
  </div>;
}
