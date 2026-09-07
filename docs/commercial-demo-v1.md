# Commercial demo v1

This scope replaces mass processing. Delivery is a partial, curated demonstration of finding and using the archive, not a complete historical product.

- Four people: Keiko, RLA, Chibolín, Magaly.
- 24 transcript-reviewed moments, six per person (maximum allowed: 25 per person), from nine existing source episodes.
- Local/static search, explicit topic/people connections with literal supporting quotations, attributed summaries, original cue identity, chronological episode grouping, shareable moment links and continuous video with a three-second lead-in.
- The data is a separately named curated selection, not promotion of experimental semantic-v2 outputs. Summary review checks the supplied transcript; it is not independent verification of participants' claims.
- Existing GitHub Pages hosting, existing YouTube embeds, no new services, keys, purchases or paid API calls.
- No automatic updates, full-corpus ingestion, embeddings or changes to existing checkpoints. Full history, updates and maintenance require separately agreed scope and an advance payment.

Data: src/data/commercial-demo.json. Every row preserves source hash, source moment ID, source occurrence and context cue IDs. The original VTT content is not rewritten.

Validation: npm test; npm run typecheck; npm run build. Source verification, when the canonical corpus is available: node --import tsx scripts/verify-commercial-demo.ts '/path/to/data/raw'.

Demonstration flow:
1. Open Keiko and inspect a summary with its original mention time.
2. Choose RLA; search `segunda vuelta` and compare moments within the same episode.
3. Choose Chibolín → media training. Open the transcript to see the quotations supporting the connection to Rafael López Aliaga and Renovación Popular.
4. Choose Magaly → difamación. Compare the reported decision with the conductor's interpretation; preserve the distinction between sentence and immediate imprisonment.
5. Play a video; playback begins max(0, floor(cue_start_seconds)-3), while the displayed mention retains the original cue time.
6. Copy a moment link and open it directly. Empty search results explicitly refer only to this partial selection.

Publication must contain only the curated dataset and frontend changes, never raw corpus files or experimental review outputs.
