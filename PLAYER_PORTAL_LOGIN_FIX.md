# PAYAW 0.24.0 — Persistent Player Portal

## What changed

Players no longer receive single-use invitation URLs. Every player uses the same permanent portal URL:

```text
https://YOUR-PAYAW-SITE/?view=player
```

The GM creates one persistent login ID and password for each active player slot. The browser stores that player's Supabase session and reopens the same Player View after refreshes or later visits. Credentials remain valid until the GM selects **Reset login** or **Disable**.

The old invitation records are revoked by the migration, and the invitation creation/claim RPCs are no longer executable from the client.

## Supabase deployment

Copy this migration into your repository if it is not already present:

```text
supabase/migrations/202607230006_player_portal_login.sql
```

Then run from the project root:

```powershell
npx supabase migration list
npx supabase db push
```

The local and remote histories must already agree through migration `202607230005`.

## Required Auth settings

In **Supabase Dashboard → Authentication → Providers → Email**:

- Email provider: enabled
- Allow new users to sign up: enabled
- Confirm email: disabled

The portal creates stable password-auth accounts behind the scenes. It does not send email or ask players for an email address. Anonymous sign-ins are no longer required and may be disabled.

## GM workflow

1. Sign in as the GM and create/link the campaign room.
2. Press **Sync player views now** so all active player slots exist remotely.
3. Select a player under **Player portal login**.
4. Press **Create / reset login**.
5. Press **Copy credentials** and send the portal URL, login ID, and password to that player.

The password is displayed only when credentials are created or reset. Resetting credentials invalidates the previous account assignment and generates a new login ID and password.

## Player workflow

1. Open the permanent Player Portal URL.
2. Enter the GM-provided login ID and password.
3. The same browser reopens that player account automatically until **Sign out** is used or the GM resets/disables the login.

## Generated map behavior

Player View no longer receives or renders a baked map PNG. It receives the public world seed, generator version, generation options, and public overrides, then generates the base map locally through the vegetation stage. Story points, NPCs, scenes, and other campaign information still arrive only through GM-controlled projections.

Migration `202607230006` also strips historical `baseImageDataUrl` fields from hosted player projections. The Player App clears the canvas before rendering so old loading/image text cannot remain visible underneath the generated map.
