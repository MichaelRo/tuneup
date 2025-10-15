# TuneUp (SPA Tool)

![Build Status](https://github.com/your-org/tuneup/actions/workflows/ci.yml/badge.svg)
![MIT License](https://img.shields.io/badge/license-MIT-green.svg)

# TuneUp (SPA Tool)

> For deeper architecture, onboarding, and glossary, see [`PROJECT_NOTES.md`](./PROJECT_NOTES.md).

## Glossary

- **PKCE**: Proof Key for Code Exchange, a secure OAuth 2.0 flow for public clients.
- **Plan**: The set of actions (unfollow, remove, etc.) to be applied to a user’s Spotify library.
- **Phase**: A discrete step in the apply process (e.g., unfollow, tracks, albums).
- **Label cleanup**: Removal of tracks/albums based on label metadata, not just artist.
- **State**: The persisted and in-memory representation of user progress and selections.
- **DX**: Developer Experience; scripts and tooling for contributors.

TuneUp helps you audit and clean your Spotify library in response to the public **No Music For Genocide** petition. The app runs entirely in the browser, uses Spotify’s PKCE OAuth flow, and never sends your data to a backend.

## Features

- **Zero backend**: static site powered by Vite + TypeScript.
- **PKCE OAuth**: refresh-aware token handling with rate-limit backoff.
- **Stepper workflow**: source → resolve → dry-run → apply → report.
- **List providers**: bundled No Music For Genocide list plus paste/file/URL inputs.
- **Internationalization**: English & Hebrew with RTL aware layout.
- **Progress visibility**: per-phase apply badges, retry counters, and accessible label chips.
- **Offline state**: local history cache for resolved IDs and prior operations.
- **Testing & linting**: Vitest unit tests, ESLint, Prettier, and strict TypeScript.

## Getting started

### 1. Prerequisites

- Node.js 18 or newer
- npm 9 or newer (comes with recent Node builds)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Spotify OAuth

1. Create a Spotify application at https://developer.spotify.com/dashboard .
2. Add your local dev URL (`http://localhost:5173`) and production URL (e.g. GitHub Pages) as redirect URIs.
3. Copy `.env.example` to `.env` and set your client id:
   ```env
   VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
   ```
4. (Optional) For HTTPS dev testing, place certificates in `certs/` and set `VITE_DEV_CERT` / `VITE_DEV_KEY` in `.env`.

### 4. Run the app locally

```bash
npm run dev
```

Visit `http://localhost:5173` and walk through the app. The PKCE flow completes entirely in the browser; tokens are cached in `localStorage` for reuse during the session.

### 5. Build for production

```bash
npm run build
npm run preview  # optional sanity check
```

The static output lives in `dist/` and can be deployed to GitHub Pages, Netlify, Cloudflare Pages, etc.

## Project Map & Conventions

### Directory Structure

```
src/
├── app/                    # Application routing and state
│   ├── config.ts          # Routes, constants, configuration
│   ├── routing.ts         # Hash-based router implementation
│   └── state.ts           # Global application state management
├── auth/                   # Authentication (PKCE OAuth)
│   ├── index.ts           # Main auth module (exports)
│   ├── pkce.ts            # PKCE utilities (challenge, verifier, state)
│   └── tokens.ts          # Token storage, refresh, expiry logic
├── spotify/               # Spotify API integration
│   ├── index.ts           # Main Spotify module (exports)
│   ├── client.ts          # Typed fetch wrapper (401 refresh + 429 backoff)
│   ├── api.ts             # Spotify API endpoints and data fetching
│   └── types.ts           # Spotify API response type definitions
├── ui/                    # UI components and utilities
│   ├── index.ts           # Main UI module (exports)
│   ├── core.ts            # DOM primitives (render, el, clear)
│   ├── modal.ts           # Modal system with focus trap
│   ├── toast.ts           # Toast notifications with ARIA
│   └── a11y.ts            # Accessibility utilities (focus trap, skip links)
├── lib/                   # Shared utilities
│   ├── i18n.ts            # Internationalization (English/Hebrew)
│   ├── cache.ts           # IndexedDB caching layer
│   ├── providers.ts       # Data source providers
│   ├── resolver.ts        # Artist name resolution
│   ├── planner.ts         # Plan generation logic
│   ├── apply.ts           # Plan execution engine
│   └── report.ts          # Export functionality (JSON/CSV)
├── views/                 # Page components
│   ├── shell.ts           # App shell (header, sidebar, navigation)
│   ├── landing.ts         # Landing page
│   ├── source.ts          # Source selection step
│   ├── resolve.ts         # Artist resolution step
│   ├── preview.ts         # Plan preview step
│   ├── apply.ts           # Plan execution step
│   ├── report.ts          # Results export step
│   └── components.ts      # Shared view components
├── types/                 # TypeScript type definitions
│   ├── index.ts           # Application domain types
│   └── ui.ts              # UI-specific types
└── styles/                # CSS stylesheets
    ├── global.css         # Global styles
    └── tokens.css         # Design tokens
```

### Import Conventions

- **Main modules**: Import from `auth/`, `spotify/`, `ui/` (re-exports everything)
- **Specific modules**: Import from `auth/pkce`, `spotify/client`, `ui/modal` for specific functionality
- **Legacy modules**: `lib/` contains utilities that haven't been refactored yet
- **Views**: Import from `views/` for page components

### Code Organization Principles

1. **Separation of Concerns**: Each directory has a single responsibility
2. **Thin Wrappers**: `spotify/client.ts` centralizes retry/refresh logic
3. **Accessibility First**: `ui/a11y.ts` provides consistent keyboard navigation
4. **Type Safety**: All Spotify API responses are typed in `spotify/types.ts`
5. **Error Boundaries**: Global error handling in `main.ts`

## Quality stack

- **TypeScript** (`strict`) across the entire codebase.
- **Vite** build tooling with modern ES2020 output.
- **Vitest** (+jsdom) unit tests for matching, resolver, planner, and apply flows.
- **ESLint + Prettier** with opinionated import ordering and formatting.
- **lint-staged + Husky** guard rails for formatting on commit.

### Useful scripts

| Command                | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | start local dev server                          |
| `npm run build`        | create production bundle                        |
| `npm run preview`      | preview built assets locally                    |
| `npm run lint`         | lint source files                               |
| `npm run lint:fix`     | autofix lint issues                             |
| `npm run format`       | run Prettier on supported files                 |
| `npm run format:check` | verify formatting without writing               |
| `npm run typecheck`    | verify TypeScript types                         |
| `npm run test`         | run Vitest unit tests                           |
| `npm run check`        | run lint, typecheck, and unit tests in sequence |

### Local DX

- Run `npm run prepare` after cloning to install Husky hooks (noop if no `.git` directory yet).
- Pre-commit hooks execute `lint-staged` to keep formatting and linting consistent.
- `.editorconfig` ensures consistent 2-space indentation across editors.

### Continuous integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck, test, and build on pushes and pull requests.

## Legal

- Not affiliated with Spotify.
- Provided “as is” under the MIT License.
- Artist list source: **No Music For Genocide** (public petition).
