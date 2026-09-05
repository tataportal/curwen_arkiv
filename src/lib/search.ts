import { getSupabaseClient } from './supabase';
import type { ClusteredSearchResult, SearchResponse, Video, TranscriptChunk } from './types';
import { formatTimestamp, buildYouTubeTimestampUrl } from './utils';

export class ArchiveError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export function pagination(page = 1, pageSize = 20) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ArchiveError('Paginación inválida.', 400);
  }
  return { page, pageSize };
}
function client() {
  const db = getSupabaseClient();
  if (!db) throw new ArchiveError('El archivo no está disponible temporalmente.');
  return db;
}
function databaseError(error: { message: string }) {
  console.error('Archive database error:', error.message);
  return new ArchiveError('No se pudo consultar el archivo. Intenta nuevamente.');
}
export async function searchTranscript(query: string, page = 1, pageSize = 20): Promise<SearchResponse> {
  pagination(page, pageSize);
  const trimmed = query.trim();
  if (trimmed.length > 500) throw new ArchiveError('La búsqueda es demasiado larga.', 400);
  if (!trimmed) return { query: '', page, page_size: pageSize, total_clusters: 0, total_chunk_hits: 0, total_occurrences: 0, results: [] };
  const { data, error } = await client().rpc('search_archive', { query_text: trimmed, page_number: page, page_size: pageSize });
  if (error || !data) throw databaseError(error || { message: 'Empty RPC response' });
  const results: ClusteredSearchResult[] = data.results.map((r: any) => ({
    cluster_id: `${r.video_id}-${r.grp}`, video_id: r.video_id, youtube_id: r.youtube_id, video_title: r.video_title,
    published_at: r.published_at, thumbnail_url: r.thumbnail_url, duration_seconds: r.duration_seconds,
    primary_start_seconds: r.start_seconds, primary_end_seconds: r.end_seconds, primary_label: formatTimestamp(r.start_seconds),
    youtube_jump_url: buildYouTubeTimestampUrl(r.youtube_id, r.start_seconds), combined_text: r.combined_text,
    // Display transcript as text, never inject ts_headline/source HTML.
    headline: '', best_rank: r.rank,
    timestamps: r.timestamps.map((t: any) => ({ ...t, label: formatTimestamp(t.start_seconds) })),
  }));
  return { ...data, results };
}
export async function getEpisodes(page = 1, pageSize = 24, filter = '', order: 'asc' | 'desc' = 'desc') {
  pagination(page, pageSize);
  const db = client();
  let request = db.from('videos').select('id,youtube_id,title,description,published_at,duration_seconds,thumbnail_url,youtube_url,transcript_chunks(count)', { count: 'exact' });
  if (filter.trim()) {
    // Single-column ilike keeps user text out of PostgREST's .or expression grammar.
    request = request.ilike('title', `%${filter.trim().replace(/[\\%_]/g, '\\$&')}%`);
  }
  const { data, error, count } = await request.order('published_at', { ascending: order === 'asc', nullsFirst: false })
    .order('youtube_id', { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error || !data || count === null) throw databaseError(error || { message: 'Missing episode count' });
  return { episodes: data.map((v: any) => ({ ...v, chunk_count: v.transcript_chunks?.[0]?.count || 0 })), total: count, page, page_size: pageSize };
}
export async function getEpisodeByYoutubeId(youtubeId: string): Promise<(Video & { chunks: TranscriptChunk[] }) | null> {
  if (!/^[\w-]{11}$/.test(youtubeId)) throw new ArchiveError('ID de video inválido.', 400);
  const db = client();
  const { data: video, error } = await db.from('videos').select('*').eq('youtube_id', youtubeId).maybeSingle();
  if (error) throw databaseError(error);
  if (!video) return null;
  const chunks: TranscriptChunk[] = [];
  // Fetch every page, including episodes exceeding PostgREST's default row cap.
  let total = Infinity;
  while (chunks.length < total) {
    const { data, error, count } = await db.from('transcript_chunks')
      .select('id,video_id,start_seconds,end_seconds,text,cues', { count: 'exact' }).eq('video_id', video.id)
      .order('start_seconds').order('id').range(chunks.length, chunks.length + 499);
    if (error || !data || count === null) throw databaseError(error || { message: 'Missing transcript response' });
    total = count;
    if (!data.length && chunks.length < total) throw databaseError({ message: 'Transcript pagination stopped early' });
    chunks.push(...data);
  }
  return { ...video, chunks };
}
