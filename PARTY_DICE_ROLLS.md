# Party-wide dice rolls

PAYAW now treats every player dice roll as a party event.

## Result

When a player rolls, every connected screen receives a large temporary announcement:

```text
USERNAME rolled 17
```

The detail line shows the notation and individual dice values. The same event is visible to:

- the player who rolled;
- every other connected player in the campaign; and
- the GM.

The player dice tray also keeps the shared roll history with the roller username.

## Delivery model

The `campaign-command` Edge Function remains authoritative for the random result. It:

1. validates the player's command and `dice.roll` capability;
2. rolls using Web Crypto on the server;
3. forces `visibility: party` regardless of an older client's requested visibility;
4. stores the result in the rolling player's projection;
5. copies the result into the other player projections for shared history;
6. inserts a party-safe `campaign_events` record containing the resolved roll; and
7. writes the resolved roll into the GM-visible command result.

Player and GM Realtime subscriptions listen for the party event. Projection and command updates remain as deduplicated fallbacks, so a banner can still appear if one delivery path arrives before another.

## Deployment

No database migration is required because `campaign_events`, its party RLS policy, and Realtime publication already exist in Milestone 23.

Deploy the updated frontend, then redeploy the Edge Function from the project root:

```powershell
npx supabase functions deploy campaign-command
```

The Supabase project must already be linked. The function uses `verify_jwt = true` from `supabase/config.toml`.

## Files changed

- `src/netcode/DiceRollBanner.ts`
- `src/netcode/GmNetcodePanel.ts`
- `src/netcode/NetcodeTypes.ts`
- `src/netcode/NetworkPlayerBootstrap.ts`
- `src/netcode/PlayerNetworkSession.ts`
- `src/netcode/SupabaseGateway.ts`
- `src/player/PlayerApp.ts`
- `src/player/PlayerCommands.ts`
- `src/player/PlayerProjection.ts`
- `supabase/functions/campaign-command/index.ts`
- `scripts/run-ms22-tests.mjs`
- `tests/Milestone22Test.ts`
- `tests/Milestone23Test.ts`
