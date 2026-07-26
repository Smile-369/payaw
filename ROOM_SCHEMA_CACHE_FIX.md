# PAYAW Room / Player Portal Schema Cache Fix

## Cause

The GM frontend treated room refresh as one all-or-nothing operation. After a room was created it requested roster, slots, commands, and the new `list_player_portal_logins` RPC in one `Promise.all`. If Supabase PostgREST had not loaded the newest player-portal RPC into its schema cache, that one missing RPC made the entire Create/Link Room action appear to fail even though the room could already exist.

## Fix

- `create_campaign_room` is recreated as an idempotent create-or-link RPC.
- All persistent player-portal RPCs are recreated.
- Migration 007 explicitly sends `pg_notify('pgrst', 'reload schema')`.
- Core room data now loads independently from the player-portal login list.
- A stale portal schema cache no longer destroys the successful room result.
- The UI now reports a clear migration/cache message instead of the raw PostgREST error.

## Deploy

Copy this file to `supabase/migrations/`:

`202607230007_repair_room_portal_schema_cache.sql`

Then run:

```powershell
npx supabase db push
```

If CLI migration history is still blocking pushes, paste the migration into **Supabase Dashboard → SQL Editor** and run it once. Wait around five seconds, then reload PAYAW. Keep the SQL file locally so the repository still records the database change.
