# Milestone 22 — Player View

Milestone 22 introduces a purpose-built player application for PAYAW. It is not the GM interface with controls hidden. It is a separate boot path that consumes only a safe, versioned `PlayerProjection`.

## Product outcome

A GM can configure a table of player identities (six by default, configurable in Milestone 23.1), grant party or individual knowledge, preview exactly what one player can see, and open a responsive Player View. The player experience includes:

- a revealed campaign map;
- current scene presentation;
- known people and places;
- clues, handouts, and objectives;
- a character page with explicitly editable fields;
- private and shared journals;
- delivered Messenger threads;
- a known-location travel estimate;
- a local dice tray;
- desktop, tablet, and phone navigation.

Unknown information is absent rather than obscured. The player application never receives GM notes, NPC secrets, schedules, hidden scene participants, future messages, event triggers, unrevealed assets, or raw GM identifiers.

## GM workflow

Open **CAMPAIGN → Players**.

1. Select one of the configured player profiles.
2. Set the player and character names.
3. Enable only the actions that player may perform.
4. Grant knowledge to the whole party or only that player.
5. Choose a knowledge level: Rumored, Discovered, Visited, or Investigated.
6. Review the structural secrecy check and projection counts.
7. Open the isolated preview or download the safe projection JSON.

Knowledge grants can be revoked. A player-specific grant does not appear for another player. **Reveal public campaign basics** is a convenience action for community anchors, point anchors, and explicitly player-visible campaign locations.

## Knowledge semantics

| Level | Player result |
|---|---|
| Unknown | Record is omitted. |
| Rumored | Alias/source text and an approximate map area may be shown. |
| Discovered | Public name and approved position may be shown. |
| Visited | Public location or NPC context is available. |
| Investigated | The richest explicitly safe detail is available. |

Audience can be `party` or `player:<id>`. Revoked and expired grants do not contribute to the projection.

## Player action boundary

Capabilities are checked by the command handler, not only by the UI. Supported capabilities are:

- character self-editing for GM-approved fields;
- private journal writing;
- party journal sharing;
- party or private messaging;
- dice rolls;
- map pings;
- objective proposals.

Removing every capability produces a genuinely read-only projection.

## Local milestone boundary

Milestone 22 uses local browser storage to hand a safe projection from the GM workspace to the local Player View. This is deliberate: authentication, Supabase persistence, invites, realtime synchronization, reconnection, and role enforcement belong to Milestone 23.

## Release gate

Run:

```bash
pnpm run check
pnpm run test:ms22
pnpm run build
```

The legacy `test:engine` suite is not a release gate and is not run.
