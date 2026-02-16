# Security Policy

## Reporting a vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately to the maintainers with:
- A clear description of the issue
- Reproduction steps or proof of concept
- Potential impact
- Suggested remediation (if known)

If an internal/private channel exists for this repo, use that channel first. Otherwise, contact the project maintainers directly.

## Response expectations

Maintainers will:
1. Acknowledge receipt as quickly as possible
2. Validate and triage severity
3. Coordinate a fix and release timeline
4. Credit the reporter when appropriate (if desired)

## Sensitive data handling reminders

- Never commit secrets (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, tokens, private keys).
- Keep secrets in `.env.local` for local development and platform secret stores in production.
- Avoid logging raw document text or user-sensitive payloads in production logs.
