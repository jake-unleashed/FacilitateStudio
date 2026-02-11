# ADR 0005: RLS-first security model (database enforces access)

## Status

Accepted (MVP)

## Context

This backend will be written and maintained by AI agents. Over time, mistakes will happen (missing auth checks, overly broad queries). We need a security model that fails safe.

## Decision

Use **Row Level Security (RLS)** in Postgres as the primary access control mechanism:

- All user-owned tables have RLS enabled.
- Policies enforce:
  - owners can read/write their own rows
  - public/published data is explicitly scoped (token-based) and read-only

The application code should assume RLS is always present and should not require “remembering to filter by owner” to be secure.

## Consequences

### Positive

- Even if application code is wrong, data access remains correct.
- Reduces “one bad endpoint leaks everything” risk.

### Negative / Tradeoffs

- Requires careful policy design and testing.
- Debugging can be trickier if RLS blocks queries unexpectedly.

### Follow-ups

- Add a small integration test that proves “user A cannot read user B’s project” at the DB/API layer.

