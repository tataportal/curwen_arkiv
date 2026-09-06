# Curwen Retrieval API

Live API: https://curwen-retrieval-api.tataportal.chatgpt.site/api/search?q=Vacunas

This is the deployed Worker source. `data/` is a lossless token/sentence projection of the approved, frozen 103-episode snapshot. No expanded corpus, embeddings, or new source ingestion. Snapshot: `54361cdb2a1ad2cadfab1725b91bd2298ef75bc4823d78a274cdd33a08dbc121`.

The response is `cue-retrieval-1`, paginated by episode. Playback uses `occurrence.cue_start_seconds`. `wordStartSeconds` is retained for auditing ASR word alignment; it does not replace the requested cue timestamp. Context tokens retain cue IDs and their original cue starts, enabling literal related-concept evidence with real occurrence provenance.

`npm install && npm run build` builds `dist/server/index.js` and static snapshot assets. Deploy the validated archive through the Sites project in `.openai/hosting.json`; never deploy a static Pages build as an API. The web frontend remains GitHub Pages. No API keys are required by this service.

Responses are cached for five minutes in a bounded per-isolate cache. First searches may be slower while snapshot assets load. The API has CORS enabled for the public frontend. Missing/corrupt assets produce 503, with no chunk fallback. Moments longer than 180 seconds remain intact and are reported by diagnostics.
