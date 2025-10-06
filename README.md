# TuneUp (SPA wizard)

![Build Status](https://github.com/your-org/tuneup/actions/workflows/ci.yml/badge.svg)
![MIT License](https://img.shields.io/badge/license-MIT-green.svg)

# TuneUp (SPA wizard)

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
- **Wizard workflow**: source → resolve → dry-run → apply → report.
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

Visit `http://localhost:5173` and walk through the wizard. The PKCE flow completes entirely in the browser; tokens are cached in `localStorage` for reuse during the session.

### 5. Build for production

```bash
npm run build
npm run preview  # optional sanity check
```

The static output lives in `dist/` and can be deployed to GitHub Pages, Netlify, Cloudflare Pages, etc.

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
