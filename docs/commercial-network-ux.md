# Commercial demo — expandable network and evidence

Scope stays at 24 transcript-reviewed moments, six per person, from nine existing episodes. No inference, ingestion, new services, embeddings or experimental semantic data.

## Interaction contract

- Search/person controls replace the search scope. Other graph actions do not perform a new search.
- A concept click adds supported shared-moment associations. The root, prior nodes and camera remain unchanged. Graph depth is capped at two; recentering does not reset that cap.
- Recenter moves the camera to the selected concept and retains every branch.
- Regresar restores the preceding graph/camera/zoom state. Manual fit exposes any nodes outside the view; expansions never silently reframe.
- Slow node drift and background breathing pause during node interaction, playback, reduced-motion or hidden-page state. Ambiente disables both; volume is shared.
- Hover provides one continuous timestamped video, protected by the existing 28px buffer and 700ms leave delay. Clicking that video enlarges the same player.
- Ver N momentos scrolls below the full-height map, filters to the selected path's evidence and preserves the network state. Returning closes inline playback and restores the same map view.
- Evidence is grouped once per video_id, with episode thumbnail/name/date and chronological moments. Each moment has the original cue timestamp, reviewed title and full attributed summary, inline video, optional transcription context and share link.
- All playback uses max(0, floor(occurrence.cue_start_seconds) - 3). Original evidence clocks/data remain untouched. Textual context includes preceding cues.

## Verification

- 52 automated tests: bounded data/provenance, timestamp URLs, chronological grouping, graph preservation, shared-moment edges, two-level limit, video/player and existing app checks.
- Typecheck and Next webpack build pass.
- Existing verifier confirms all 24 source hashes and cue timestamps from nine raw episodes; zero inference calls.
- Local browser verified 9 → 12 nodes on Cerimedo expansion with identical root bounds and camera transform. Recenter retained all 12 nodes; Regresar restored the initial transform. Level 2 retained 12 nodes and exposed the exact single-moment path Keiko → Cerimedo → La República.
- Local inline video observed at 3081.0299s for original cue 3084s, unmuted. Earlier cues and links present. Returning to the map retained all labels/camera and removed the player.
- Production verification is recorded in the delivery checkpoint after publication.
