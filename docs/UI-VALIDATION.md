# UI repair validation · 5 September 2026

This supersedes the initial scaffold report.

## Working behavior

- Home: one search line only.
- Enter: search moves upward, live network expands automatically.
- Existing search endpoint repaired through the public full-text index compatibility layer.
- Real transcript details load on the current schema without requiring the undeployed cues column.
- Literal co-mention branches, source episode branches, clickable evidence, progressive exploration.
- Second-term paths through transcript fragments that contain both literal terms.
- Grouped results, complete pre-pagination clustering, full transcript filtering, direct YouTube links.
- Loading, empty and actual database failures remain distinct.
- Desktop and mobile layouts; keyboard focus; reduced-motion CSS.

## Evidence and limitations

A live query for “keiko fujimori” succeeded with real source fragments and episode metadata. The network included literal terms such as Fuerza Popular, Roberto Sánchez and PPK, each with quoted transcript evidence. These are examples from a live snapshot, not fixed catalog totals.

Current database timestamps have fragment-level precision. The UI labels them “inicio del fragmento”. Exact first-word cue precision depends on the cue-aware index; the app does not fabricate a finer timestamp.

Relationships mean co-mentions, not political/semantic associations. Capitalized phrase extraction is not canonical entity resolution. Network branches cover the currently retrieved moments, with more branches available by exploration.

## Tests and scope

- Typecheck passed.
- Full test suite: 37 passed.
- Production Next build and static Pages build passed.
- New tests cover missing RPC compatibility, legacy transcript fields, complete grouping, fail-closed database errors, literal evidence for both ends of an edge, and common-fragment paths.
- No production database writes, migrations, ingestion changes, parser changes, or raw corpus modifications.
- Legacy search reads all matching rows before clustering; frequent broad searches may be more expensive than the preferred server RPC. Graph branch responses are cached during exploration.

## Repair files

- src/lib/search.ts
- src/lib/types.ts
- src/lib/legacy-search.ts
- src/lib/evidence-network.ts
- src/components/archive-client.ts
- src/components/NetworkExplorer.tsx
- src/components/SearchExperience.tsx
- src/app/globals.css
- tests/search-compatibility.test.ts
- .github/workflows/pages.yml
- docs/FRONTEND.md
- docs/UI-VALIDATION.md

Public site: https://tataportal.github.io/curwen_arkiv/
Repository: https://github.com/tataportal/curwen_arkiv
