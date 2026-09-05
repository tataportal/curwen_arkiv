# Curwen Archive

Public archive of Curwen livestream transcripts. Next.js 16, TypeScript, Tailwind 4 and Supabase/PostgreSQL Spanish full-text search.

## Foundation repair status

The repository includes the original schema plus `supabase/migrations/20260905010000_repair_archive_foundation.sql`. The repair migration is **prepared and locally tested, not applied to Supabase**. No full-corpus ingestion has been performed by this repair. Deploy code and migrate/re-import together: the new search fails explicitly while old chunks lack cue timing instead of pretending to return complete results.

The expected corpus target is **477 unique YouTube videos**. Always re-count `data/raw` by `.info.json` `id`; do not use file counts or the expected target as the observed count. The latest dry-run and per-episode counts are in `reports/corpus-dry-run.json`.

## Local commands

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dry-run
npm run dev
```

`npm test` runs parser, corpus discovery, API/pagination/error, player lifecycle, and SQL regression tests. SQL tests run both migration files in disposable in-memory PostgreSQL (PGlite), including one real episode; they never connect to Supabase. Synthetic fixtures describe generic test content, not invented political evidence. The one real source test depends on `data/raw`.

## Corpus audit and dry-run

```bash
npm run ingest -- data/raw --dry-run --expected 477 --report reports/corpus-dry-run.json
```

The default mode is dry-run even if `--dry-run` is omitted. It does not read Supabase credentials, create a client or write database rows. The optional report is written outside the source folder. Reports contain unique video IDs, valid pairs, missing VTT/JSON IDs, duplicate groups, conflicting duplicates, excluded playlist metadata, invalid metadata, parser failures, total cues/chunks, and counts/hashes for each episode. Identical duplicate sources are counted but processed once; conflicting sources block writing.

Exit codes: `0` = ready; `2` = a completed preflight with corpus gaps, parse errors or source changes; `1` = fatal configuration/runtime error. A target mismatch is reported and blocks ingestion; no files are invented or downloaded to reach the target. Correcting the expected target requires an explicit deliberate `--expected` value.

## Parsing and timestamp contract

The parser retains each canonical cue's start/end, first-new-word inline timestamp when supplied, and source-order index. Rolling deduplication uses the complete preceding cue and only operates on overlapping/contiguous cues. Repetition after a pause survives. All canonical cues, including short/numeric text and final tails, survive chunking. YouTube's observed final inline timestamp overrun of 10 ms is accepted within a 20 ms validation tolerance; display cue end times are retained.

Chunks group roughly 30–60 seconds. Each also carries a lookahead of one chunk for multiword searches crossing a boundary. Search emits only starts owned by the chunk, preventing duplicate lookahead hits. Queries use PostgreSQL Spanish `websearch_to_tsquery`; quoted phrases and unquoted AND queries are supported. Minimal matching cue spans locate the source cue, not an invented word time. Multiple matches within one cue share that cue's precision. Query scope is at most the current chunk plus its next chunk, not terms scattered across an entire episode.

PostgreSQL clusters the full matching set before paginating (maximum group span 120 seconds and maximum gap 90 seconds). API totals distinguish matching chunks, matching cue spans and grouped discussions. Totals and pages are evaluated in the same RPC snapshot; separately requested pages reflect the database at each request.

Reference: [PostgreSQL full-text query semantics](https://www.postgresql.org/docs/current/textsearch-controls.html).

## Database changes — approval required for this handoff

1. Review both migration files. Existing installations should apply only the new repair migration.
2. Configure `.env.local` using `.env.example`. Public reads use a publishable/anon key. Ingestion requires a server secret/service-role key; public keys are not accepted as a write fallback.
3. After approval, apply the repair SQL through Supabase SQL Editor or the explicit runner:

```bash
node --import tsx scripts/update-rpc.ts --apply
```

The runner requires `DATABASE_URL`; no database password belongs in source. A plaintext password was removed from the previous untracked repair script. Its rotation still needs to be performed in the database account.

4. Reconcile corpus gaps, re-run the complete dry-run, and obtain ingestion approval. Only then:

```bash
npm run ingest -- data/raw --write --expected 477 --report reports/ingestion.json
```

The CLI parses the entire corpus before any writes. `replace_archive_episode` performs each episode in one transaction with an advisory lock: upsert metadata/chunks and delete obsolete chunks together. Failed episodes roll back. Identical content/parser hashes plus verified stored chunk contents produce a no-op. Hashes cover metadata, parser revision and the generated payload. Reruns repair partial/mismatched content. Source changes between preflight and preparation abort that episode. Transactions are per episode, not across the whole corpus.

## Frontend and APIs

- `/`: paginated clustered search and exact source-cue links/player.
- `/episodes`: server-filtered title search, chronological ordering, pagination and exact count.
- `/episode/[youtube_id]`: all transcript pages retrieved, canonical cue display/seek, stable YouTube player lifecycle and timestamp sharing.
- `/api/search?q=…&page=1&page_size=20`
- `/api/episodes?q=…&page=1&page_size=24&order=desc`
- `/api/episode/[youtube_id]`

Errors use HTTP 400/503 and visible retry states; genuine absence uses empty HTTP 200 search results or episode HTTP 404. Transcript text is rendered as React text, never trusted HTML. The repaired legacy headline RPC uses a plain `<mark>` option; styling is separate.

Graph scaffolding, the local-only bookmark toggle and nullable future schema fields predate this repair. Embeddings, LLM extraction, relationships and persistent bookmarks are not implemented by this milestone.
