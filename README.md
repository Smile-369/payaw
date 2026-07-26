# PAYAW Batch Permissions + Objective Visibility Hotfix

Extract this ZIP into the PAYAW project root, beside `package.json`.
Do not extract it inside `src`.

## What changed

- The GM can apply permitted actions to either the current player or all active players.
- Check all / clear all shortcuts are included.
- Shared dice notifications remain visible for 4 seconds.
- A new `View Objectives tab` permission controls the entire Objectives feature.
- When that permission is off:
  - objective records are omitted from the player projection;
  - the desktop and mobile Objectives navigation buttons are hidden;
  - the home-page Objectives card is hidden;
  - player-created objective proposals are not retained in the visible projection.
- Enabling `Propose objectives` automatically enables `View Objectives tab`.
- Disabling `View Objectives tab` automatically disables `Propose objectives`.

## Install

From the directory containing `package.json`:

```powershell
pnpm run build
```

Redeploy the frontend. No Supabase migration or Edge Function deployment is required.

For an existing hosted campaign, open Campaign > Players, select the permission target,
set the permissions, click Save capabilities, then click `Sync 6 player views now` if the
room does not immediately republish.
