# Backend MVP Checklist (AI-Managed)

This is a **preflight** checklist to run before (and after) making backend-related changes. It exists to prevent accidental security regressions in an AI-written codebase.

## Architecture sanity checks

- [ ] **MVP scope is intact** (no teams/billing/realtime collab added by accident).
- [ ] **Publishing model is still snapshot-based** (unless intentionally changed via ADR).
- [ ] **Project storage stays simple** (project stored as JSON shape aligned with `src/types/project.ts`).

## Security invariants (must pass)

- [ ] **No secrets in browser** (no service-role keys, DB passwords, OpenAI keys shipped to client).
- [ ] **RLS is enabled** on all user-owned tables.
- [ ] **RLS policies enforce ownership** (no “any authenticated user can read” mistakes).
- [ ] **Public/published data is explicitly scoped** and read-only.
- [ ] **All API inputs are validated** (schema validation; reject unknown fields by default).
- [ ] **Rate limiting exists** on AI endpoints (per-user and per-IP fallback).
- [ ] **Timeouts exist** on AI calls (AbortController; fail closed).

## Storage / upload checks

- [ ] Uploads are **direct-to-storage** (avoid proxying big files through serverless).
- [ ] File limits enforced:
  - [ ] max size
  - [ ] allowlisted extensions/MIME
- [ ] Storage paths are user-scoped (e.g. `{userId}/{projectId}/...`).
- [ ] **Starter models** (`starter:*`) are treated as app-bundled/public and are **not** uploaded to private user storage.
- [ ] Published viewers only access:
  - [ ] published snapshots (preferred), or
  - [ ] explicitly public assets (never private-by-default assets)

## Publish/share checks

- [ ] Share token is **unguessable** (high entropy) and treated as secret.
- [ ] Published view is **read-only**.
- [ ] Published endpoint does **not** leak private user info (emails, user ids unless needed).

## Operational checks (minimal but real)

- [ ] Errors are captured (Sentry or equivalent) for backend endpoints.
- [ ] Logs include request ids and durations for AI endpoints.
- [ ] CI runs typecheck/lint/test for any backend-relevant code.
- [ ] At least one integration test covers:
  - [ ] “user can only read own project”
  - [ ] “published token retrieves snapshot”

## Decision hygiene (prevents drift)

- [ ] Any significant change has an ADR update in `docs/adr/`.
- [ ] The main plan stays current:
  - [ ] `.cursor/plans/backend_mvp_plan_9d2b1c3e.plan.md`
  - [ ] `.cursor/plans/backend_mvp_coordination_61a0f4d2.plan.md`
- [ ] Backend rules are still accurate:
  - [ ] `.cursor/rules/backend-security.mdc`

