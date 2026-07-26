# PAYAW 0.23.2 Deployment Guide

This guide deploys PAYAW for one GM and a configurable player table using:

- Cloudflare Pages for the static Vite frontend.
- Supabase for Postgres, Auth, Realtime, Storage, and the `campaign-command` Edge Function.
- Cloudflare Turnstile for optional but recommended anonymous-sign-in abuse protection.

No separate Node server, VPS, or paid database is required. PAYAW starts with six player slots, but the GM can select any count from 1 to 32 before publishing the hosted player views.

## 1. Expected cost and limits

The target is **₱0/month**. At the time of this release, Supabase Free includes 500 MB of database data, 1 GB of file storage, 5 GB of egress, 50,000 monthly active users, 200 peak Realtime connections, 2 million Realtime messages, and 500,000 Edge Function calls. A room of seven people is far below those limits. Free projects may pause after one week without activity, so open the project before game night if it has been idle. See the current [Supabase billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase) and [Supabase pricing page](https://supabase.com/pricing).

Cloudflare Pages serves static assets without metered request charges. The Free plan currently permits 500 builds per month, 20,000 files per site, and 25 MiB per static file. PAYAW does not use Pages Functions. See [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/).

Provider limits can change. Recheck those official pages before the first public deployment.

## 2. Accounts and local prerequisites

Create free accounts for Supabase, Cloudflare, and GitHub or GitLab. Install Node.js 20.19 or later and Git. The repository contains both `pnpm-lock.yaml` and a public `package-lock.json`; the commands below use npm for the least complicated Windows and Cloudflare setup.

From the PAYAW source folder:

```powershell
npm install
npm run check
npm run test:ms23
```

Do not run `test:engine`; it is not a PAYAW release gate.

## 3. Create the Supabase project

1. In Supabase, create one Free project and choose a nearby region.
2. Save the database password in a password manager. It is not a browser environment variable.
3. In the project Connect dialog, copy the Project URL, publishable key, and project reference.

Never copy a secret key, legacy service-role key, database password, or JWT secret into a `VITE_*` variable. Vite values are public by design.

## 4. Configure authentication

In Supabase Auth settings:

1. Enable email/password authentication. The GM signs in with a password and receives a permanent identity. Disable **Confirm email** if you want account creation to send no email.
2. Enable anonymous sign-ins. Players receive authenticated anonymous identities only after opening a GM-issued invitation.
3. Set the temporary Site URL to `http://localhost:5173`.
4. Add redirect URLs for `http://localhost:5173`, `http://127.0.0.1:5173`, and `http://localhost:4173`.

Anonymous Supabase users use the authenticated database role and therefore remain subject to PAYAW's RLS policies. Supabase recommends CAPTCHA protection because anonymous accounts otherwise can be abused; see [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous).

### Recommended Turnstile setup

1. In Cloudflare, open Turnstile and create a widget.
2. During local testing, allow `localhost`.
3. Copy the public site key into `VITE_TURNSTILE_SITE_KEY`.
4. In Supabase Auth CAPTCHA Protection, choose Cloudflare Turnstile and enter the Turnstile secret key there.
5. Do not store the Turnstile secret in PAYAW or Cloudflare Pages environment variables.

The frontend only receives the public site key. Supabase validates the challenge using the secret configured in its dashboard.

## 5. Deploy the database and Edge Function

PAYAW ships its backend as a repeatable migration under `supabase/migrations` and a function under `supabase/functions/campaign-command`.

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy campaign-command
```

Supabase recommends migrations for tracked schema deployment and `db push` for applying them to the linked project. See [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations). The Edge Function automatically receives server-side project secrets at runtime. Do not create a frontend service-role variable. See the [Supabase deployment guide](https://supabase.com/docs/guides/local-development/overview#deploy-your-project).

The migration creates:

- Campaign rooms, memberships, player slots, invitations, commands, events, acknowledgements, audit records, and an owner-only campaign checkpoint.
- RLS on every public PAYAW table.
- Hashed, expiring, single-use invitation codes.
- Recipient-specific player projection rows.
- Idempotency, revision, payload-size, capability, and rate-limit checks.
- Private Realtime authorization for `room:<campaign-id>:live`.
- Protected `payaw-player-assets` and `payaw-gm-assets` Storage buckets.
- Realtime publication for safe projections, commands, and safe events.
- Atomic authority/player snapshot publishing with revision-conflict detection.
- Event-only dice recording, atomic multi-recipient command finalization, changed-slot-only snapshot writes, hot-path indexes, and bounded command/event retention from `202607260010_netcode_write_reduction.sql`.

Supabase Postgres Changes honors table RLS and requires publication enrollment; see [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes). PAYAW also uses private Presence following the [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization) pattern.

## 6. Verify the Supabase backend

In Table Editor, confirm these tables exist and show RLS enabled:

- `campaign_rooms`
- `campaign_members`
- `campaign_authority`
- `campaign_player_slots`
- `campaign_invitations`
- `campaign_commands`
- `campaign_events`
- `campaign_client_acks`
- `campaign_audit_log`

In Storage, confirm both PAYAW buckets are private. In Edge Functions, confirm `campaign-command` is deployed and JWT verification is enabled. Do not add broad `authenticated using (true)` policies.

## 7. Test locally against Supabase

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```dotenv
VITE_PAYAW_NETCODE_ENABLED=true
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_TURNSTILE_SITE_KEY
```

Then run `npm run dev` and open the shown localhost address.

1. Open **CAMPAIGN → Players**.
2. In **Private campaign room**, enter the GM email and send the sign-in link.
3. Open that email link on the same browser.
4. Return to **CAMPAIGN → Players** and choose **Create / link room**.
5. Set **Player slots** to the table size you want and choose **Apply player count**.
6. Wait for **ROOM LIVE**. PAYAW now publishes the authority document and every player view automatically as one atomic snapshot.
7. Select Player 1 and create a single-use invitation.
8. Open the invitation in another browser profile or device and join.
9. Confirm the GM roster changes from OPEN to JOINED/LIVE.
10. Activate a scene or reveal information and confirm the player updates automatically. **Sync player views now** is an immediate recovery action, not a required normal step.
11. Send a message, roll party-visible dice, place a map ping, and create a journal entry from Player View.
12. Disconnect the player temporarily. Private journal and character edits should queue; shared messages and dice should refuse to run offline.

Each player needs a separate invitation. Invitations are bound to a selected slot, expire after seven days by default, and are single-use.

## 8. Put the source in GitHub

```powershell
git init
git add .
git commit -m "PAYAW Milestone 23"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

Before pushing, run `git status --short` and verify `.env.local` is not staged.

## 9. Deploy the frontend on Cloudflare Pages

1. Open Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select the PAYAW repository and production branch.
3. Use:
   - Framework preset: React (Vite) or Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: repository root
4. Add production environment variables:
   - `VITE_PAYAW_NETCODE_ENABLED=true`
   - `VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME`
   - `VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_TURNSTILE_SITE_KEY`
   - `NODE_VERSION=22`
5. Deploy.

Cloudflare documents `npm run build` and `dist` as the Vite configuration; see [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

PAYAW's `public/_headers` adds a no-referrer policy, frame protection, MIME protection, a restrictive permissions policy, and a CSP limited to PAYAW, Supabase, and Turnstile network targets. No-referrer prevents invitation tokens from being sent as referrer data.

## 10. Finish production URL configuration

After Cloudflare gives you a URL such as `https://payaw.pages.dev`:

1. Change the Supabase Auth Site URL to the Cloudflare URL.
2. Add the same URL to Redirect URLs.
3. If using a custom domain, add its exact HTTPS URL too.
4. Add the production hostname to the Turnstile widget.
5. Redeploy Cloudflare if a public environment value changed.

Test GM email/password sign-in again. A successful sign-in returns directly to the hosted GM workspace without an email redirect.

## 11. Game-night operating procedure

Before the session:

1. Open the Supabase project so an idle Free project can resume.
2. Open PAYAW and wait for **ROOM LIVE**.
3. Make final prep changes and confirm the room returns to **ROOM LIVE**. Automatic sync publishes the whole table together.
4. For a changed device or cleared browser data, use **Replace device** beside that player. Send the new single-use link and discard the old one.
5. Confirm the GM and every configured player slot appear in the roster.

During play, scene, map-policy, and reveal changes become recipient-specific projections automatically. Player commands are validated by RLS/RPC and the Edge Function. Party messages, party dice, shared journals, and map pings are copied only when the GM granted the relevant capability. A publish aborts and retries if a player changes data during synchronization, so player-owned work is not silently overwritten. Revision gaps cause a complete safe snapshot replacement, and duplicate submissions do not apply twice.

After the session, wait for **ROOM LIVE**, create a campaign checkpoint, and export the campaign from PAYAW. Keep important handouts in a separate local backup. Supabase Free does not include managed automatic database backups, so the PAYAW export remains the primary recovery copy.

## 12. Security checklist

- [ ] Only the Supabase URL and publishable key use `VITE_*` variables.
- [ ] No service-role key, secret key, database password, or Turnstile secret is in Git or Cloudflare Pages.
- [ ] Every PAYAW table shows RLS enabled.
- [ ] Both Storage buckets are private.
- [ ] PAYAW connects to a private Realtime channel.
- [ ] Anonymous sign-ins use Turnstile on an internet deployment.
- [ ] Each player receives a separate single-use slot invitation.
- [ ] Player developer tools never show `campaign_authority` or another player's slot.
- [ ] The GM keeps an offline campaign export.

## 13. Troubleshooting

**GM cannot create an account without an email:** disable **Confirm email** in Supabase Auth settings, then create the GM account again or sign in with an existing password account.

**Invite is invalid, expired, or claimed:** create a new link. If the player lost the claimed browser, use **Replace device** instead of only creating another invite.

**Player joins but sees no projection:** wait for room sync before creating the invitation and confirm the selected slot exists. Use **Sync player views now** if automatic sync reports an error.

**Player reloads while offline:** a previously joined browser opens its last validated safe projection and reconnects later. A brand-new browser cannot join offline because it has no authenticated session or safe cache.

**A local handout has no image in Player View:** confirm the campaign asset points to a current imported image (`payaw-asset:…`), the handout is linked to that asset, and Storage contains the uploaded file. PDFs/audio must currently use a secure HTTPS URL unless imported as a supported image.

**Realtime keeps reconnecting:** confirm the migration added PAYAW tables to `supabase_realtime`, private `realtime.messages` policies exist, and membership is not revoked.

**Commands remain queued:** confirm `campaign-command` is deployed with JWT verification. Review its logs without sharing access tokens or campaign payloads.

**Turnstile never enables Join:** confirm the site key allows the current hostname and its matching secret is configured in Supabase Auth CAPTCHA Protection.

**Free project is paused:** resume it in Supabase, wait for health checks, then reload PAYAW. The player client keeps its last safe projection while reconnecting.

**Cloudflare build fails:** confirm repository root, `npm run build`, `dist`, Node 22, and the required public environment values. See [Cloudflare Pages debugging](https://developers.cloudflare.com/pages/configuration/debugging-pages/).

## 14. Updating later

```powershell
npm install
npm run check
npm run test:ms23
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy campaign-command
git add .
git commit -m "Update PAYAW"
git push
```

Cloudflare rebuilds from Git. Supabase applies only migrations not already recorded. Keep schema changes in migration files; do not make untracked production-only table edits.

For the PAYAW 0.24 netcode optimization, deploy in this order: database migrations, `campaign-command`, then the frontend. The new function and frontend call RPCs introduced by `202607260010_netcode_write_reduction.sql`.
