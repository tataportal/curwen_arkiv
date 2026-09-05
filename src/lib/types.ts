export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  youtube_url: string | null;
  created_at?: string;
}

export interface TranscriptChunk {
  cues?: { cue_index: number; start_seconds: number; end_seconds: number; text: string }[];
  id: string;
  video_id: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
  embedding?: number[] | null;
  created_at?: string;
  headline?: string;
  rank?: number;
}

export interface ChunkTimestampMatch {
  cue_index?: number;
  chunk_id: string;
  start_seconds: number;
  end_seconds: number;
  label: string; // e.g. "12:31" or "01:14:05"
  text_snippet: string;
}

export interface ClusteredSearchResult {
  cluster_id: string;
  video_id: string;
  youtube_id: string;
  video_title: string;
  published_at: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  primary_start_seconds: number;
  primary_end_seconds: number;
  primary_label: string; // "12:31"
  youtube_jump_url: string; // https://youtube.com/watch?v=VIDEO_ID&t=SECONDS
  combined_text: string;
  headline: string;
  timestamps: ChunkTimestampMatch[];
  best_rank: number;
}

export interface SearchResponse {
  page: number;
  page_size: number;
  total_occurrences: number;
  query: string;
  total_clusters: number;
  total_chunk_hits: number;
  results: ClusteredSearchResult[];
}

export interface GraphNodeData {
  id: string;
  label: string;
  type: 'person' | 'political_party' | 'institution' | 'case' | 'topic' | 'episode';
  mentionCount?: number;
  details?: string;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  relation_type: string;
  confidence?: number;
}
