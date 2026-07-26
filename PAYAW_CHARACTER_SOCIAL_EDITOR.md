# PAYAW Player Character Social Editor

This patch changes only the Player Portal **Character** tab and its supporting netcode/projection path.

## What players can do

- Edit the complete PAYAW character sheet directly in Player View.
- Import the supplied `.xlsx` character sheet and continue editing it in-browser.
- Upload or replace a profile picture.
- Add up to six gallery images and remove them from the profile.
- Switch between party-member profile tabs and view their public character sheets.
- Edit public profile details, stats, MALAS, conditions, inventory, custom skills, and gear.
- Maintain hidden fields: personal warning/taboo, consequence, private wish, risk, private NPC ties, notes, debts, and freeform private comments.
- Prepare an Ultimate Skill and explicitly mark it unlocked when it should become visible to the party.

## Privacy boundary

Other players receive only a sanitized `partyCharacters` profile. It contains public profile details, images, stats, conditions, inventory, skills, gear, and an unlocked Ultimate Skill.

The following fields are never copied to another player's projection:

- Personal warning/taboo
- Consequence for breaking it
- Private wish
- Risk/trouble motivation
- Useful contact
- Person who worries about the character
- Place the character avoids
- Notes, debts, responsibilities, and freeform private comments

The GM remains the campaign authority and can access hosted campaign data.

## Database and storage behavior

- A complete sheet save uses one `character.sheet.update` command.
- The server produces one sanitized party-profile delta and updates all affected player slots through the existing atomic finalization RPC.
- Images are stored in the private `payaw-player-assets` Supabase Storage bucket, not embedded as base64 in the database.
- Each player can upload/update/delete only inside:
  `<campaign UUID>/<their auth UUID>/character/`
- Campaign members can view images through short-lived signed URLs.
- Signed URL cache entries refresh before their one-hour expiry.

## Installation

Extract this patch **beside `package.json`**. Do not extract it inside `src`.

Deploy in this order:

```powershell
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy campaign-command
pnpm install --frozen-lockfile
pnpm run build
```

Then redeploy the frontend and hard-refresh the Player Portal once.

## Validation

Run:

```powershell
pnpm run check
pnpm run test:character
pnpm run test:ms22
pnpm run test:ms23
```

Validated in the supplied patch:

- Strict TypeScript: passed
- Character privacy/social behavior test: passed
- Milestone 22 suite: passed
- Milestone 23 suite: passed
- Dependency-independent static QA build: passed

The container could not execute the normal Vite production bundle because the available copied dependencies contained a Windows-native Rolldown binding. A clean `pnpm install --frozen-lockfile` on Windows or Cloudflare installs the correct native package.
