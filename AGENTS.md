# Facilitate Studio

A browser-based 3D simulation/training editor built with React, TypeScript, Three.js, and Vite.

## Cursor Cloud specific instructions

### Branch notes

The `main` branch contains a minimal editor-only SPA. The `mvp` branch contains the full product with authentication, guided workflow, preview, and publishing.

### Services (mvp branch)

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite Dev Server + API | `npm run dev` | 3000 (web), 8787 (API) | Uses `concurrently` to run both |
| Vite Dev Server only | `npm run dev:web` | 3000 | Frontend only |
| API Server only | `npm run dev:api` | 8787 | Express server for SOP extraction |

### Key commands

All commands are defined in `package.json` scripts. On the mvp branch:

- **Dev server**: `npm run dev` (starts both web + API concurrently)
- **Lint**: `npm run lint` (ESLint + typography check)
- **Format check**: `npm run format:check` (Prettier)
- **Type check**: `npm run typecheck` (`tsc --noEmit`)
- **Tests**: `npm test` (Vitest with jsdom)
- **Build**: `npm run build` (`tsc && vite build`)

### Environment variables (mvp branch)

Required (must be in `.env.local`):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key

Optional:
- `OPENAI_API_KEY` — for SOP upload AI extraction
- `SUPABASE_URL` — server-side Supabase URL (falls back to `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase key

Copy `.env.example` to `.env.local` and fill in values. The app validates env vars at startup via `src/env.ts` (Zod schema).

### Gotchas

- The `--legacy-peer-deps` flag is required when running `npm install` due to peer dependency conflicts.
- There is no `package-lock.json` committed to the repository.
- The 3D canvas tests require mocked WebGL/Canvas contexts (configured in `src/test/setup.ts`).
- On the mvp branch, `@testing-library/dom` may need to be installed separately (`npm install --legacy-peer-deps @testing-library/dom`) as it's a transitive dependency that can be missing.
- If port 3000 is already in use, Vite auto-switches to 3001. Kill old processes on port 3000 before restarting.
- The mvp branch requires Supabase auth — all protected routes redirect to `/auth`. A test account is needed to access the app beyond the login page. You can auto-confirm a new signup using the Supabase admin API with `SUPABASE_SERVICE_ROLE_KEY`.
- The guided workflow has 6 phases: welcome → step-creation → model-upload → model-positioning → step-configuration → finish (preview + publish).
- To create `.env.local` from environment secrets: populate it with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL` (same as `VITE_SUPABASE_URL`), and `SUPABASE_SERVICE_ROLE_KEY`.
