# PAYAW

PAYAW is a browser-based campaign studio for generating a Philippine-inspired region, authoring its people and places, preparing a campaign, and running private player rooms.

The GM application has two workspaces:

- **WORLD** generates and edits the setting.
- **CAMPAIGN** prepares scenes, reveals, messages, sessions, and player access.

Players use the separate `?view=player` portal. The player route receives a recipient-specific projection and never loads the GM authority document.

## Requirements

- Node.js 20.19 or newer
- pnpm 11
- A modern desktop browser for the GM studio
- A Supabase project for hosted rooms and persistent player accounts
- Cloudflare Turnstile is optional

The GM studio is designed for desktop and tablet widths. The Player Portal is responsive for phones.

## Local setup

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Open `http://localhost:5173/` for the GM studio or `http://localhost:5173/?view=player` for the Player Portal.

The application can run locally without netcode. To enable hosted rooms, configure the public values in `.env.local`:

```text
VITE_PAYAW_NETCODE_ENABLED=true
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
VITE_TURNSTILE_SITE_KEY=
```

Never expose a Supabase service-role key through a `VITE_*` variable.

## Quality commands

```powershell
pnpm check
pnpm build
pnpm test
```

`pnpm test` runs the release regression suites for the engine, campaign workspace, UI shell, hosted player boundary, character privacy, and editor persistence.

## Typical workflow

1. Generate or open a world in **WORLD**.
2. Author communities, anchors, story sites, NPCs, locations, and map presentation.
3. Save a project JSON backup.
4. Switch to **CAMPAIGN** and prepare scenes, reveals, messages, and sessions.
5. Configure player slots and inspect each safe Player View.
6. For hosted play, sign in as the GM, create or load a room, synchronize player views, and create player credentials.
7. Keep regular project and campaign exports outside the browser.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [High-level design and architecture](docs/ARCHITECTURE.md)
- [Release QA](docs/QA.md)
- [Changelog](CHANGELOG.md)

## Persistence and backups

Local editor preferences and recovery metadata use browser storage. Imported image binaries use IndexedDB. Hosted room authority and recipient projections use Supabase.

Browser storage is not a durable backup. Before a session and after material changes, export the compact PAYAW World JSON plus any important NPC or NPC-group JSON files. Hosted deployments should also follow the backup and recovery checklist in the deployment guide.

## Repository layout

```text
src/                 GM, Player, engine, campaign, and netcode source
supabase/migrations/ Database schema, RLS, and RPC migrations
supabase/functions/  Privileged campaign-command Edge Function
tests/               Behavioral regression suites
scripts/             Build and test runners
docs/                Current user, deployment, architecture, and QA guides
template/            Character-sheet import template
```

PAYAW v1.0.0
