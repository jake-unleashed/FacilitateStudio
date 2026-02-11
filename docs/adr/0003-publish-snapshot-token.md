# ADR 0003: Publishing = snapshot + share token (read-only)

## Status

Accepted (MVP)

## Context

Today publishing is local-only:

- `generatePublishURL()` produces `.../published?projectId=...` and depends on IndexedDB,
  so it doesn’t work cross-device.

We need a share link that:

- works for other people/devices
- is secure and simple
- avoids complicated permissions/teams

## Decision

Publishing creates (or updates) a **published snapshot** record that contains:

- `share_token` (unguessable secret)
- `snapshot` (JSONB of the project at publish time)

The published viewer loads by `share_token` and receives **read-only** data sufficient to render the simulation.

## Consequences

### Positive

- Links are stable and predictable; “what I shared” won’t change unexpectedly.
- Security is simpler: public access is to a snapshot, not to private user-owned projects.
- Fewer edge cases than “live publish.”

### Negative / Tradeoffs

- Changes after publishing require republishing to update the snapshot.

### Follow-ups

- Decide whether assets referenced by a snapshot must be copied to a public bucket or served via signed URLs.

