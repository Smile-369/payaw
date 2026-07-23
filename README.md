# PAYAW Campaign World Engine — Milestone 23

PAYAW is a **GM-first TTRPG campaign authoring and session-running tool**. Procedural generation creates the initial map, the GM authors communities and campaign material on top of it, and the Campaign System provides the controls needed to prepare and run sessions.

Milestone 23 hosts the separate Player View in secure, live, recoverable rooms. The player application consumes a recipient-specific safe projection instead of loading or filtering the GM campaign object.

## Release summary

- Version: `0.23.2`
- Project schema: `20`
- Generation lineage: `payaw-m20-campaign-system-v1`
- Primary workspaces: `WORLD` and `CAMPAIGN`
- Visual direction: the uploaded PAYAW Messenger reference—compact Windows 98/early-2000s desktop chrome, clear title bars, beveled controls, white inset fields, and dense but readable information layout

## Milestone 22 Player View

- Separate player entry point selected with `?view=player`; it does not import or initialize the GM application.
- Versioned `PlayerProjection` contract with defensive parsing and fail-closed incompatibility handling.
- Unknown records are absent by default; rumored, discovered, visited, and investigated knowledge grants control visible detail.
- Whole-party and individual-player grants, aliases, revocation, expiry support, and a structural secrecy audit.
- Player-safe map, current scene, people, places, clues, handouts, objectives, character, journal, Messenger, travel estimate, and dice tray.
- Capability-gated player actions with conservative defaults: private journal, approved character edits, and dice are initially enabled; sharing and party mutations require GM approval.
- Responsive desktop/tablet/mobile layouts, including a mobile bottom navigation pattern.
- Local **View as Player** workflow in the GM Campaign workspace ahead of Milestone 23 networking.

The Player View never receives GM notes, secrets, NPC schedules, hidden scene participants, future messages, event triggers, unrevealed assets, or unrestricted campaign identifiers.

## Milestone 23 Player Netcode

- Supabase Postgres, Auth, private Realtime, Storage, RLS, RPC, and Edge Function backend.
- Permanent owner-GM magic-link identity and a GM-configurable table of 1–32 invitation-bound player slots (six by default).
- Hashed, expiring, single-use invitations; role and character assignment are resolved before projection access.
- Atomic authority/player publishing with optimistic concurrency protection, automatic debounced host sync, monotonic revisions, and complete-snapshot gap recovery.
- Cold-start offline recovery from the last validated safe projection, plus bounded offline-safe command queueing.
- Protected Storage upload and signed player-safe URLs for locally imported image handouts.
- GM roster controls for revoking a browser or replacing a lost device with a fresh single-use invitation.
- Party synchronization for messages, dice, shared journal entries, and map pings.
- GM room controls for immediate sync, invitations, device replacement, roster/presence, and command diagnostics.
- Cloudflare Pages security headers and optional Cloudflare Turnstile protection.

See [`docs/PAYAW_M23_DEPLOYMENT_GUIDE.md`](docs/PAYAW_M23_DEPLOYMENT_GUIDE.md) for the complete Supabase + Cloudflare deployment procedure.

## New application shell

The application now uses a map-first desktop shell:

- Persistent title bar and menu strip
- WORLD/CAMPAIGN workspace switcher
- Global search/command field
- Compact vertical tool rail
- Contextual left drawer
- Central map viewport occupying most of the screen
- Inspector/layers dock closed by default
- Bottom status bar

The old collection of large, simultaneous panels is no longer the primary navigation model.

## WORLD workspace

The WORLD rail contains:

- Generate
- Map
- Anchors
- Story
- NPCs
- Project

Settlements are no longer a separate generation or island-editor concept. They are managed in **Anchors** using a visible **Type category**:

- Community / settlement
- Point anchor

Community types retain town, barangay, subdivision, neighborhood, village, sitio, district, compound, and custom classifications. Position determines geographic/island ownership.

## Authored map scope

Milestone 21 removes the generalized Milestone 18 authored-map feature workflow from the visible product and from normalized active project state.

Retained:

- Generated world
- Generated roads, rivers, terrain, buildings, infrastructure, and labels
- Community/settlement anchors
- Point anchors
- Campaign locations, NPCs, story sites, and campaign records

Removed from the active authoring UI/state:

- Generic authored roads
- Generic authored rivers and terrain brushes
- Generic authored buildings
- Generic authored districts
- Generic authored infrastructure and natural-feature records
- Generic authored labels
- Generalized Hidden Payaw geometry authoring

Legacy engine contracts remain in source where required by retained regression tests and old project compatibility, but they are not offered as Milestone 21 editing workflows.

## Milestone 21.1 QA remediation

- Fixed WORLD/CAMPAIGN tab collisions by giving the command row and workspace tabs explicit, compatible heights.
- Made the Inspector & Layers dock truly closed on first launch so the map owns the majority of the workspace.
- Retired the cramped road/block naming, bridge, port-authoring, zone-painting, and asset-placement panels from the active authoring UI.
- Removed water routes from generation, world persistence, rendering, travel, simulation, overlays, and editor controls. Ports remain simple coastal reference points.
- Skips legacy bridge, port, and road/block editor list rendering during world refreshes.

## Story-point removal

Every generated story point can now be removed from the campaign world. Removal is:

- Non-destructive
- Stored as a suppressed story-rule override
- Undoable through project history
- Reversible through **Restore removed**
- Preserved through generation and project persistence

## CAMPAIGN workspace

The CAMPAIGN rail exposes the Milestone 20 systems in a focused run/prep workflow:

- Dashboard
- Scenes
- Timeline
- Reveals
- Messages
- Assets
- Notes
- Run

The Run tool is intentionally limited to the Scene Director. Legacy simulation, travel, and random-story controls are not mixed into the live-session surface.

## Running the project

With normal npm registry access:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

A dependency-independent static QA build script is also included:

```bash
node scripts/build-static.mjs
```

This produces `dist/` after TypeScript checking/compilation and is intended for release inspection when Vite cannot be downloaded in a restricted environment.

## Validation

Targeted release gates:

```bash
npm run check
npm run test:ms21
npm run test:ms211
npm run test:ms22
npm run test:ms23
npm run test:ms20
npm run test:ms19
npm run test:ms18
npm run test:ms171
node scripts/build-static.mjs
```

`npm run test:engine` is a legacy stress benchmark and is not a PAYAW release gate.

## Documentation

- `docs/MILESTONE_21.md`
- `docs/MILESTONE_21_ARCHITECTURE.md`
- `docs/VALIDATION_21.md`
- `PAYAW_M21_IMPLEMENTATION_REPORT.md`
