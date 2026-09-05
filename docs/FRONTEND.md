# Curwen Archive frontend

Home contains only a search line. Submitting moves it upward and opens the network behind it. Actual transcript moments are available as a secondary evidence list, grouped by episode without changing the API's conversation clusters.

## Run

- npm run dev
- npm run typecheck
- npm run build
- node scripts/build-pages.mjs

## Hosting

The regular Next app retains its existing /api routes and /episode/[youtube_id] route.
GitHub Pages exports a static copy in a temporary build directory. It uses the existing search/data functions against Supabase using only a public anonymous/publishable key. No service-role credential is included. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY as GitHub Actions repository variables.

Pages episode links use /episode/?id=VIDEO_ID so newly imported episodes work without rebuilding. Inbound /episode/VIDEO_ID links are redirected by the Pages 404 shell, preserving the timestamp. A direct dynamic URL initially receives HTTP 404 because Pages has no server rewrites.

The static build never reads or exports data/raw. Ingestion and migrations are not run by the Pages workflow.

## Network contract

NetworkExplorer accepts an optional NetworkSource with neighbors and paths methods. No source is connected yet. User-entered terms are query nodes, not identified political entities. No edges or evidence are synthesized. Evidence-backed edge rendering, branch selection, second-term entry, path selection, and evidence links have frontend scaffolding only.

## Performance and accessibility

CSS-only scene transitions; no animation dependency. The network is loaded after search and capped at 40 nodes. Transcript rendering grows in 160-row increments. Timestamp links open YouTube directly. Forms have labels, status announcements, keyboard controls and visible focus. Reduced motion disables spatial movement and blur transitions.
