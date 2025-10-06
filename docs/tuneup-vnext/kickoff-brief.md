# TuneUp vNext Kickoff Brief

_Last updated: 2025-10-06_

## UX Exploration Priorities

- **Trust Hub / Consent Card**: Visual hierarchy for permissions, data residency messaging, and petition provenance badge.
- **Resolve Confidence UI**: Badge styles, side-by-side comparison layout, and keyboard-first workflow for queue review.
- **Plan Preview Diffing**: Interaction for grouping by reason, toggling strict modes, and inline exports without overwhelming screen.
- **Apply Progress & Restore**: Animation vs static updates, cancel/undo affordances, and messaging for rate-limit waits.
- **Accessibility Audit**: Modal patterns, focus traps, high-contrast palette, and RTL stress tests.

## Proposed Workshop Agenda (120 min)

1. **Context & Goals (15 min)** – PM recap of current state and success metrics; review [research digest highlights](./research-digest.md).
2. **Experience Mapping (30 min)** – UX leads walk through current flows (resolve → apply) using real data; capture pain points.
3. **Concept Sketching (25 min)** – Breakouts for trust hub and resolve queue improvements; reconvene with sketches.
4. **Technical Feasibility (20 min)** – Engineering walkthrough of dependency hotspots (auth, state persistence, Spotify rate limits).
5. **Accessibility & Intl Deep Dive (15 min)** – Identify audit checklist, pseudo-locale strategy, and testing responsibilities.
6. **Prioritization & Next Steps (15 min)** – Align on MVP slice vs stretch, owners, and prototype deadlines.

## Delivery Phasing

- **Quick Wins (Sprint 1-2)**
  - Consent copy update + revoke instructions on landing.
  - Focus indicators + skip link in shell.
  - Locale persistence and translation linting.
  - Resolve queue filters (UI scaffolding without confidence scores).
- **Core Initiatives (Sprint 3-6)**
  - Confidence scoring + badge UX (requires Spotify data enrichment).
  - Plan diffing & grouped preview.
  - Apply restore checkpoint + enhanced progress messaging.
  - Accessibility remediation + RTL polish.
- **Stretch Planning (Post-Sprint 6)**
  - Multi-list catalogue exploration.
  - Playlist hygiene proof-of-concept.
  - Community transparency & changelog surfacing.

## Collaboration Touchpoints

- Weekly triad sync (PM, UX, Engineering) to review prototype progress and unblock dependencies.
- Bi-weekly usability testing sessions (5 users each) focusing on resolve and apply stages.
- Accessibility review with external consultant before code freeze (owner: Accessibility partner + Core Eng).
- Localization QA loop with translators prior to release candidate (owner: Localization lead).
