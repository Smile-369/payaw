# PAYAW Milestone 20 Implementation Report

## Release

- Version: `0.20.0`
- Project schema: `20`
- Generation lineage: `payaw-m20-campaign-system-v1`
- Milestone: Campaign System

## Delivered

### Campaign container and persistence

- Added a schema-20 campaign domain tied to the active authored-world reference.
- Added normalization for absent, partial, and imported campaign data.
- Added campaign state to project export/import and browser autosave.
- Added campaign-only JSON export/import.
- Added revisioned activity records for consequential campaign mutations.

### Campaign dashboard

- Added campaign, session, scene, time, weather, upcoming-event, reveal, revision, and reference-health summaries.
- Added start/continue session and complete-session workflows.
- Added preparation checklist creation and completion.
- Added recent campaign activity.

### Scene Director

- Added a scene library with draft, ready, active, paused, completed, and archived lifecycle states.
- Added linked or freeform locations, descriptions, sensory details, read-aloud text, exits, tags, arcs, and target sessions.
- Added scene participant staging for characters, NPCs, and groups.
- Added ambient/reveal assets, map focus, default time, and default weather metadata.
- Connected active campaign scenes to the existing author-driven NPC scene-placement layer without altering weekly schedules or homes.
- Added live time, weather, reveal, message, encounter, and note actions.

### Campaign clock and timeline

- Added +5, +15, +30 minutes, +1 hour, next morning, next evening, tomorrow, and exact-time controls.
- Added editable validated IANA timezone support.
- Added time-jump previews with crossed-event and large-jump detection.
- Added manual, exact-time, scene-activation, relative, time-window, condition, and recurring event triggers.
- Added confirmation-gated event execution, trigger counts, last-triggered timestamps, and idempotency.
- Added event actions for scene activation, reveals, weather, notes, objective state, messages, and time advancement.

### Campaign information and messaging

- Added clues with GM/player titles, source, entity links, and discovery state.
- Added handouts with asset, caption, alternate text, scene links, and presentation order.
- Added objectives with GM intent, player wording, dependencies, state, and completion notes.
- Added audience-scoped reveal records with source and revocation metadata.
- Added local in-world message threads, drafts, scheduled queues, linked scenes, and glitch/corruption presentation settings.

### Assets, sessions, and safety

- Added campaign asset metadata for images, audio, documents, videos, and external links.
- Added GM, prep, live, recap, and checklist notes.
- Added planned/active/paused/completed sessions with recap and unused-prepared-scene tracking.
- Added lightweight encounter markers without introducing a combat engine.
- Added campaign checkpoints and restore for run state, scene/event/objective status, and reveals.
- Added global campaign search, backlinks, and broken-reference validation.

## Product boundaries retained

- PAYAW remains a GM authoring and session-running tool, not an autonomous game.
- Campaign events become eligible and require GM confirmation rather than silently changing canon.
- NPC scene placement remains author-driven; automatic commute simulation was not restored.
- Player View is deferred to Milestone 22.
- Authentication, hosted persistence, realtime synchronization, and player netcode are deferred to Milestone 23.
- The full WORLD/CAMPAIGN visual restructuring remains Milestone 21.

## Validation

Passed:

- `npm run check`
- `npm run test:ms20`
- `npm run test:ms19`
- `npm run test:ms18`
- `npm run test:ms171`
- `npm run test:ms164`
- `npm run test:ms162`
- `npm run test:ms82`
- Static duplicate-ID audit
- Campaign Studio selector audit: all 103 required controls are present
- Public npm lockfile audit: no internal registry URLs

`npm run test:engine` was not run because it is a legacy stress/benchmark suite and is not a PAYAW release gate.

## Production-build status

TypeScript application checking passed. A fresh Vite production bundle could not be regenerated in the packaging environment because the package gateway returned HTTP 503 while fetching the locked Vite dependency. The stale Milestone 19 `dist` directory was removed and is not included in this release.

In an environment with normal npm registry access:

```bash
npm install
npm run build
```

## Main files

- `src/campaign/CampaignSystem.ts`
- `src/campaign/CampaignStudio.ts`
- `src/main.ts`
- `index.html`
- `src/styles.css`
- `tests/Milestone20Test.ts`
- `scripts/run-ms20-tests.mjs`
- `docs/MILESTONE_20.md`
- `docs/MILESTONE_20_ARCHITECTURE.md`
- `docs/VALIDATION_20.md`
- `docs/MS20_TEST_RESULTS.json`
