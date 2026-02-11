# ADR 0004: Asset storage uses direct-to-storage uploads + DB metadata

## Status

Accepted (MVP)

## Context

3D model files can be large (tens of MB). Proxying these through serverless functions:

- increases cost and latency
- increases failure rates/timeouts
- increases attack surface

We also need ownership and access controls for assets.

## Decision

Use object storage for binaries and Postgres for metadata:

- Upload model binaries **directly to storage** (browser → storage).
- Record an `assets` DB row referencing `storage_key`, size, file type, and optional metrics.

Storage path convention:

- `{userId}/{projectId}/{assetId}/{filename}`

## Consequences

### Positive

- Fast and reliable uploads; fewer server bottlenecks.
- Clear separation of “big binaries” vs “structured metadata.”

### Negative / Tradeoffs

- Requires careful storage bucket policies (or signed URLs) to avoid leaking private files.

### Follow-ups

- Define allowlisted extensions/MIME and maximum sizes in a single documented place.

