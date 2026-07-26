# PAYAW Netcode Optimization

This pass targets the default room size of one GM and up to six players without changing the authority/projection security boundary.

## What changed

### Dice rolls are event-only

Before this pass, a party-visible roll could rewrite the roller's projection, copy the updated dice history into every other player projection, insert an event, and update the command multiple times. With six player slots, that was roughly ten application-table writes for one click, most of them large JSON updates.

Now the Edge Function generates the trusted roll and calls `record_campaign_dice_roll`. The database performs two writes in one transaction:

1. One already-applied `campaign_commands` row for idempotency and diagnostics.
2. One `campaign_events` row for party delivery and recent history.

Players and the GM merge the event into local dice history. Opening or reconnecting hydrates only the latest 30 dice events.

Legacy dice arrays are no longer retained when the GM republishes player projections. The first changed-slot publish after upgrading strips those duplicated histories from the affected slot rows while each connected client preserves its local event-backed history.

### Routine ACK writes are removed

Clients no longer write `campaign_client_acks` after every projection or dice event. Delivery recovery already uses durable projection revisions, cached recipient-safe state, event history, and a gap-triggered refresh. Removing ACK chatter prevents every server update from causing another write from every connected browser.

### GM publishing is coalesced

Automatic host publishing now:

- waits at least 2 seconds after a burst of local changes;
- keeps at least 5 seconds between completed automatic publishes;
- skips a publish when the authority and campaign-state fingerprint is unchanged;
- uses local Realtime-maintained slot revisions instead of rereading all slots before every normal publish;
- retries with a slot refresh only on an actual optimistic-concurrency conflict;
- updates local slot revisions from the RPC result instead of performing a five-resource room refresh afterward.

Manual **Sync now** remains immediate and forces a publish.

### Shared commands finalize in one transaction

Party messages, shared-journal changes, and map pings still materialize into the affected recipient-safe projections so reconnecting players see them. The Edge Function now reads the required slots once, computes their safe updates, and calls `finalize_campaign_projection_command` once. The RPC locks all expected revisions before writing anything, updates the affected slots, inserts one safe event, and resolves the command atomically.

This does not eliminate the necessary row writes for durable shared state, but it removes the former chain of one PostgREST update request per player plus separate event and command-status requests. Private commands also fetch only the caller's slot.

### Only changed player slots are written

`publish_campaign_snapshot_optimized` still writes the authority checkpoint, but compares each player-safe projection while ignoring generated `revision` and `generatedAt` fields. Unchanged slots keep their existing row and revision. Per-slot `projection.replaced` event inserts were removed because players already subscribe directly to their own slot row.

### History is bounded

When the GM opens a hosted room, the app makes one best-effort cleanup call per room per browser session. Defaults:

- delete campaign events older than 30 days;
- delete commands older than 90 days.

Campaign authority, player projections, members, portal credentials, and audit history are not removed.

## Database indexes

The migration adds indexes for:

- per-user command rate checks;
- recent command history and command retention;
- recent dice-event history;
- event retention.

## Deployment order

From the project root:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy campaign-command
npm run build
```

Then deploy the generated frontend as usual. The migration must reach the database before the new Edge Function or frontend calls the new RPCs.

## Expected impact at six players

- A dice roll falls from roughly ten application-table writes to two.
- A delivered event no longer causes up to seven client ACK writes.
- A routine GM autosync no longer inserts one event per player or performs a post-publish five-query refresh.
- Automatic snapshots no longer append an audit-log row for every autosave; the authority row already records its updater and timestamp.
- A non-dice party command uses one finalization RPC instead of a sequence of per-player REST updates and separate event/status calls.
- Changes unrelated to a player's safe projection no longer rewrite that player's large JSON slot row.

Exact database usage depends on campaign activity, payload size, Realtime reconnects, and Supabase's internal accounting, but the largest application-level write amplification paths are removed.
