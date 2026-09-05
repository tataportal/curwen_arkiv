-- Foundation repair. Apply after 20260905000000_init_curwen_archive.sql.
-- Existing rows remain intact. Cue search requires a subsequent approved re-import.
BEGIN;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS source_hash text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS parser_version text;
ALTER TABLE public.transcript_chunks ADD COLUMN IF NOT EXISTS cues jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.transcript_chunks ADD COLUMN IF NOT EXISTS search_cues jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.transcript_chunks ADD COLUMN IF NOT EXISTS search_text text;
ALTER TABLE public.transcript_chunks ADD COLUMN IF NOT EXISTS occurrence_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(search_text, text))) STORED;
CREATE INDEX IF NOT EXISTS idx_archive_occurrence_search ON public.transcript_chunks USING gin(occurrence_vector);

-- One RPC call = one PostgreSQL transaction. A failure rolls back metadata,
-- chunk writes and stale-row removal together. Writers of the same video serialize.
CREATE OR REPLACE FUNCTION public.replace_archive_episode(
  episode jsonb, chunk_rows jsonb, content_hash text, parser_revision text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE vid uuid; item jsonb; old_hash text; old_revision text;
BEGIN
  IF coalesce(episode->>'youtube_id','') !~ '^[A-Za-z0-9_-]{11}$'
    OR coalesce(episode->>'title','') = '' OR coalesce(content_hash,'') !~ '^[a-f0-9]{64}$'
    OR coalesce(parser_revision,'') = '' OR jsonb_typeof(chunk_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(chunk_rows) = 0 THEN RAISE EXCEPTION 'Invalid or empty episode payload'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(chunk_rows) LOOP
    IF coalesce(item->>'text','') = '' OR (item->>'start_seconds')::float8 < 0
      OR NOT ((item->>'end_seconds')::float8 > (item->>'start_seconds')::float8)
      OR jsonb_typeof(item->'cues') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'cues') = 0
      OR jsonb_typeof(item->'search_cues') IS DISTINCT FROM 'array'
      OR coalesce(item->>'search_text','') = '' THEN RAISE EXCEPTION 'Invalid chunk payload'; END IF;
    IF item->>'text' IS DISTINCT FROM (SELECT string_agg(c->>'text',' ' ORDER BY n) FROM jsonb_array_elements(item->'cues') WITH ORDINALITY a(c,n))
      OR item->>'search_text' IS DISTINCT FROM (SELECT string_agg(c->>'text',' ' ORDER BY n) FROM jsonb_array_elements(item->'search_cues') WITH ORDINALITY a(c,n))
      THEN RAISE EXCEPTION 'Cue text does not match chunk text'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(item->'search_cues') c WHERE
      (c->>'cue_index') IS NULL OR (c->>'start_seconds') IS NULL OR (c->>'end_seconds') IS NULL
      OR (c->>'start_seconds')::float8 < 0 OR (c->>'end_seconds')::float8 <= (c->>'start_seconds')::float8
      OR coalesce(c->>'text','') = '') THEN RAISE EXCEPTION 'Invalid source cue'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended(episode->>'youtube_id', 0));
  SELECT id, source_hash, parser_version INTO vid, old_hash, old_revision
    FROM videos WHERE youtube_id = episode->>'youtube_id' FOR UPDATE;
  IF vid IS NOT NULL AND old_hash = content_hash AND old_revision = parser_revision
    AND (SELECT count(*) FROM transcript_chunks WHERE video_id = vid) = jsonb_array_length(chunk_rows)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(chunk_rows) r LEFT JOIN transcript_chunks c
      ON c.video_id = vid AND c.id = (r->>'id')::uuid
      WHERE c.id IS NULL OR c.text IS DISTINCT FROM r->>'text' OR c.cues IS DISTINCT FROM r->'cues'
        OR c.search_cues IS DISTINCT FROM r->'search_cues' OR c.search_text IS DISTINCT FROM r->>'search_text'
        OR c.start_seconds IS DISTINCT FROM (r->>'start_seconds')::float8
        OR c.end_seconds IS DISTINCT FROM (r->>'end_seconds')::float8)
    THEN RETURN jsonb_build_object('status','unchanged','video_id',vid,'chunks',jsonb_array_length(chunk_rows)); END IF;
  INSERT INTO videos (youtube_id,title,description,published_at,duration_seconds,thumbnail_url,youtube_url,source_hash,parser_version)
    VALUES (episode->>'youtube_id',episode->>'title',episode->>'description',(episode->>'published_at')::timestamptz,
      (episode->>'duration_seconds')::integer,episode->>'thumbnail_url',episode->>'youtube_url',content_hash,parser_revision)
    ON CONFLICT (youtube_id) DO UPDATE SET title=excluded.title,description=excluded.description,
      published_at=excluded.published_at,duration_seconds=excluded.duration_seconds,thumbnail_url=excluded.thumbnail_url,
      youtube_url=excluded.youtube_url,source_hash=excluded.source_hash,parser_version=excluded.parser_version RETURNING id INTO vid;
  INSERT INTO transcript_chunks (id,video_id,start_seconds,end_seconds,text,cues,search_cues,search_text)
    SELECT (r->>'id')::uuid,vid,(r->>'start_seconds')::float8,(r->>'end_seconds')::float8,r->>'text',r->'cues',r->'search_cues',r->>'search_text'
    FROM jsonb_array_elements(chunk_rows) r
    ON CONFLICT (video_id,start_seconds,end_seconds) DO UPDATE SET
      text=excluded.text,cues=excluded.cues,search_cues=excluded.search_cues,search_text=excluded.search_text;
  DELETE FROM transcript_chunks c WHERE c.video_id=vid AND NOT EXISTS
    (SELECT 1 FROM jsonb_array_elements(chunk_rows) r WHERE c.start_seconds=(r->>'start_seconds')::float8 AND c.end_seconds=(r->>'end_seconds')::float8);
  RETURN jsonb_build_object('status','replaced','video_id',vid,'chunks',jsonb_array_length(chunk_rows));
END $$;
REVOKE ALL ON FUNCTION public.replace_archive_episode(jsonb,jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_archive_episode(jsonb,jsonb,text,text) TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.videos, public.transcript_chunks TO service_role;

-- Repair the existing RPC too. Styling belongs in CSS, not ts_headline options.
CREATE OR REPLACE FUNCTION public.search_transcript_chunks(query_text text, match_limit integer DEFAULT NULL)
RETURNS TABLE (chunk_id uuid,video_id uuid,youtube_id text,video_title text,published_at timestamptz,
  thumbnail_url text,duration_seconds integer,start_seconds float8,end_seconds float8,text text,rank real,headline text)
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT c.id,v.id,v.youtube_id,v.title,v.published_at,v.thumbnail_url,v.duration_seconds,c.start_seconds,c.end_seconds,c.text,
    ts_rank_cd(c.search_vector,websearch_to_tsquery('spanish',query_text)),
    ts_headline('spanish',c.text,websearch_to_tsquery('spanish',query_text),'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=25')
  FROM transcript_chunks c JOIN videos v ON v.id=c.video_id
  WHERE c.search_vector @@ websearch_to_tsquery('spanish',query_text)
  ORDER BY 12 DESC,v.youtube_id,c.start_seconds,c.id LIMIT match_limit;
$$;

-- Minimal forward cue spans satisfying the complete Spanish query. Context can
-- cross a chunk boundary; only owned cue starts are emitted, once each. A phrase
-- inside one cue is one cue-level occurrence, retaining the source precision.
CREATE OR REPLACE FUNCTION public.archive_cue_occurrences(source_cues jsonb, owned_count integer, q tsquery)
RETURNS TABLE(cue_index integer,start_seconds float8,end_seconds float8,match_text text)
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE i integer; j integer; n integer := jsonb_array_length(source_cues); candidate text; suffix text; first_cue jsonb;
BEGIN
  IF n=0 OR numnode(q)=0 OR querytree(q) IN ('','T') THEN RETURN; END IF;
  FOR i IN 0..least(owned_count,n)-1 LOOP
    first_cue := source_cues->i;
    -- ts_headline highlights positive query words even when the complete phrase
    -- spans multiple cues. Starts with no query word cannot be minimal matches.
    IF position('<mark>' in ts_headline('spanish',replace(first_cue->>'text','<','&lt;'),q,
      'StartSel=<mark>, StopSel=</mark>, HighlightAll=true'))=0 THEN CONTINUE; END IF;
    candidate := ''; suffix := '';
    FOR j IN i..n-1 LOOP
      candidate := concat_ws(' ',nullif(candidate,''),source_cues->j->>'text');
      IF j>i THEN suffix := concat_ws(' ',nullif(suffix,''),source_cues->j->>'text'); END IF;
      IF to_tsvector('spanish',candidate) @@ q THEN
        IF suffix='' OR NOT (to_tsvector('spanish',suffix) @@ q) THEN
          cue_index := (first_cue->>'cue_index')::integer;
          start_seconds := (first_cue->>'start_seconds')::float8;
          end_seconds := (source_cues->j->>'end_seconds')::float8;
          match_text := candidate; RETURN NEXT;
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Cluster the COMPLETE hit set before pagination so discussions do not split
-- at page boundaries. Return totals even when the requested page is empty.
CREATE OR REPLACE FUNCTION public.search_archive(query_text text,page_number integer DEFAULT 1,page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; q tsquery := websearch_to_tsquery('spanish',query_text);
BEGIN
  IF page_number<1 OR page_size<1 OR page_size>100 OR length(query_text)>500 THEN RAISE EXCEPTION 'Invalid search pagination'; END IF;
  IF EXISTS(SELECT 1 FROM transcript_chunks WHERE jsonb_array_length(cues)=0) THEN
    RAISE EXCEPTION 'Cue index unavailable: approve migration and corpus re-import before searching'; END IF;
  WITH RECURSIVE hits AS MATERIALIZED (
    SELECT c.id chunk_id,c.video_id,h.*,ts_rank_cd(c.occurrence_vector,q) rank,c.text context
    FROM transcript_chunks c CROSS JOIN LATERAL archive_cue_occurrences(c.search_cues,jsonb_array_length(c.cues),q) h
    WHERE c.occurrence_vector @@ q
  ), numbered AS (
    SELECT *,row_number() OVER(PARTITION BY video_id ORDER BY start_seconds,cue_index,chunk_id) rn FROM hits
  ), grouped AS (
    SELECT n.*,1::bigint grp,n.start_seconds group_start FROM numbered n WHERE rn=1
    UNION ALL
    SELECT n.*,CASE WHEN n.start_seconds-g.end_seconds<=90 AND n.end_seconds-g.group_start<=120 THEN g.grp ELSE g.grp+1 END,
      CASE WHEN n.start_seconds-g.end_seconds<=90 AND n.end_seconds-g.group_start<=120 THEN g.group_start ELSE n.start_seconds END
    FROM grouped g JOIN numbered n ON n.video_id=g.video_id AND n.rn=g.rn+1
  ), clusters AS (
    SELECT video_id,grp,min(start_seconds) start_seconds,max(end_seconds) end_seconds,max(rank) rank,
      string_agg(match_text,' … ' ORDER BY rn) combined_text,
      jsonb_agg(jsonb_build_object('chunk_id',chunk_id,'cue_index',cue_index,'start_seconds',start_seconds,
        'end_seconds',end_seconds,'text_snippet',context) ORDER BY rn) timestamps
    FROM grouped GROUP BY video_id,grp
  ), page AS (
    SELECT c.*,v.youtube_id,v.title video_title,v.published_at,v.thumbnail_url,v.duration_seconds
    FROM clusters c JOIN videos v ON v.id=c.video_id
    ORDER BY c.rank DESC,v.youtube_id,c.start_seconds,c.grp LIMIT page_size OFFSET ((page_number::bigint-1)*page_size)
  ) SELECT jsonb_build_object('query',query_text,'page',page_number,'page_size',page_size,
    'total_clusters',(SELECT count(*) FROM clusters),'total_chunk_hits',(SELECT count(DISTINCT chunk_id) FROM hits),
    'total_occurrences',(SELECT count(*) FROM hits),'results',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY rank DESC,youtube_id,start_seconds,grp) FROM page p),'[]'::jsonb)) INTO result;
  RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.search_archive(text,integer,integer) TO anon,authenticated,service_role;
COMMIT;
