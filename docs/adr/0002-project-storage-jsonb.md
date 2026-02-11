# ADR 0002: Store projects as a JSONB blob (aligned with frontend `Project` type)

## Status

Accepted (MVP)

## Context

The editor’s core data model is already defined in TypeScript:

- `Project` (`src/types/project.ts`) contains:
  - `objects: SceneObject[]`
  - `steps: SimStep[]`
  - metadata + thumbnail

We want cloud persistence with minimal complexity and minimal schema churn while the product is evolving quickly.

## Decision

Store each project in Postgres as:

- `projects.data (jsonb)`: the serialized project content (objects + steps + relevant metadata)
- plus a small set of query-friendly columns:
  - `id`, `owner_id`, `name`, `updated_at`, `thumbnail_url`, `deleted_at`

Do **not** decompose `objects` and `steps` into relational tables for MVP.

## Consequences

### Positive

- Very simple persistence layer; fewer endpoints and less ORM complexity.
- Backend stays aligned with frontend types (less impedance mismatch for AI agents).
- Avoids premature schema design while step types and scene objects evolve.

### Negative / Tradeoffs

- Harder to query “inside” the project (e.g. analytics) without additional indexing.
- Large JSON payloads may grow; we may need compression or partial updates later.

### Follow-ups

- Define size limits for `projects.data` and a plan for partial saves if needed.

