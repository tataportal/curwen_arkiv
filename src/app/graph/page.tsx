'use client';
import { useEffect, useState } from 'react';
import NetworkExplorer from '@/components/NetworkExplorer';
export default function GraphPage() {
  const [query, setQuery] = useState('');
  const [value, setValue] = useState('');
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('q') || ''; setQuery(q); setValue(q); }, []);
  return <div className="graph-page">
    <h1 className="sr-only">Explorar la red</h1>
    <form className="search-field graph-search" role="search" onSubmit={e => { e.preventDefault(); setQuery(value.trim()); }}>
      <label htmlFor="graph-query" className="sr-only">Buscar un tema en la red</label>
      <input id="graph-query" value={value} onChange={e => setValue(e.target.value)} placeholder="Buscar un tema" maxLength={500} />
      <button className="search-submit" aria-label="Buscar en la red" disabled={!value.trim()}>↵</button>
    </form>
    {query && <NetworkExplorer key={query} query={query} />}
  </div>;
}
