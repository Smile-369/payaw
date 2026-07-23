# Milestone 22 Architecture

## Trust boundary

```text
GM campaign + world + NPC authoring
                 │
                 ▼
       ProjectionService
       knowledge + audience checks
                 │
                 ▼
       PlayerProjection v1
       safe IDs and safe fields only
                 │
                 ▼
          PlayerApp
```

`src/bootstrap.ts` checks `?view=player` before importing the GM application. On the player route, it imports only the player stylesheet and `PlayerApp`. `PlayerApp` removes the static GM DOM outside `#app` before rendering or displaying a safe projection error.

## Projection rules

`ProjectionService` is the only supported place for turning authoritative campaign data into a player payload.

- Canonical entity IDs are transformed into campaign-scoped opaque IDs.
- Knowledge is resolved per subject and viewer.
- Party and player-specific audiences are evaluated independently.
- Revoked or expired grants are ignored.
- Higher knowledge levels win when multiple grants apply.
- Visible active-scene NPCs can be included; hidden participants are always omitted.
- Message threads contain only sent/received/read messages whose delivery time has passed.
- Asset URIs are limited to HTTPS or image/audio/video data URIs.
- Unknown entities never get placeholder records in arrays.

The parser checks the projection version and reconstructs only known safe fields. It does not attempt to recover unknown fields from another object.

## Safe identifier model

Player IDs are deterministic FNV-derived identifiers scoped to the campaign and entity kind. They allow links inside a projection without exposing raw sequential world IDs or canonical campaign keys.

## Local preview transport

The GM publishes only the serialized projection under a random local token and a latest-preview key. The player route reads that exact key. If it is missing or incompatible, Player View shows a privacy-safe error and does not load the GM project.

Local projection edits—journal entries, permitted character changes, pings, dice history, message replies, and objective proposals—operate on the safe projection. Milestone 23 will replace this local transport with authenticated commands and server-side persistence.

## Map payload

The player map is not the GM renderer. It uses:

- a downsampled terrain character grid;
- public main and secondary roads;
- explicitly known map features;
- the active scene position when its location is known;
- player-created pings when permitted.

Hidden Payaw geometry and authoring-layer secrets are not present.

## Defense in depth

The GM preview performs a structural forbidden-key audit before opening or downloading a projection. Behavioral tests separately assert that known GM-only fixture values never occur in the serialized payload. The player command boundary independently validates capabilities.
