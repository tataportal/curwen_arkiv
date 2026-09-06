import type { TranscriptChunk, Video } from '@/lib/types';
export type EpisodeData = Video & { chunks: TranscriptChunk[] };
export type EpisodeList = { episodes: Video[]; total: number; page: number; page_size: number };
// Pages reuses the actual data layer with public RLS-scoped browser credentials.
// The regular Next deployment continues calling its existing API routes.
export async function archiveRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  if (process.env.NEXT_PUBLIC_STATIC_ARCHIVE === 'true') {
    const api = await import('@/lib/search');
    signal.throwIfAborted();
    const url = new URL(path, 'https://archive.local');
    const p = url.searchParams;
    let data: unknown;
    if (url.pathname === '/api/search') data = await api.searchTranscript(p.get('q') || '', Number(p.get('page') || 1), 20, signal);
    else if (url.pathname === '/api/episodes') data = await api.getEpisodes(Number(p.get('page') || 1), 24, p.get('q') || '', p.get('order') === 'asc' ? 'asc' : 'desc');
    else if (url.pathname.startsWith('/api/episode/')) data = { episode: await api.getEpisodeByYoutubeId(url.pathname.split('/').pop() || '') };
    else throw new Error('Consulta no disponible.');
    signal.throwIfAborted();
    return data as T;
  }
  const response = await fetch(path, { signal });
  if (response.status === 404 && path.startsWith('/api/episode/')) return { episode: null } as T;
  if (!response.ok) throw new Error('No se pudo consultar el archivo.');
  return response.json() as Promise<T>;
}
export function episodeHref(youtubeId: string) {
  return process.env.NEXT_PUBLIC_STATIC_ARCHIVE === 'true'
    ? '/episode/?id=' + encodeURIComponent(youtubeId) : '/episode/' + youtubeId;
}
export type { RetrievalResponse as SearchResponse } from '@/lib/retrieval/model';
