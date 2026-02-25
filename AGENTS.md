# Facilitate Studio

A browser-based 3D simulation/training editor built with React, TypeScript, Three.js, and Vite.

## Cursor Cloud specific instructions

### Services

| Service | Command | Port |
|---|---|---|
| Vite Dev Server | `npm run dev` | 3000 |

This is a purely client-side SPA with no backend, database, or external service dependencies.

### Key commands

All commands are defined in `package.json` scripts:

- **Dev server**: `npm run dev` (Vite on port 3000, bound to `0.0.0.0`)
- **Lint**: `npm run lint` (ESLint, zero warnings allowed)
- **Format check**: `npm run format:check` (Prettier)
- **Type check**: `npm run typecheck` (`tsc --noEmit`)
- **Tests**: `npm test` (Vitest with jsdom, 112 tests across 9 files)
- **Build**: `npm run build` (production build to `dist/`)

### Gotchas

- The `--legacy-peer-deps` flag is required when running `npm install` due to peer dependency conflicts (see `vercel.json` install command).
- There is no `package-lock.json` committed to the repository.
- The 3D canvas tests require mocked WebGL/Canvas contexts (configured in `src/test/setup.ts`).
