# ADR 0006: Starter assets move to Supabase-backed public catalog

## Status

Accepted

## Context

Facilitate Studio supports two starter media types:

- starter 3D models in the Add panel
- starter 360 backgrounds in the Scene panel

The original model-only system was app-bundled and seeded into IndexedDB from files committed in Git.
That approach does not scale for content growth, runtime updates, or mixed asset types.

We need a single backend-driven system that:

- supports both starter models and starter backgrounds
- allows updating starter content without app redeploys
- preserves stable IDs for existing projects (`starter:*`)
- avoids mixing starter assets with private user assets

## Decision

Starter assets are now managed via Supabase as a public catalog:

- Add `public.starter_assets` table for metadata (ID, type, storage key, thumbnail URL, display data).
- Add public `starter-assets` storage bucket for files.
- Keep user uploads in `user-assets`; starter assets are never written to user asset rows.
- Resolve starter models by stable IDs like `starter:<slug>` using catalog entries.
- Resolve starter backgrounds by `starter-bg://<storage-path>` storage references.
- Published snapshots reuse starter public URLs and do not copy starter media into `published-assets`.

Migration policy:

- Remove Git-bundled starter model files and starter seeding code.
- Existing project references that already use `starter:*` remain valid through catalog lookup.

## Consequences

### Positive

- Unified architecture for model and background starter media.
- Starter library can be updated in Supabase without shipping app code.
- Removes large binary assets from repository history.
- Published and editor flows share the same public URL source for starter media.

### Negative / Tradeoffs

- Requires manual catalog curation in Supabase dashboard (or future admin tooling).
- Adds runtime dependency on catalog query availability.
- Starter assets are no longer guaranteed from app bundle offline.

### Follow-ups

- Add lightweight admin tooling for starter catalog management.
- Add richer starter metadata (tags, filtering, curated collections) when needed.
- Convert legacy FBX starter models to GLB as content is refreshed.

