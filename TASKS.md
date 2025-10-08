# TuneUp Task Backlog

## Recently completed

- [x] Added Husky + lint-staged enforcement for pre-commit formatting.
- [x] Upgraded ESLint toolchain to v9 with flat config and aligned TypeScript-ESLint packages.
- [x] Introduced CI workflow to run lint/typecheck/test/build on pushes.
- [x] Expanded Vitest coverage for planner, resolver, and apply flows.
- [x] Documented new DX scripts and HTTPS env options in README.
- [x] Reintroduced type-aware linting for stricter type checking.
- [x] Evaluated and improved DOM query safety to remove non-null assertions.
- [x] Added bundle-size monitoring with `rollup-plugin-visualizer`.
- [x] Reviewed and confirmed Spotify API rate-limit handling.
- [x] Explored and prepared for publishing via GitHub Pages deploy workflow.

Use this file to capture follow-up work that is out of scope for the current session but should remain visible. Triage items regularly and move completed tasks into commit messages or project notes as appropriate.

## Pending

_No pending tasks._

## Ideas / Nice-to-have

- [ ] **Low-hanging fruit**: Improve the type-safe `localStorage` wrapper in `src/lib/state.ts` by using a schema validation library like `zod` to ensure data integrity between sessions.
- [ ] Investigate automated accessibility snapshot testing (axe-core integration during Vitest runs).

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
