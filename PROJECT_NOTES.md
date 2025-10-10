# TuneUp Project Notes

## Glossary

- **PKCE**: Proof Key for Code Exchange, a secure OAuth 2.0 flow for public clients.
- **Plan**: The set of actions (unfollow, remove, etc.) to be applied to a user’s Spotify library.
- **Phase**: A discrete step in the apply process (e.g., unfollow, tracks, albums).
- **Label cleanup**: Removal of tracks/albums based on label metadata, not just artist.
- **State**: The persisted and in-memory representation of user progress and selections.
- **DX**: Developer Experience; scripts and tooling for contributors.

## Mission

- Help listeners align their Spotify libraries with public “No Music For Genocide” petitions.
- Offer a transparent, browser-only workflow: authenticate with Spotify, preview every change, then apply deliberately.

## Stack & Environment

- Single-page app built with Vite + TypeScript (strict mode) and vanilla DOM helpers in `src/lib/ui.ts`.
- No backend services; Spotify’s PKCE OAuth flow handles auth and tokens live in `localStorage` for the session.
- Styling via hand-rolled design tokens (`src/styles/tokens.css`) and a global stylesheet (`src/styles/global.css`).
- Tests run through Vitest (`npm run test`); type safety enforced with `npm run typecheck` (tsc `--noEmit`).

## App Flow

1. **Source (`#/app`)** – load the No Music For Genocide list or bring your own (paste/file/URL). Displays artist/label counts and metadata.
2. **Resolve (`#/resolve`)** – semi-automatic artist matching with `resolveArtists`; stores confirmed matches and skipped entries, preserving work between sessions via `loadState`/`updateState`.
3. **Preview (`#/preview`)** – assemble a plan with `buildPlan`, summarise affected follows, liked tracks, and saved albums. Options include strict primary artist matching, include albums, and label cleanup.
4. **Apply (`#/apply`)** – run the plan in three phases (`unfollow`, `tracks`, `albums`) through `runPlan`. Emits structured progress events for UI updates and rate-limit messaging.
5. **Report (`#/report`)** – export JSON/CSV summaries of the executed plan for auditing.

## Core Modules (quick map)

- [`src/main.ts`](./src/main.ts) – orchestrates state, routing, rendering, and user interactions.
- [`src/lib/planner.ts`](./src/lib/planner.ts) – builds plan data structures, enriches missing album metadata, and de-duplicates reasons.
- [`src/lib/apply.ts`](./src/lib/apply.ts) – batches Spotify API mutations (50 ids per call) with retry/backoff hooks.
- [`src/lib/spotify.ts`](./src/lib/spotify.ts) – wraps Spotify endpoints for follows, liked tracks, albums, and metadata hydration.
- [`src/lib/state.ts`](./src/lib/state.ts) – minimal localStorage persistence for user progress and historical operations.
- [`src/lib/report.ts`](./src/lib/report.ts) – JSON + CSV export helpers for the post-apply step.
- [`src/lib/i18n.ts`](./src/lib/i18n.ts) – en/ he locale tables, direction handling, and formatting helpers.

## UX Highlights (current state)

- **Artist Resolver**: Features incremental loading, "Following" badges for context, and sorting controls in both the preview grid and the full artist roster modal.
- **Apply View**: Provides detailed progress updates with an overall summary card and per-phase status blocks (Queued, In progress, Done, etc.), including retry and rate-limit feedback.
  - An overall progress card with percent + counts across all phases.
  - Per-phase blocks showing status (Queued / In progress / Done / Skipped / Needs attention), retry counts, and animated bars.
  - Visual badges (`buildPhaseBadge`) driven by `APPLY_PHASES` for consistency and accessibility (text-based, no icons).
- Rate limit feedback surfaces through `apply_phase_retries` text and `apply_status_wait` toast messaging.

## Label Cleanup UX

- Enabling “Include label cleanup” (`state.options.includeLabelCleanup`) adds an `enrich` stage and populates label-driven removals.
- Each affected track/album shows a label badge row built via `buildLabelReason`:
  - Compact “Label” pill + localized “Matches:” prefix.
  - Individual label chips in Spotify green for quick scanning.
- Artist reasons remain bold/accented in-line via `reason-artist`; labels now mirror the emphasis visually.

## Data & Caching Notes

- `state.planMeta` tracks before/after library totals (following, liked tracks, albums) to highlight impact.
- `recordOperation` keeps an audit trail (`state.ops`) with counts per run; useful for future undo tooling.
- `invalidateSpotifyCaches()` clears local caches post-apply to force fresh data on the next preview.
- All Spotify write operations observe rate-limit headers; `processPhase` passes retry signals back to the UI.

## Auth & Tokens

- PKCE flow kicks off with `beginAuthFlow`; tokens stored in `localStorage` under controlled keys.
- Scope requirements: `user-follow-*`, `user-library-*`. Insufficient scope triggers a reconnect warning toast.
- `handleAuthCallback` handles hash parsing and token exchange, returning to the app seamlessly.

## Testing & Tooling

- `npm run dev` for Vite dev server, `npm run build` for production bundle, `npm run preview` for static sanity checks.
- ESLint/Prettier via configured scripts; repository tracks formatting with `prettier.config.cjs`.
- Use `npm run typecheck` after significant TypeScript changes (ensures state/DOM helpers stay aligned).
- Bundle size analysis is available via `npm run build`, which generates a `dist/stats.html` report.

## Working Agreements & Ongoing Ideas

- Maintain this file as a living reference when we add features or clarify behaviours; summarise new UI/UX decisions (like apply progress and label badges) so future collaborators can ramp quickly.
- Document new translations whenever we add locale keys (see `src/lib/i18n.ts`).
- TODO backlog (high-level):
  - Consider playlist support toggle if playlist hygiene enters scope; keep public messaging focused on current functionality.
  - Track potential undo/export improvements tied to `state.ops` history.
  - Expand per-phase telemetry (batch counts, per-item breakdown) if we expose deeper analytics.

## 2025-10-06 Release Prep Session

- Added Husky + lint-staged enforcement (with `.editorconfig`) to standardise formatting before commits.
- Expanded Vitest coverage for planner (progress events + enrichment), resolver caching/skip flows, and apply phase batching.
- Introduced CI workflow (`.github/workflows/ci.yml`) to run lint/typecheck/test/build on pushes.
- Documented new DX scripts (`npm run check`, `format:check`, `lint:fix`) and HTTPS env options in README.
- Noted plan context snapshot helpers validated by tests.
- Upgraded ESLint toolchain to v9 with flat config (`eslint.config.js`) and aligned TypeScript-ESLint packages (non-type-checked presets for now).
- Added `TASKS.md` backlog for tracking deferred improvements (type-aware linting, bundle analysis, rate-limit review, etc.).
- Standardised artist card UI (shared avatar/name/source/follow badges) across resolve preview, plan summary, and roster/queue views.

_Last updated: apply progress/status overhaul, label badge styling, and release-readiness tooling/tests._
