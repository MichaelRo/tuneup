# TuneUp Market & Best-Practice Digest

_Last updated: 2025-10-06 · Owner: UX Research_

## Category Scan

- **Streaming library cleaners**: Soundiiz (playlist & library migration), Tune My Music, and Spotlistr offer bulk playlist exports/imports with OAuth scopes similar to ours. They emphasise reversible actions via snapshots and preview diffs before applying changes.
- **Activist-led petitions**: Projects like No Music For Apartheid and Justice at Spotify share boycott rosters but rely on manual action (spreadsheets, shareable lists). Opportunities lie in coupling activism context with actionable steps.
- **Account hygiene utilities**: Tools such as Jumbo Privacy and Mine focus on consent dashboards—highlighting progress gamification, educational tooltips, and staged confirmations for destructive actions.
- **Bulk moderation dashboards**: Enterprise SaaS (Linear, Intercom) showcase real-time progress, undo affordances, and saved filters that can inspire our resolve + dry-run flows.

## Third-Party Auth & Onboarding Best Practices

- **Spotify Authorization Code with PKCE** flow must foreground consent scope and reassure on data residency ([Spotify Authorization Guide – PKCE, 2023](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)).
- Progressive onboarding: allow exploration of the wizard pre-auth, but surface “connect” nudges at decision points ([Nielsen Norman Group – Progressive Disclosure in Onboarding, 2022](https://www.nngroup.com/articles/progressive-disclosure-onboarding/)).
- Provide **scope rationale** during consent and highlight ability to disconnect from Spotify account settings (GDPR/CCPA-aligned messaging echoed in Stripe and Slack OAuth UIs).

## Bulk Review / Approval UX

- Provide **batch context chips** (e.g., “15 artists pending review”) and allow scoped filters; Trello multi-select and GitHub review requests show that chunking reduces overwhelm.
- **Preview-first, apply-second** is the norm: Soundiiz, Notion bulk delete, and Gmail mass actions prompt confirmation with item counts and top examples.
- Introduce **inline undo** for micro-actions (skip artist) and **global undo/export** for macro actions—pattern borrowed from Google Photos bulk delete.
- **Progress communication**: Use stage badges plus textual percent and completed counts ([Material Design – Progress Indicators, 2023](https://m3.material.io/components/progress-indicators/overview)) and state when waits are due to rate limiting.

## Accessibility & Internationalization Insights

- Follow WCAG 2.2 AA: ensure focus order, visible focus indicators, and minimum contrast ratios ([WCAG 2.2, 2023](https://www.w3.org/TR/WCAG22/)).
- For data-heavy tables, use `<table>` semantics with caption/summary ([WAI-ARIA Authoring Practices 1.2](https://www.w3.org/TR/wai-aria-practices/)) or ensure list structures have appropriate ARIA roles.
- Support **RTL parity** beyond copy: mirror progress indicators and ensure iconography and stepper layout respect direction ([Apple HIG – Internationalization, 2023](https://developer.apple.com/design/human-interface-guidelines/foundations/internationalization/)).
- Provide language switch persistence per local storage and indicate translation completeness ([Mozilla Localization Playbook, 2022](https://mozilla-l10n.github.io/documentation/)).

## Privacy & Trust Signals

- Adopt transparency standards from 1Password and Proton: articulate “What runs locally”, “What’s stored”, and “How to undo” on onboarding screens.
- Provide link to open-source repo commit history and latest audit (GitHub release tag). Include toolchain checksums for dist builds (common in privacy-first browsers like Brave).
- Offer **data disposal instructions** (clear localStorage, revoke Spotify access) similar to Fitbit data export flows.

## Opportunity Areas for TuneUp

1. **Trust Layer**: Add consent-focused onboarding card summarising permissions, storage, and opt-out (currently missing in landing flow).
2. **Undo Safety Net**: Export exists, but consider session-level “restore from report” or highlight Spotify’s “Recently Played” as manual fallback.
3. **Resolution Guidance**: Provide heuristics/education on ambiguous artists (e.g., share Spotify popularity, follower count) to mirror Soundiiz confidence scoring.
4. **Community Context**: Surface petition provenance, version history, and changelog to reinforce authenticity and combat misinformation.
5. **Accessibility Enhancements**: Document keyboard flow for modals, ensure focus trapping, and add skip-to-content to align with WCAG.
6. **Internationalization**: Expand language coverage and translation quality checks; adopt pseudo-locale QA runs for truncation/overflow detection.

## References

- [Spotify Developer Docs – Authorization Guide (PKCE), 2023](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [W3C, Web Content Accessibility Guidelines (WCAG) 2.2, 2023](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices 1.2, 2023](https://www.w3.org/TR/wai-aria-practices/)
- [Nielsen Norman Group, “Progressive Disclosure in Onboarding”, 2022](https://www.nngroup.com/articles/progressive-disclosure-onboarding/)
- [Material Design, “Progress Indicators”, 2023](https://m3.material.io/components/progress-indicators/overview)
- [Apple Human Interface Guidelines, “Internationalization”, 2023](https://developer.apple.com/design/human-interface-guidelines/foundations/internationalization/)
- [Mozilla Localization Playbook, 2022](https://mozilla-l10n.github.io/documentation/)
- Soundiiz product tour; Tune My Music onboarding (accessed Q4 2025)
