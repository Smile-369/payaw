# PAYAW shared dice tray fix

## What changed

- Player dice history now labels every entry as `USERNAME rolled TOTAL`.
- The latest result in the player tray also includes the username.
- The GM Room Authority panel now has an **Open dice tray** button.
- The GM tray contains the same party-wide roll history and can roll into the same party channel.
- GM rolls are generated in the existing `campaign-command` Supabase Edge Function, copied into every player projection, and broadcast as `command.dice.roll` events.
- Dice history is loaded from `campaign_events`, with player-slot and command records used as fallback sources.
- Roll IDs are deduplicated, so the event, slot update, and command update do not create repeated history rows or banners.

## Deployment

No database migration is required.

Deploy the frontend, then redeploy the Edge Function:

```powershell
npx supabase functions deploy campaign-command
```

The deployed Edge Function is required for GM-originated rolls. Player-originated rolls continue to use the same function.

## Validation

- `npm run check` passed.
- `npm run test:ms22` passed.
- `npm run test:ms23` passed.
- Edge Function TypeScript syntax validation passed.
- The full Vite bundle could not be run in the Linux validation environment because the supplied dependencies do not include the Linux Rolldown native binding.
