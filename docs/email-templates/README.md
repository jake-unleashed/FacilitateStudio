# Supabase Email Templates

These templates are for Supabase Auth email flows used by Facilitate Studio.

## Files

- `confirm-signup.html` - template for "Confirm signup" emails
- `reset-password.html` - template for "Reset password" emails

## How to apply in Supabase

1. Open your Supabase project dashboard.
2. Go to `Authentication` -> `Email Templates`.
3. Open `Confirm signup`, paste `confirm-signup.html`, and save.
4. Open `Reset password`, paste `reset-password.html`, and save.

## Required URL configuration checklist

Before testing emails, verify these settings in Supabase:

- Site URL is set to your production app URL.
  - Example: `https://facilitate-studio.vercel.app`
- Redirect URLs include:
  - `https://facilitate-studio.vercel.app/auth/confirm`
  - `http://localhost:5173/auth/confirm`
- Email templates are saved for both confirm signup and reset password.
- Password policy minimum length is at least 6 characters.

## Optional SMTP recommendation

For production deliverability and branding, configure a custom SMTP provider in:

- `Project Settings` -> `Auth` -> `SMTP Settings`

Without SMTP setup, Supabase uses the default sender.
