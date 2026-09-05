import { ArrowUpRight } from 'lucide-react';
import { buildYouTubeTimestampUrl, formatTimestamp } from '@/lib/utils';
export function TimestampLink({ youtubeId, seconds }: { youtubeId: string; seconds: number }) {
  return <a className="timestamp" href={buildYouTubeTimestampUrl(youtubeId, seconds)} target="_blank" rel="noopener noreferrer"
    aria-label={formatTimestamp(seconds) + ', abrir en YouTube en una nueva pestaña'}>
    <span>{formatTimestamp(seconds)}</span><ArrowUpRight size={13} strokeWidth={1.5} aria-hidden="true" />
  </a>;
}
export function Highlight({ text, query }: { text: string; query: string }) {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a,b) => b.length - a.length);
  if (!terms.length) return <>{text}</>;
  const escaped = terms.map(term => term.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp('(' + escaped.join('|') + ')', 'gi'));
  return <>{parts.map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part)}</>;
}
export function LoadingLine({ label }: { label: string }) {
  return <div className="loading-line" role="status"><span className="sr-only">{label}</span></div>;
}
export function ArchiveError({ retry }: { retry: () => void }) {
  return <div className="quiet-state" role="alert"><p>No se pudo consultar el archivo.</p>
    <button className="text-action" onClick={retry}>Reintentar ↗</button></div>;
}
