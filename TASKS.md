# TuneUp Task Backlog

## Recently completed

- [x] Added Husky + lint-staged enforcement for pre-commit formatting.
- [x] Upgraded ESLint toolchain to v9 with flat config and aligned TypeScript-ESLint packages.
- [x] Introduced CI workflow to run lint/typecheck/test/build on pushes.
- [x] Expanded Vitest coverage for planner, resolver, and apply flows.
- [x] Documented new DX scripts and HTTPS env options in README.

Use this file to capture follow-up work that is out of scope for the current session but should remain visible. Triage items regularly and move completed tasks into commit messages or project notes as appropriate.

## Pending

- [ ] Reintroduce type-aware linting (`typescript-eslint` recommendedTypeChecked / eslint-plugin security) once noise is addressed.
- [ ] Evaluate TypeScript `strict` options for DOM `querySelector` usages to trim redundant non-null assertions.
- [ ] Add bundle-size monitoring (e.g., `source-map-explorer` or Vite analyze) as part of release checklist.
- [ ] Review Spotify API rate-limit handling for exponential backoff tuning before GA.

## Ideas / Nice-to-have

- [ ] Prototype type-safe localStorage wrapper that encodes state schema with runtime validation.
- [ ] Investigate automated accessibility snapshot testing (axe-core integration during Vitest runs).
- [ ] Explore publishing GitHub Pages deploy workflow once CI stabilises.

## Engineering Ambitions & Values

TuneUp aims to be a model of modern, maintainable, and accessible open-source engineering. The following initiatives reflect our commitment to quality, inclusivity, and long-term sustainability:

- Extract large UI functions (e.g., landing, resolve, dryrun, apply) into dedicated modules for clarity and maintainability.
- Consider introducing a lightweight state management library or context/provider pattern as the app grows.
- Continuously improve accessibility: ensure modals/toasts are fully accessible (focus trap, ARIA roles, keyboard navigation), and add ARIA labels to all interactive elements.
- Expand internationalization: audit for any remaining hardcoded strings, and consider RTL/locale support.
- Increase unit and integration test coverage, especially for UI logic and async state transitions.
- Optimize performance: debounce/throttle expensive operations, and consider lazy-loading non-critical modules.
- Enhance developer documentation: add JSDoc to complex functions/types and document state shape and flows.
- Maintain strong TypeScript strictness: enable `noImplicitAny`, `strictNullChecks`, and review for further improvements.

These priorities should guide backlog grooming and technical decision-making. Contributions in these areas are especially welcome!
