# PAYAW Milestone 21 Implementation Report

## Release

- Version: `0.21.0`
- Project schema: `20`
- Generation lineage: `payaw-m20-campaign-system-v1`
- Milestone: UI/UX Overhaul
- Visual reference: supplied PAYAW Messenger project

## Delivered

### Messenger-inspired application shell

- Replaced the old page framing with a compact Windows 98/early-2000s desktop-style shell.
- Added a persistent title bar, application menu, command/search field, and bottom status bar.
- Added separate WORLD and CAMPAIGN workspace modes.
- Added compact vertical tool rails and a contextual left drawer.
- Made the map the dominant default workspace.
- Made the inspector/layers panel closed by default and independently reopenable.
- Added collapsible side panels while retaining existing application functionality and element contracts.

### WORLD workflow

- Organized tools into Generate, Map, Anchors, Story, NPCs, Transit, and Project.
- Removed settlements from generation controls.
- Kept the Island Editor removed.
- Consolidated settlements and point anchors into the Anchors workflow.
- Added a visible Type category selector for Community / settlement and Point anchor.
- Preserved community hierarchy, movement, renaming, generation toggles, and inferred landmass ownership.

### Authored-map simplification

- Removed all generalized authored-map feature panels from the visible Milestone 21 UI.
- Retained only settlements/community anchors and point anchors as manual map features.
- Changed authoring normalization to discard terrain overrides, generated-feature overrides, and non-anchor authored features.
- Retained legacy engine contracts only where needed for migration and historical regression compatibility.

### Story-point control

- Added Remove actions to story-point cards.
- Added non-destructive story-rule suppression.
- Added a removed-story counter and Restore removed action.
- Preserved removal through regeneration and project persistence.
- Integrated story removal with undo/redo history.

### CAMPAIGN workflow

- Reorganized Milestone 20 features into Dashboard, Scenes, Timeline, Reveals, Messages, Assets, Notes, and Run.
- Kept Scene Director, campaign clock, events, handouts, objectives, messaging, checkpoints, and session records intact.
- Deferred player-facing projections to Milestone 22 and hosted realtime synchronization to Milestone 23.

## Main files

- `src/bootstrap.ts`
- `src/ui/Milestone21Shell.ts`
- `src/ui/ms21.css`
- `src/main.ts`
- `src/story/StoryGenerator.ts`
- `src/engine/generation/GenerationOptions.ts`
- `tests/Milestone21Test.ts`
- `scripts/run-ms21-tests.mjs`
- `scripts/build-static.mjs`
- `docs/MILESTONE_21.md`
- `docs/MILESTONE_21_ARCHITECTURE.md`
- `docs/VALIDATION_21.md`

## Validation

Passed:

- `npm run check`
- `npm run test:ms21`
- `npm run test:ms20`
- `npm run test:ms19`
- `npm run test:ms18`
- `npm run test:ms171`
- `node scripts/build-static.mjs`
- Syntax check for all emitted JavaScript
- Public lockfile audit
- Desktop visual shell inspection

`npm run test:engine` was not run because it is a legacy stress benchmark and not a PAYAW release gate.

## Production-build status

A normal Vite bundle was not regenerated because package installation timed out against the registry in the packaging environment. The release includes a successfully generated static QA build in `dist/`. In a normal networked development environment:

```bash
npm install
npm run build
```

## Product boundary

Milestone 21 is a structural UI release, not a player or networking release. The authoritative roadmap remains:

- Milestone 21 — UI/UX Overhaul
- Milestone 22 — Player View
- Milestone 23 — Player Netcode
