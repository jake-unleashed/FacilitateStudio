# Contributing to Facilitate Studio

## Quick start

1. Install Node.js 20+ and npm 9+.
2. Copy `.env.example` to `.env.local`.
3. Fill required values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_URL` (required in hosted/server environments, optional fallback in local dev)
4. Install dependencies: `npm ci`
5. Start development: `npm run dev`

This runs:
- Web app at `http://localhost:3000`
- Local AI/dev API at `http://localhost:8787` (proxied by Vite via `/api/*`)

## Required checks before opening a PR

Run all of the following locally:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Pull request expectations

- Keep changes scoped to one logical concern.
- Add or update tests for behavior changes.
- Update docs (`README.md`, migration notes, or feature docs) when behavior/config changes.
- Include a short test plan in the PR description.
- Never commit secrets (`.env.local`, API keys, service role tokens).

## Branching and commits

- Branch from `mvp` unless maintainers request otherwise.
- Use clear commit messages focused on intent.
- Prefer small, reviewable commits over large mixed changes.
