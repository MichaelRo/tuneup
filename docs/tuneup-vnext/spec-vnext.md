# TuneUp Spec vNext

_Last updated: 2025-10-06 · Owner: Core Eng + Product_

## Purpose & Goals

- Strengthen user trust and comprehension of the Spotify cleanup tool while preserving the browser-only promise.
- Reduce friction in artist resolution and plan review, especially for large libraries and multilingual audiences.
- Increase completion rate from dry-run to apply by providing stronger safety nets and transparency.

### Success Metrics (Target within 2 releases)

- ≥70% of authenticated sessions reach plan preview; ≥55% progress to successful apply (instrument via `analytics.plan_preview_viewed` and `analytics.plan_apply_completed`).
- ≥90% of users acknowledge permission summary before connecting Spotify (track `ui.consent_summary_opened` prior to auth event).
- <5% of apply runs abort due to unhandled errors (excluding user cancellation) measured by `apply_flow.result` telemetry.
- ≥2 new locales shipped with parity QA and ≥95% UI strings covered by translation tests (`i18n.translation_coverage` build check).

## Prioritized Feature Set

### Core

1. **Consent & Trust Hub**: Pre-auth screen summarising scopes, data storage, revoke instructions, and latest petition version.
2. **Guided Resolve Enhancements**: Confidence badges (followers, popularity) and quick filters (ambiguous, skipped, matched) with keyboard flows.
3. **Plan Preview Enhancements**: Grouping by reason (artist vs label), diff summary vs previous plan, and inline export of filtered subsets.
4. **Apply Safeguards**: In-session restore checkpoint (rebuild plan from last report) and richer rate-limit messaging with ETA + retry count.
5. **Accessibility Baseline**: Focus management, skip links, high-contrast theme token set, and semantic structures for plan/report lists.
6. **Intl Foundations**: Locale persistence, pseudo-locale QA harness, and translation lint (missing keys at build time).

### Stretch

1. Multi-list catalogue (browse petitions, tag filters, auto-updates).
2. Playlist hygiene (detected references to petitioned artists in user playlists with manual review queue).
3. Community transparency tab (changelog, data provenance, audit log export).
4. Shareable plan summary link (privacy-safe, client-side generated hash payload).

## User Journeys (Annotated)

1. **Explore & Connect**
   - User lands, reviews mission + trust hub, toggles locale, initiates Spotify connect.
   - Success = scopes understood, optional skip to tool allowed.
2. **Source & Validate List**
   - Select curated roster or import custom data; see counts, version, provenance, validation warnings.
   - Success = list loaded with deduplication, validation status shown, CTA to resolve enabled.
3. **Resolve Artists**
   - Auto-scan runs; ambiguous entries queue for manual review with confidence signals and ability to batch skip.
   - Success = 95% of entries resolved/explicitly skipped; user aware of remaining gaps.
4. **Preview Plan**
   - Plan builder fetches library, surfaces summary (counts, reason groups, net impact) and allows toggling strict rules.
   - Success = user exports optional snapshot, acknowledges irreversible action modal.
5. **Apply & Confirm**
   - Apply screen shows staged progress, handles rate-limits gracefully, and offers cancel/undo guidance.
   - Success = plan complete, report auto-generated, restore instructions surfaced.
6. **Report & Follow-up**
   - User downloads JSON/CSV, sees petition updates, and receives recommendation to clear cache/log out if desired.

## UX Requirements by Step

### Trust & Landing

- Add consent card with explicit list of Spotify permissions, storage scope, and “How to revoke” link.
- Display latest petition metadata (version, last updated) with CTA to view changelog.
- Provide skip-to-tool link for users already authenticated.

### Source

- Validate imports (CSV/JSON/plain text) with real-time feedback on errors or unsupported formats.
- Show dedupe summary (number of removed duplicates) and highlight newly added entries when list refreshes.
- Persist last-used list and locale across sessions.

### Resolve

- Introduce quick filters (All / Needs review / Skipped / Resolved).
- Confidence badge: followers + popularity using Spotify data; color-coded but also textual for accessibility.
- Provide keyboard shortcuts (e.g., `Enter` confirm, `S` skip) and announce via tooltip.
- Add “Resolve later” queue that preserves position and reminds user before apply.

### Dry-Run

- Display reason groups with collapsible sections (Artists vs Labels) and top offenders.
- Show comparison to previous plan (if any) with delta counts and timestamp.
- Add inline export buttons (selected rows → CSV/JSON) for manual audits.
- Warn if tokens near expiry and offer refresh before initiating dry-run.

### Apply

- Expand progress card with ETA based on batch count and rate-limit hint.
- Provide cancel option that pauses after current batch and prompts to export partial report.
- Offer “Restore last plan” button when apply completes, using cached evidence + totals.
- Toast messaging should include retry attempt counts and recommended wait actions.

### Report

- Automatically trigger report download + display success panel summarising impact.
- Provide step-by-step instructions to revoke access, clear local storage, and submit feedback.
- Highlight petition update feed or subscription (stretch: email export).

## Accessibility & Internationalization Mandates

- WCAG 2.2 AA compliance: focus indicators, skip links, keyboard navigation for modals/steppers.
- Semantic HTML for lists/tables; supply screen-reader only summaries for plan counts.
- Locale persistence via `localStorage`; pseudo-locale (`qps-ploc`) build for QA.
- Bidi support: ensure layout mirrors (stepper, progress bars) and numbers localize via `Intl.NumberFormat`.
- Provide alt text for imagery (artist avatars) and ensure color-only cues have textual equivalents.

## Data & Technical Considerations

- Maintain browser-only constraint: no new server dependencies; use `localStorage`/IndexedDB for new checkpoints (investigate `idb-keyval`).
- Instrument non-PII telemetry (completion events, error codes) via privacy-safe analytics (stretch: self-hosted, optional).
- Enhance caching strategy to avoid redundant Spotify calls (reuse plan context when plan options unchanged within TTL).
- Implement migration layer for persistent state (version stamping for future schema changes).
- Add automated tests for resolver confidence scoring, plan diffing, and apply cancel flows (Vitest + msw mocks; align with `README.md#testing` ownership: Core Eng).

## Risks, Assumptions, Open Decisions

- **Risk**: Spotify API rate limits or scope changes could break apply flow; need contingency messaging and detection of permission revocation.
- **Risk**: Local storage quotas may be exceeded for large libraries; consider IndexedDB fallback.
- **Assumption**: Petition roster remains manageable (<10k entries). Need plan for incremental loading if size grows.
- **Assumption**: Users trust browser-only approach; must reinforce with transparency copy.
- **Open**: Final interaction for “Restore last plan” (automatic vs manual selection).
- **Open**: Whether to gate stretch features (playlist hygiene) behind experimental toggle.
- **Open**: Governance for curated list updates (automatic fetch cadence, verification authority).
