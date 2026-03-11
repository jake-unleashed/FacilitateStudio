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
   - Optional private beta flags:
     - `VITE_AUTH_DISABLE_SIGNUP=true` for invite-only pilots
     - `VITE_BETA_ACCESS_CONTACT` to show the beta support contact on the sign-in screen
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

## Private beta auth

- Prefer a separate staging/demo environment for customer editor pilots.
- Disable public signup in the Supabase Auth dashboard before enabling `VITE_AUTH_DISABLE_SIGNUP=true`.
- Provision one vendor-controlled tester account per person rather than sharing credentials.
- Keep the provisioning/reset workflow documented in `docs/private-beta-access.md`.

## Branching and commits

- Branch from `mvp` unless maintainers request otherwise.
- Use clear commit messages focused on intent.
- Prefer small, reviewable commits over large mixed changes.
