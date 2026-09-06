'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import SearchResults from './SearchResults';
import Pagination from './Pagination';
import {searchExpression} from '@/lib/evidence-presentation';
import { ArchiveError } from './ArchivePrimitives';
import { archiveRequest, type SearchResponse } from './archive-client';
const NetworkExplorer = dynamic(() => import('./NetworkExplorer'));

export default function SearchExperience() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const search = useCallback(async (value: string, nextPage = 1, history = true) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const q = value.trim();
    setQuery(q); setActiveQuery(q); setPage(nextPage); setError(false); setData(null);
    if (nextPage === 1) setShowResults(false);
    if (history) {
      const url = new URL(window.location.href);
      url.search = '';
      if (q) { url.searchParams.set('q', q); if (nextPage > 1) url.searchParams.set('page', String(nextPage)); }
      window.history.pushState(null, '', url);
    }
    if (!q) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await archiveRequest<SearchResponse>('/api/search?q=' + encodeURIComponent(searchExpression(q)) + '&page=' + nextPage, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const nextPage = Number(params.get('page') || 1);
      void search(params.get('q') || '', Number.isSafeInteger(nextPage) && nextPage > 0 ? nextPage : 1, false);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => { pending.current?.abort(); window.removeEventListener('popstate', restore); };
  }, [search]);
  return <div className={'search-experience ' + (activeQuery ? 'is-active ' : '') + (showResults ? 'show-results' : '')}>
    <h1 className="sr-only">Buscar en Curwen Archive</h1>
    {activeQuery && <div className="home-network"><NetworkExplorer key={activeQuery} query={activeQuery} compact={showResults} response={data} loading={loading} /></div>}
    <div className="search-anchor">
      <form role="search" className={'search-field ' + (loading ? 'is-loading' : '')} onSubmit={e => {
        e.preventDefault(); void search(query); input.current?.focus(); window.scrollTo({ top: 0, behavior: 'instant' });
      }}>
        <label htmlFor="archive-search" className="sr-only">Buscar un tema</label>
        <input ref={input} id="archive-search" type="text" autoComplete="off" maxLength={500} value={query}
          onChange={e => setQuery(e.target.value)} placeholder="Buscar un tema" enterKeyHint="search"
          onKeyDown={e => { if (e.key === 'Escape') { void search(''); input.current?.focus(); } }} />
        <button type="submit" className="search-submit" aria-label="Buscar" disabled={!query.trim()}>↵</button>
      </form>
    </div>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {loading ? 'Buscando ' + activeQuery : error ? 'No se pudo consultar el archivo.' : data ? data.total_clusters + ' momentos encontrados para ' + activeQuery : ''}
    </div>
    {activeQuery && <section className="search-content" aria-label="Resultados de búsqueda" aria-busy={loading}>
      {error ? <ArchiveError retry={() => void search(activeQuery, page, false)} /> : !loading && data && <>
        {data.results.length ? <>
          <div className="results-summary"><button className="text-action" onClick={() => setShowResults(v => !v)} aria-expanded={showResults}>
            {showResults ? 'Ocultar' : 'Ver'} {data.total_clusters.toLocaleString('es-PE')} {data.total_clusters === 1 ? 'momento' : 'momentos'} {showResults ? '↑' : '↓'}
          </button>{showResults && <span>{data.total_episodes ? data.total_episodes + ' capítulos' : new Set(data.results.map(r => r.youtube_id)).size + ' capítulos en esta página'}</span>}</div>
          {showResults && data.timestamp_precision === 'fragment' && <p className="precision-note">Las marcas abren el inicio del fragmento transcrito.</p>}
          {showResults && <><SearchResults results={data.results} query={activeQuery} />
            <Pagination page={page} pageSize={data.page_size} total={data.total_clusters} onChange={p => {
              void search(activeQuery, p); input.current?.focus(); window.scrollTo({ top: 0, behavior: 'instant' });
            }} /></>}
        </> : <div className="quiet-state"><p>No encontré menciones de “{activeQuery}”</p><p className="secondary">Prueba con otra persona, caso o término.</p></div>}
      </>}
      <nav className="context-nav" aria-label="Archivo"><button onClick={() => { void search(''); input.current?.focus(); }}>Nueva búsqueda</button><Link href="/episodes">Archivo ↗</Link></nav>
    </section>}
  </div>;
}
