# Topic-specific evidence anchors

La República and inteligencia artificial pointed to the same curated moment and reused its Keiko occurrence (3084.64s). This made both previews, links and evidence cards open at 3081s despite their distinct supporting quotes.

The original 24 moments, summaries and person occurrences are preserved. A separate versioned file now records 68 topic evidence anchors, generated deterministically from the nine existing raw VTT sources and the already reviewed quotes. Source hashes are checked before generation. No inference, ingestion, additional corpus or new service is used.

- La República: source cue 3064.44s (51:04), playback 3061s (51:01).
- inteligencia artificial: source cue 3181.359s (53:01), playback 3178s (52:58).

The graph selection creates a presentation view with its own selected evidence, while the original moment occurrence remains unchanged. Hover previews, expanded video, episode links, moment links, inline video, chronological ordering, requested transcript context and share links all consume that selected occurrence. The chosen quote is highlighted. Prior speech is retained as a source excerpt, with a separate source context window.

Topics whose reviewed quote does not literally name the concept use the quote's exact anchor and are labelled “Cita sobre”, not “Mención de”. No missing topic anchor silently falls back to the person's clock.

Validation: 55 tests, typecheck and webpack build pass. The source verifier reproduces all 68 anchors byte-for-byte from the frozen nine raw episodes. Local browser verified both distinct links/citations, the 3061s player seek and La República's full graph path. Production checks recorded in the repair checkpoint after deployment.

Reproduce/verify without inference:
`node --import tsx scripts/build-commercial-topic-evidence.ts '/Users/tata/Desktop/_PERSONAL/Curwen Arkiv/data/raw' --check`
