# ADR 0001: Platform = Supabase (DB/Auth/Storage) + Vercel (Web + Functions)

## Status

Accepted (MVP)

## Context

Facilitate Studio is currently mostly frontend-only (IndexedDB persistence) with a small Vercel function for AI SOP step extraction. We want a backend that enables:

- user accounts
- cloud project storage
- cloud asset storage
- real share/publish links

Constraints:

- keep MVP **minimal and elegant**
- codebase is **AI-managed**, so security needs strong structural guardrails

## Decision

Use **Supabase** for:

- Auth
- Postgres database
- Storage buckets
- Row Level Security (RLS)

Use **Vercel** for:

- Hosting the frontend (existing)
- Serverless/Edge functions for privileged operations (e.g. OpenAI proxy)

## Consequences

### Positive

- Fewer moving parts and less custom backend code.
- RLS provides “secure-by-construction” access control — critical for an AI-managed codebase.
- Unified platform reduces configuration drift.

### Negative / Tradeoffs

- Some platform coupling to Supabase concepts (RLS, storage policies).
- If we later move off Supabase, migration effort increases.

### Follow-ups

- Document environment variables and which keys are safe client-side (anon) vs server-only (service role).

