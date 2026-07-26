# Player self-service credentials

Migration `202607230009_player_self_service_credentials.sql` lets an authenticated player change the username and/or password for their own campaign slot.

## Player flow

1. Sign in with the initial Campaign ID, username, and password from the GM.
2. Open **Account** in the Player View header or mobile **More** menu.
3. Enter the current password.
4. Change the username, password, or both.
5. PAYAW signs the player out and asks them to sign in again with the updated credentials.

Usernames are campaign-scoped, 3–24 characters, and may contain uppercase letters, numbers, underscores, and hyphens. Passwords must be 8–128 characters.

## Deploy

```powershell
npx supabase db push
```

Then deploy the updated frontend. No GM action is required after the migration.

The frontend preserves actual Supabase error codes/messages. It does not replace credential-update failures with assumed diagnoses.
