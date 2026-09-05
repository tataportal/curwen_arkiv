-- Curwen Archive: Initial Schema
-- Supports full-text Spanish search, video catalog, deterministic chunks, and evidence-backed relationships.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pgvector extension (unconstrained dimension, nullable)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not installed in this PostgreSQL instance; continuing without vector type.';
END $$;

-- 1. Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMPTZ,
  duration_seconds INT,
  thumbnail_url TEXT,
  youtube_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Transcript Chunks Table
-- Primary key is deterministic UUID derived from video_id:start_seconds:end_seconds
CREATE TABLE IF NOT EXISTS transcript_chunks (
  id UUID PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  start_seconds FLOAT NOT NULL,
  end_seconds FLOAT NOT NULL,
  text TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('spanish', text)) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_video_chunk_time UNIQUE (video_id, start_seconds, end_seconds)
);

-- Add embedding column conditionally if vector type exists, otherwise as JSONB
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS embedding vector;
  ELSE
    ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS embedding JSONB;
  END IF;
END $$;

-- Indexes for lightning-fast retrieval
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_search ON transcript_chunks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_video_time ON transcript_chunks(video_id, start_seconds);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);

-- 3. Entities (Scaffold for graph milestone)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL -- 'person', 'political_party', 'institution', 'case', 'topic', 'episode'
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES transcript_chunks(id) ON DELETE CASCADE
);

-- 4. Topics (Scaffold)
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS chunk_topics (
  chunk_id UUID NOT NULL REFERENCES transcript_chunks(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (chunk_id, topic_id)
);

-- 5. Relationships & Evidence (Traceable to transcript chunks)
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS relationship_evidence (
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES transcript_chunks(id) ON DELETE CASCADE,
  PRIMARY KEY (relationship_id, chunk_id)
);

-- 6. Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  chunk_id UUID NOT NULL REFERENCES transcript_chunks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Search Helper RPC Function
CREATE OR REPLACE FUNCTION search_transcript_chunks(
  query_text TEXT,
  match_limit INT DEFAULT 80
)
RETURNS TABLE (
  chunk_id UUID,
  video_id UUID,
  youtube_id TEXT,
  video_title TEXT,
  published_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  duration_seconds INT,
  start_seconds FLOAT,
  end_seconds FLOAT,
  text TEXT,
  rank REAL,
  headline TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id AS chunk_id,
    v.id AS video_id,
    v.youtube_id,
    v.title AS video_title,
    v.published_at,
    v.thumbnail_url,
    v.duration_seconds,
    c.start_seconds,
    c.end_seconds,
    c.text,
    ts_rank_cd(c.search_vector, websearch_to_tsquery('spanish', query_text)) AS rank,
    ts_headline('spanish', c.text, websearch_to_tsquery('spanish', query_text), 'StartSel=<mark class="bg-amber-500/30 text-amber-200 px-0.5 rounded">, StopSel=</mark>, MaxWords=60, MinWords=25, ShortWord=3') AS headline
  FROM transcript_chunks c
  JOIN videos v ON v.id = c.video_id
  WHERE c.search_vector @@ websearch_to_tsquery('spanish', query_text)
     OR c.search_vector @@ plainto_tsquery('spanish', query_text)
  ORDER BY rank DESC
  LIMIT match_limit;
$$;

-- Public Read Access Policies (Curwen Archive is a public research archive)
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'videos' AND policyname = 'Public read videos'
  ) THEN
    CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transcript_chunks' AND policyname = 'Public read chunks'
  ) THEN
    CREATE POLICY "Public read chunks" ON transcript_chunks FOR SELECT USING (true);
  END IF;
END $$;

-- Allow public execution of the search function
GRANT EXECUTE ON FUNCTION search_transcript_chunks TO anon, authenticated, service_role;
GRANT SELECT ON videos TO anon, authenticated, service_role;
GRANT SELECT ON transcript_chunks TO anon, authenticated, service_role;
