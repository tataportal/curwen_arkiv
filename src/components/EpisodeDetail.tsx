'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { archiveRequest, type EpisodeData } from './archive-client';
import { ArchiveError, Highlight, LoadingLine } from './ArchivePrimitives';
import { buildYouTubeTimestampUrl, formatDate, formatTimestamp } from '@/lib/utils';
export default function EpisodeDetail({ youtubeId }: { youtubeId: string }) {
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(160);
  const [initialTime, setInitialTime] = useState(0);
  const initialRow = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = Number(new URLSearchParams(window.location.search).get('t') || 0); setInitialTime(Number.isFinite(t) ? Math.max(0, t) : 0); }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false); setEpisode(null);
    async function load() {
      try {
        const data = await archiveRequest<{ episode: EpisodeData | null }>('/api/episode/' + encodeURIComponent(youtubeId), controller.signal);
        if (!controller.signal.aborted) setEpisode(data.episode);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [youtubeId, retry]);
  const rows = useMemo(() => (episode?.chunks || []).flatMap(chunk => chunk.cues?.length
    ? chunk.cues.map(cue => ({ ...chunk, ...cue, id: chunk.id + '-' + cue.cue_index })) : [chunk]), [episode]);
  const filtered = useMemo(() => rows.filter(row => row.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [rows, query]);
  const targetIndex = initialTime > 0 ? rows.findIndex(row => row.end_seconds >= initialTime) : -1;
  const visibleLimit = Math.max(limit, targetIndex + 1);
  useEffect(() => { if (episode && initialTime > 0) initialRow.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); }, [episode, initialTime]);
  return <div className="document-page episode-page">
    <Link href="/episodes" className="back-link">← Archivo</Link>
    {loading ? <LoadingLine label="Consultando transcripción" /> : error ? <ArchiveError retry={() => setRetry(v => v + 1)} /> : !episode ? <div className="quiet-state"><h1>Capítulo no encontrado</h1><p className="secondary">Este episodio no está disponible en el archivo.</p></div> : <>
      <header className="episode-heading reveal"><h1>{episode.title}</h1><div className="episode-meta">
        {episode.published_at && <time dateTime={episode.published_at}>{formatDate(episode.published_at)}</time>}
        {episode.duration_seconds ? <span>{formatTimestamp(episode.duration_seconds)}</span> : null}
        <a href={buildYouTubeTimestampUrl(youtubeId, initialTime)} target="_blank" rel="noopener noreferrer">Abrir en YouTube ↗</a>
      </div></header>
      <div className="transcript-filter"><label htmlFor="transcript-query">Buscar en transcripción</label>
        <div className="search-field"><input id="transcript-query" value={query} onChange={e => { setQuery(e.target.value); setLimit(160); }} placeholder="Una palabra o una frase" maxLength={500} /></div>
        <p role="status" className="secondary">{query ? filtered.length + ' fragmentos coincidentes' : ''}</p>
      </div>
      <section aria-label="Transcripción" className="transcript">
        {!filtered.length ? <div className="quiet-state"><p>{query ? 'No hay menciones de “' + query + '”.' : 'La transcripción aún no está disponible.'}</p></div> : filtered.slice(0, visibleLimit).map(row => <div key={row.id} className={'transcript-row ' + (row.id === rows[targetIndex]?.id ? 'target-row' : '')} ref={row.id === rows[targetIndex]?.id ? initialRow : undefined}>
          <p><Highlight text={row.text} query={query} /></p>
        </div>)}
        {filtered.length > visibleLimit && <button className="text-action more-transcript" onClick={() => setLimit(visibleLimit + 160)}>Continuar transcripción ↓</button>}
      </section>
    </>}
  </div>;
}
