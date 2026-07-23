# PAYAW 0.23.2 — Player Netcode and UI Remediation

## Release

- Version: `0.23.2`
- Table size: one owner GM plus a configurable `1–32` player slots; six is only the initial default
- Frontend: static Vite application suitable for Cloudflare Pages
- Backend: Supabase Postgres, Auth, private Realtime, Storage, RPC, and Edge Functions
- Product roles exposed in the UI: owner GM and player

## Corrected design flaws

### Hosting and synchronization

- Replaced sequential, manually published player projections with one atomic campaign-snapshot RPC.
- Added automatic debounced host synchronization for campaign, player-view, project, scene, map-policy, and reveal changes.
- Added optimistic revision conflict detection and a safe retry so player-owned work is not silently overwritten.
- Kept **Sync now** as an explicit recovery action rather than a required step in normal play.
- Added GM roster actions to revoke access or replace a lost/cleared player device with a fresh single-use invitation.
- Uploaded locally imported image handouts to protected player storage and substituted short-lived signed URLs in player projections.

### Player safety and recoverability

- Added cold-start offline recovery from the last validated safe projection.
- Realtime reconnects automatically and flushes only commands that are explicitly allowed offline.
- Changed capabilities to denied-by-default. Initial grants are limited to own-character editing, private journal writing, and dice.
- Made neutral geography optional and generated roads hidden until the GM explicitly enables them.
- Removed generated building footprints from the neutral player-map raster.
- Filtered generic generated buildings out of GM reveal and scene-location selectors.

### GM workflow and UI

- Campaign time is authoritative; the legacy simulation clock is forced to paused/manual and follows campaign time and timezone.
- The **Run** workspace now contains the Scene Director only. Legacy simulation-speed, travel, and random-story panels are no longer exposed there.
- Added searchable scene-location and reveal-entity selectors.
- Disabled invalid scene actions when no scene is active or selected.
- Fresh installations open in **CAMPAIGN**; explicit returning-user workspace choices are preserved.
- Improved network status wrapping, single-column room controls, disabled-control styling, and regional-scale contrast.
- Replaced stale milestone-era UI labels with task-oriented language.
- Removed ferry/water-route product surfaces. Ports remain simple coastal reference anchors.

## Validation

Passed:

- Strict TypeScript checking
- Production Vite build
- Milestone 17.1 persistence/routing regression
- Milestones 18, 19, 20, 21, 21.1, 22, and 23 focused regressions
- Configurable player-count, default-deny, atomic publish, protected asset, offline cache, and GM-controlled-map assertions
- Desktop browser QA at the normal viewport
- Narrow desktop browser QA at `1024 × 768`
- Browser console warning/error audit
- Regional-scale computed contrast audit (`#111` on `#fff`)

`npm run test:engine` was not run and is not part of the release gate.

## Deployment boundary

No live Supabase credentials were provided, so production Auth, RLS, Realtime, Storage, and Edge Function behavior were not exercised against a deployed project. The migrations, RLS policies, RPCs, client adapters, function, static frontend, and deployment procedure are included. Complete the live verification checklist in `docs/PAYAW_M23_DEPLOYMENT_GUIDE.md` after provisioning Supabase.
