# Curwen Archive

Home contains only a search line. Enter moves it upward and opens a real network of transcript co-mentions. Every edge has source text and a YouTube link. The archive, result groups and searchable transcript use the public Supabase data.

## Data compatibility

The preferred search path remains the existing search_archive RPC. If PostgreSQL reports that this function is not deployed, the application queries the existing Spanish full-text index via Supabase's public read API. It reads every matching fragment before applying the same 90-second gap / 120-second discussion-span grouping and then paginates. Database outages and permissions errors still fail visibly.

Episode retrieval supports both schemas: cue-bearing transcripts and the current fragment-only records. The fallback is restricted to the specific missing-cues-column error. No migration, ingest, corpus rewrite, or database write is performed by the UI or its build.

Fragment-level records expose the source fragment's start time. They are explicitly labeled as such; they are not represented as exact word-level occurrences. If the cue-aware RPC becomes available, it is used automatically.

## Evidence network

Neighbors are transcript terms only. Lowercase concepts are matched against the explicit lexical vocabulary in `src/lib/concept-terms.ts`; a concept requires a literal co-mention with the query in source text. This vocabulary is a coverage limit, not a list of predefined relationships. Capitalized phrases/acronyms remain candidates when repeated in at least two distinct evidence records. Concepts rank before those name candidates, then by supporting records and word distance from the query. Edges mean co-mention in the same fragment; they do not assert affiliation, guilt, support, financing, or another semantic political relationship.

Nodes expand with another real search. Episodes never fill sparse branches: their titles and timestamps appear only as supporting evidence. Without supported neighbors, the branch remains empty and says so. A second term searches for shared fragments and exposes up to three source-backed paths through those fragments. Each path requires both literal terms in the same text. No transitive political relationships are inferred. Concept discovery is lexical and deliberately limited, not semantic extraction or embeddings.

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

## Four information levels

The graph renders concept/term nodes and co-mention edges only, including paired searches. Commas and `+` delimit two concepts; each root expands independently from real search results. Their direct edge still requires shared evidence. Episode and fragment titles never become map nodes.

Hover (220 ms), keyboard focus, or tap opens one anchored floating preview. A click/tap pins it; Escape, close, or clicking the map dismisses it. The video uses a 16:9 YouTube player, muted, with the original numeric start and an 8-second end. Reduced-motion users get a play control instead of autoplay; blocked/unavailable playback retains an external link. Changing evidence or opening the next level destroys the previous player. Only the timestamp and title appear beneath quick video evidence; no transcript paragraph is repeated there.

“Ver N momentos” opens compact chronological evidence rows with a source title, timestamp, up to two short source sentences, and one optional preview. The global result list uses the same component. Only “Ver contexto completo” fetches the episode transcript and shows the source interval plus roughly 25 seconds on either side; cue-bearing sources retain cue timing, fragment-only sources retain their original boundaries. Opening context replaces the short excerpt for that row.

This changes presentation only. The deployed legacy search still has fragment-level timing where cues are unavailable. Decimal timestamps are preserved in URLs and preview API commands, but neither word-level precision nor an exact video frame is invented. YouTube can seek to a neighboring keyframe and browser policies can block autoplay: https://developers.google.com/youtube/iframe_api_reference . No embeddings, expanded corpus ingestion, or new retrieval backend were deployed.
