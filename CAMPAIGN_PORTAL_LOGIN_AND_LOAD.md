# Campaign-scoped Player Portal and GM Restore

## Player Portal

Open the permanent portal URL:

```text
https://YOUR-PAYAW-SITE/?view=player
```

The portal now always opens the hosted login screen when Supabase hosting is configured. Players enter:

1. Campaign ID — the hosted room UUID shown in the GM panel.
2. Username — the 12-character username generated for that player slot.
3. Password — generated when the GM creates or resets the player login.

The browser stores the selected campaign and player auth session. Refreshing or reopening the portal restores the same player session until the player signs out or the GM resets/disables the login.

Migration `202607230008_campaign_scoped_player_portal.sql` changes the login RPCs so the Campaign ID is verified by the backend. Deploy the migration and frontend together.

## GM restore

After GM email/password sign-in, the Room authority panel now contains:

- Campaign ID
- Load campaign
- Create / link room
- Sync player views now

Paste the hosted room UUID and press **Load campaign**. PAYAW loads `campaign_authority.campaign_document`, restores the world seed and compact generation recipe, regenerates the GM world, then restores campaign and player-view state.

Older authority snapshots that predate the compact world recipe can still restore campaign and player state, but retain the currently loaded local map. After deploying this patch, press **Sync player views now** once to replace the old authority snapshot with the full compact hosted state.

## Credential copy format

The GM copy button now copies:

```text
PAYAW Player Portal
https://YOUR-PAYAW-SITE/?view=player
Campaign ID: <room UUID>
Username: <player username>
Password: <player password>
```

## Validation

- `npm run check` passes.
- `npm run test:ms23` passes.
- The Vite bundle could not be produced in the Linux validation workspace because the uploaded dependency tree lacks the Linux Rolldown native binding. A clean dependency install on Windows or Cloudflare will install the correct optional binary.
