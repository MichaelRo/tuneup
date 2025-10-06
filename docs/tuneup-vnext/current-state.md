# TuneUp Current State

_Last updated: 2025-10-06_

## Product Snapshot

- Mission: Help listeners align Spotify libraries with the **No Music For Genocide** petition through a transparent, user-controlled cleanup wizard ([PROJECT_NOTES.md](../../PROJECT_NOTES.md)).
- Platform: Browser-only single-page app built with Vite + strict TypeScript; no backend services ([PROJECT_NOTES.md](../../PROJECT_NOTES.md), [README.md](../../README.md)).
- Auth: Spotify PKCE OAuth handled entirely client-side; tokens and PKCE verifier/state stored in `localStorage` / `sessionStorage` with refresh handling ([src/lib/spotify.ts](../../src/lib/spotify.ts)).
- Persistence: Minimal audit + resolver cache persisted via `localStorage` ([src/lib/state.ts](../../src/lib/state.ts)).
- Default data source: Versioned No Music For Genocide roster ([src/data/curated-lists.json](../../src/data/curated-lists.json)). Users can paste, upload CSV/JSON, or fetch lists over HTTP ([src/lib/providers.ts](../../src/lib/providers.ts)).

## Functional Overview

### Landing & Connection

- Landing hero promotes transparency and offers connect CTA with GitHub link ([src/main.ts](../../src/main.ts)).
- Login state toggles between connect CTA and wizard entry; auth status shown in header and sidebar across wizard steps ([src/main.ts](../../src/main.ts)).

### Source (`#/app`)

- If only one curated list exists, the wizard auto-skips the source step ([src/main.ts](../../src/main.ts)).
- Supports curated list picker plus custom list ingestion via paste, upload, or URL cards with progress messaging and deduplication ([src/lib/providers.ts](../../src/lib/providers.ts), [src/main.ts](../../src/main.ts)).
- Loads list metadata and displays artist and label counts with plan-ready summary cards ([src/main.ts](../../src/main.ts)).

### Resolve (`#/resolve`)

- Requires loaded list; prompts auto-resolve flow using the Spotify Search API with cached disambiguation and toasts for guidance ([src/main.ts](../../src/main.ts), [src/lib/resolver.ts](../../src/lib/resolver.ts)).
- Automatic pass caches name→id, handles ambiguous matches via modal queue, and records skips in state for future sessions ([src/lib/resolver.ts](../../src/lib/resolver.ts)).
- UI surfaces resolved vs pending vs skipped, with banner states for completion, pause, or outstanding work ([src/main.ts](../../src/main.ts)).

### Dry-Run (`#/dryrun`)

- Blocks entry until artists resolved; warns on missing prerequisites via toast and redirect ([src/main.ts](../../src/main.ts)).
- Preview generation uses `buildPlan` to fetch the Spotify library (following, liked tracks, saved albums), apply strict primary toggles and album/label options, and emit progress events for the UI ([src/lib/planner.ts](../../src/lib/planner.ts)).
- `state.previewProgress` drives staged progress UI covering following, tracks, albums, and enrichment with percent tracking ([src/main.ts](../../src/main.ts)).
- Plan summary highlights counts, impacted items, label badges, and evidence list ([src/main.ts](../../src/main.ts)).

### Apply (`#/apply`)

- Requires generated plan; progress card tracks phases (`unfollow`, `tracks`, `albums`) with per-phase status, retry counts, rate-limit messaging, and overall percent ([src/main.ts](../../src/main.ts), [src/lib/apply.ts](../../src/lib/apply.ts)).
- `runPlan` batches Spotify API mutations (50 IDs) with retry/backoff and rate-limit hooks surfacing in the UI ([src/lib/apply.ts](../../src/lib/apply.ts), [src/lib/spotify.ts](../../src/lib/spotify.ts)).
- Local audit trail updates with before/after totals and an operation record to support future undo or export enhancements ([src/main.ts](../../src/main.ts), [src/lib/state.ts](../../src/lib/state.ts)).

### Report (`#/report`)

- Exports JSON (plan + before/after + metadata) and CSV (flattened removals) for audit and manual undo ([src/lib/report.ts](../../src/lib/report.ts)).
- References last plan context and curated list metadata for audit completeness ([src/main.ts](../../src/main.ts)).

## UX & Interaction Patterns

- Shell layout with sidebar stepper plus bottom navigation for wizard steps ([src/main.ts](../../src/main.ts)).
- Progress patterns: staged preview progress, per-phase apply progress, and badges for phases and labels ([src/main.ts](../../src/main.ts), [src/lib/i18n.ts](../../src/lib/i18n.ts)).
- Decision modals (resolve ambiguity) and toast system for lightweight feedback ([src/lib/ui.ts](../../src/lib/ui.ts)).
- Label cleanup visualized via pill and badge styles consistent with artist reasons ([PROJECT_NOTES.md](../../PROJECT_NOTES.md)).
- Language toggle accessible from shell header; direction switching handled by the i18n module ([src/main.ts](../../src/main.ts), [src/lib/i18n.ts](../../src/lib/i18n.ts)).

## Technical Constraints

- Spotify OAuth scopes: `user-follow-*`, `user-library-*`; insufficient scope triggers reconnect toast ([PROJECT_NOTES.md](../../PROJECT_NOTES.md), [src/lib/spotify.ts](../../src/lib/spotify.ts)).
- Browser storage only; no secure server store—risk of local state loss if storage cleared ([src/lib/state.ts](../../src/lib/state.ts)).
- Spotify rate limits handled with retry and exponential backoff; plan apply may stall if large libraries hit repeated 429s ([src/lib/spotify.ts](../../src/lib/spotify.ts)).
- Data caches (following, liked tracks, albums) expire after 5 minutes to balance browser memory and redundant API calls ([src/lib/spotify.ts](../../src/lib/spotify.ts)).
- Enrichment for label cleanup requires additional album fetches; large libraries may incur extended dry-run times ([src/lib/planner.ts](../../src/lib/planner.ts)).

## Internationalization & Accessibility

- English and Hebrew strings; right-to-left layout support via locale metadata ([src/lib/i18n.ts](../../src/lib/i18n.ts)).
- Text-centric badges and progress indicators designed for icon-free accessibility. Needs review for WCAG color contrast and focus states (current CSS relies on color tokens without documented contrast testing).
- Locale toggles persisted for session only; translator workflow documented in notes but no automated extraction.

## Known Limitations & Risks

- Playlist cleanup not yet supported; remains a backlog idea for future iterations ([PROJECT_NOTES.md](../../PROJECT_NOTES.md)).
- Undo limited to exported report; no in-app reversal or Spotify snapshot restore.
- LocalStorage cache can grow without pruning; lacks quota monitoring ([src/lib/state.ts](../../src/lib/state.ts)).
- Single curated list; no UI for browsing multi-list future—logic exists but remains untested ([src/lib/providers.ts](../../src/lib/providers.ts)).
- Accessibility gaps: no documented keyboard trap handling for modals, no focus ring spec in CSS ([src/lib/ui.ts](../../src/lib/ui.ts)).
- Auth resilience: PKCE verifier stored in `sessionStorage`; closing tab mid-auth leaves leftover verifier but handled on next login attempt (implicit but worth documenting).
- Offline detection not implemented; API failures surface as generic toasts.

## Documentation & Alignment Gaps

- [PROJECT_NOTES.md](../../PROJECT_NOTES.md) is current but lacks explicit success metrics, persona assumptions, or target scale.
- Document new consent copy once trust hub work lands; avoid drifting messaging between [README.md](../../README.md) and landing strings.
- No consolidated changelog; release prep details embedded in notes.
- Internationalization process undocumented beyond manual note.

## Open Questions

1. What success metrics (adoption, completion rate, library impact) should we monitor in upcoming release?
2. How will we support petitions beyond No Music For Genocide (list governance, validation, content updates)?
3. Do we need offline-safe persistence (IndexedDB) for large plans or is `localStorage` sufficient?
4. Should we expose label normalization rules to users (e.g., editing/whitelisting labels)?
5. How do we communicate risk/irreversibility more clearly before apply?
6. Is there a roadmap for multi-language expansion or community translations beyond English/Hebrew?
