# PAYAW Deployment Guide

PAYAW v1.0 uses a static Vite frontend, Supabase Auth/Postgres/Realtime/Storage, and the `campaign-command` Edge Function.

## 1. Supabase

Install the Supabase CLI, link the intended project, and apply every tracked migration in order:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy campaign-command
```

Do not edit production tables or policies manually. Put every schema change in a new migration.

The Edge Function uses server-side Supabase secrets. Never place `SUPABASE_SERVICE_ROLE_KEY` in a frontend environment variable.

## 2. Authentication

Enable email/password authentication and new-user signup. PAYAW creates isolated GM and player authentication sessions. Configure email confirmation according to the deployment’s account policy and verify the complete sign-in flow before launch.

If Turnstile is enabled:

1. Add every production and staging hostname to the Turnstile widget.
2. Set `VITE_TURNSTILE_SITE_KEY` for the frontend.
3. Configure the matching server-side secret for Supabase Auth.
4. Verify both GM and Player Portal sign-in on the deployed hostname.

## 3. Frontend environment

```text
VITE_PAYAW_NETCODE_ENABLED=true
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
VITE_TURNSTILE_SITE_KEY=
```

All `VITE_*` values are included in the browser bundle. Only use public browser credentials.

## 4. Build and publish

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Publish `dist/` to the static host. The included `_headers` file applies security headers, disables stale HTML caching, and gives hashed assets immutable caching.

Deploy backend changes in this order:

1. Database migrations
2. Edge Function
3. Frontend

This order keeps new frontend calls from reaching an older backend.

## 5. Staging verification

- Create a GM account and campaign room.
- Configure at least two player slots.
- Sign in from separate browser profiles.
- Confirm each player receives only their own projection.
- Exercise scene activation, reveals, messages, character edits, dice, map pings, reconnect, and credential reset.
- Confirm a disabled login loses live and cached access.
- Upload and retrieve a protected image.
- Verify Realtime reconnects after a temporary network interruption.
- Export and re-import a project and campaign backup.

## 6. Recovery and rollback

Before deploying:

- Export the active PAYAW project and campaign.
- Record the current frontend deployment and Edge Function version.
- Review the pending migrations.

Frontend and Edge Function deployments can be rolled back independently only when their database expectations remain compatible. Database migrations must be forward-compatible; use a new corrective migration instead of editing an applied migration.

Supabase plans without managed backups require an external backup policy. PAYAW exports are the portable application-level recovery copy.
