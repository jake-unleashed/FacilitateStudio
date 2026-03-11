# Private Beta Access Runbook

This runbook keeps editor testing simple: use the existing email/password auth flow, but make it invite-only and vendor-controlled.

## Default Environment Choice

- Preferred: a separate staging/demo Supabase project and staging frontend URL.
- Temporary fallback: the current environment, only if public signup is disabled and the tester group stays very small.
- Never ask customer testers to use personal email addresses while the app is still in MVP hardening.

## Auth Configuration

1. Disable public signup in the Supabase Auth dashboard for the beta environment.
2. Set `VITE_AUTH_DISABLE_SIGNUP=true` in the beta frontend environment.
3. Set `VITE_BETA_ACCESS_CONTACT` to the email or alias testers should use for help.
4. Deploy the beta frontend with those environment variables.

The app's closed-beta UI only changes the frontend experience. Supabase Auth settings must still be locked down separately so signup is truly disabled.

## Tester Account Provisioning

- Create one account per tester.
- Use simple fake addresses that work as login identifiers, such as `facilitate-tester-001@example.com`.
- Set a temporary password for each account.
- Record the mapping in a simple internal tracker with:
  - Tester name
  - Company
  - Assigned beta email
  - Date provisioned
  - Password reset date
  - Date revoked

## Naming Convention

- Format: `facilitate-tester-001@example.com`
- Examples:
  - `facilitate-tester-001@example.com`
  - `facilitate-tester-002@example.com`

Keep the numeric suffix zero-padded so the accounts sort naturally.

## Bulk Creation Script

Use the one-off script in this repo to create the initial tester accounts in bulk:

```bash
npm run beta:create-testers
```

Defaults:

- Creates 10 users
- Email pattern: `facilitate-tester-001@example.com` through `facilitate-tester-010@example.com`
- Password pattern: `FacilitateBeta-001!` through `FacilitateBeta-010!`
- Marks each account as confirmed so no inbox is required

Optional examples:

```bash
npm run beta:create-testers -- --dry-run
npm run beta:create-testers -- --count 20
npm run beta:create-testers -- --domain example.com
```

Required environment:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` or `VITE_SUPABASE_URL`

## Password Reset And Revocation

- Reset passwords manually rather than relying on tester-facing reset emails.
- Revoke access by deleting the tester account or rotating its password when the pilot ends.
- If a credential leak is suspected, rotate the password immediately and verify only the intended tester still has access.

## Pilot Launch Checklist

- Closed-beta flags are enabled in the frontend environment.
- Public signup is disabled in Supabase Auth.
- Tester accounts have been created and verified.
- Demo data/assets are present.
- Feedback channel is ready.
- A team owner is assigned for password resets and access changes.

## Tester Onboarding Template

Use this template when inviting a tester:

```text
Subject: Facilitate Studio private beta access

Hi <name>,

Your private beta editor account is ready.

Login URL: <beta-url>
Email: <beta-email>
Temporary password: <temporary-password>

Please use this account only for the pilot. If you need help or a password reset, reply to this message or contact <beta-contact>.

Suggested first tasks:
1. Sign in and confirm you can reach the editor.
2. Create or edit a project.
3. Upload a model or make a small change.
4. Share any bugs, confusion points, or rough edges you hit.

Thanks,
<sender-name>
```

## Initial Pilot Size

- Start with a very small cohort, ideally 3 to 5 testers.
- Expand only after the team is comfortable provisioning accounts, handling resets, and reviewing early feedback.
