# Curwen Archive

Home contains only a search line. Enter moves it upward and opens a real network of transcript co-mentions. Every edge has source text and a YouTube link. The archive, result groups and searchable transcript use the public Supabase data.

## Data compatibility

The preferred search path remains the existing search_archive RPC. If PostgreSQL reports that this function is not deployed, the application queries the existing Spanish full-text index via Supabase's public read API. It reads every matching fragment before applying the same 90-second gap / 120-second discussion-span grouping and then paginates. Database outages and permissions errors still fail visibly.

Episode retrieval supports both schemas: cue-bearing transcripts and the current fragment-only records. The fallback is restricted to the specific missing-cues-column error. No migration, ingest, corpus rewrite, or database write is performed by the UI or its build.

Fragment-level records expose the source fragment's start time. They are explicitly labeled as such; they are not represented as exact word-level occurrences. If the cue-aware RPC becomes available, it is used automatically.

## Evidence network

Terms are literal capitalized phrases/acronyms found in returned transcript excerpts, with repeated evidence required for a term branch. They are not a curated, canonical entity catalog. Edges mean co-mention in the same fragment; they do not assert affiliation, guilt, support, financing, or another semantic political relationship.

Nodes expand with another real search. Episode nodes open evidence. A second term searches for shared fragments and exposes up to three source-backed paths through those fragments. Each path requires both literal terms in the same text. No transitive political relationships are inferred.

The network represents the currently retrieved moments, not an exhaustive entity graph for the entire corpus. Initial expansion is bounded, history remains visible, the map can be moved/zoomed, and the node count is capped at 40. Network code is loaded after search.

## Run and deploy

- npm run dev
- npm run typecheck
- npm test
- npm run build
- node scripts/build-pages.mjs

GitHub Pages builds a static copy in a temporary directory. Existing Next API routes stay available for server deployments. The static browser calls the same data functions using only the public Supabase key configured through GitHub repository variables.

Pages episode links use /episode/?id=VIDEO_ID so newly imported episodes do not require a rebuild. Inbound /episode/VIDEO_ID links redirect through the Pages 404 shell, preserving timestamps. Their first HTTP response is 404, a Pages limitation.

The publish checkout is /tmp/curwen-publish. The working directory's original git history and local downloaded corpus were not uploaded.
