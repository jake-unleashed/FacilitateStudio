# ADR 0006: Starter models remain app-bundled (not user assets) in MVP backend

## Status

Accepted (MVP)

## Context

Facilitate Studio now includes “Starter models” that are:

- discovered at build time (Vite `import.meta.glob`)
- shipped with the app under `src/starterAssets/models/`
- seeded into local IndexedDB with deterministic IDs like `starter:<slug>`

As we add a backend, we need to decide whether starter models are:

- stored as normal user assets in object storage, or
- kept as app-bundled public assets

Constraints:

- MVP must stay **simple and elegant**
- security must stay robust (avoid complicated public/private asset policy interactions)

## Decision

For MVP backend:

- Starter models remain **bundled with the app**.
- Starter models are **not** stored in the user `assets` table.
- Projects may reference starter assets via IDs like `starter:<slug>`; clients resolve these to bundled URLs.

Cloud migration rule:

- When importing local projects to cloud, **do not upload starter assets**; only upload user assets.

## Consequences

### Positive

- Simplifies storage policies (no need to make starter assets public via storage buckets).
- Reduces backend complexity and avoids accidental privacy leaks.
- Published snapshots continue to work because starter models are served from the same app origin.

### Negative / Tradeoffs

- If starter library grows large, it increases app bundle/static asset size.
- If we later want server-managed starter libraries, we’ll need a new asset source concept.

### Follow-ups

- If bundle size becomes an issue, revisit and move starter models to a public storage bucket/CDN with versioning.

