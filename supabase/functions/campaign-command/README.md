# campaign-command

This Edge Function is the server-side command boundary for Player View. It authenticates the caller and keeps the service-role key out of the browser.

## Optimized dice path

`dice.roll` is resolved securely inside the function, then recorded through `record_campaign_dice_roll`. The RPC atomically writes one already-applied command row and one party event row. It does not rewrite `campaign_player_slots.projection`, so a single roll no longer fans out into one large JSON update per connected player.

The event stores the resolved result in `campaign_events.safe_payload.diceRoll` for live GM/player banners and recent-history hydration. The command stores the same result in `campaign_commands.result.diceRoll` for idempotent retries and GM diagnostics.

## Other player commands

Non-dice commands still pass through the existing command validator. The Edge Function computes the affected recipient-safe projections and sends them once to `finalize_campaign_projection_command`. That RPC locks every expected revision, writes the affected slots, emits one safe event, and resolves the command in a single transaction. Shared messages, journal changes, and map pings therefore no longer issue one PostgREST update request per player.

Private character, journal, objective, and GM-message actions fetch only the caller's slot. Party-visible actions fetch the room's slots once, then finalize them with one RPC. The function never reads or returns `campaign_authority.campaign_document`.

## Deploy

Apply the database migrations before deploying this function:

```bash
npx supabase db push
npx supabase functions deploy campaign-command
```

The required optimization migration is `supabase/migrations/202607260010_netcode_write_reduction.sql`. Supabase provides the service-role key to the deployed function at runtime; never create a `VITE_` service-role environment variable.
