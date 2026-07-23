# Changelog

## 0.23.2

### Fixed
- Replaced sequential per-player publishing with one atomic authority-and-projection transaction and optimistic revision checks.
- Added automatic debounced synchronization for campaign, player-access, and world changes.
- Added player-browser revocation and lost-device replacement controls.
- Connected imported image handouts to the protected player Storage bucket and signed HTTPS projection URLs.
- Added cold-start offline recovery from the last validated recipient projection.
- Removed generated building footprints and default road visibility from new player maps.
- Made shared actions denied by default and added explicit GM map-visibility controls.
- Unified the visible campaign clock with the manual world clock and reduced Run to the Scene Director.
- Added searchable authored-place/reveal selectors and removed generic generated buildings from those menus.
- Removed ferry scheduling, ferry-terminal creation defaults, and remaining active ferry UI.
- Fixed low-contrast generation summaries and narrow hosted-room status wrapping.

### Changed
- New projects open in the Campaign dashboard; milestone labels are no longer exposed as product navigation.
- Hosted handoff is automatic after room creation; the manual button is now an immediate “Sync now” action.
- Product-facing hosted roles are owner GM and player. Reserved database role values are not advertised as implemented workflows.

## 0.23.1

### Fixed
- Replaced the six-player frontend lock with a GM-configurable table size from 1 to 32 players.
- Player and character profiles now expand or shrink while preserving retained players.
- Scene character choices, invitations, projection publishing, roster totals, and status text now follow the configured count.
- Hosted slots removed from the table are pruned through a GM-only RPC; their unused invitations are revoked and their room memberships are removed.

## 0.23.0

### Added
- Added Supabase campaign rooms, roles, RLS, Auth, private Realtime, Storage policies, RPC, and a privileged command Edge Function.
- Added hashed single-use player invitations and six explicit player/character slots.
- Added recipient-safe hosted projections, revision-gap recovery, idempotent commands, and an offline-safe queue.
- Added party synchronization for messages, dice, shared journals, and map pings.
- Added the GM room panel, network Player View join flow, connection diagnostics, Turnstile support, Cloudflare security headers, and deployment guide.

### Security
- GM campaign checkpoints and recipient projections have separate RLS boundaries.
- Player View never queries the authority document or another player's slot.
- Service-role access is confined to the deployed Edge Function and is never exposed through Vite configuration.

### Deployment
- Default seven-user deployment is Cloudflare Pages Free plus Supabase Free, with no dedicated Node server.

## 0.22.0

### Added
- Added a purpose-built Player View with its own entry point, stylesheet, navigation, map, current scene, journal, people, places, clues, handouts, objectives, character, Messenger, travel, and dice modules.
- Added a versioned, deeply immutable PlayerProjection and a projection service that emits only authorized player-safe fields.
- Added party and player-specific knowledge grants with rumored, discovered, visited, and investigated levels, aliases, expiry, revocation, and notification metadata.
- Added GM controls for six player identities, character names, capabilities, knowledge grants, projection summaries, secrecy checks, local previews, and safe JSON downloads.
- Added capability-gated player commands and behavioral tests for audience isolation, hidden-participant omission, future-message omission, permissions, and fail-closed projection parsing.

### Security
- Player bootstrap now branches before the raw GM application is imported.
- Unknown records are absent by default; hidden participants, GM notes, campaign secrets, NPC schedules, triggers, future messages, and unrevealed assets are not serialized into player projections.
- Player action capabilities are checked at the command boundary instead of being cosmetic UI toggles.

### Retained boundaries
- Milestone 22 uses local View-as-Player projections and does not add authentication or networking.
- Hosted Player Netcode remains Milestone 23.

## 0.21.1

### Fixed
- Fixed the WORLD/CAMPAIGN workspace switcher overlapping the title/menu chrome.
- Fixed legacy two-column forms collapsing into unreadable narrow drawer columns.
- Fixed the Inspector & Layers dock reopening during initialization despite its closed default.
- Retired leftover zone, asset, bridge, port, and road/block authoring panels from the active World workspace.

### Removed
- Removed generated water routes, water-route overlays, route labels, route simulation state, ferry route planning, and water-route editor controls.
- Removed the Transit tool from the World rail. Ports remain generated coastal reference points.

### Optimized
- Removed the water-route generation stage and route rendering work.
- Stopped rebuilding hidden legacy bridge, port, and naming editor lists on every world refresh.

## 0.21.0

### Added
- Added a Messenger-inspired Windows desktop application shell with title bar, menus, command field, tool rail, contextual drawer, collapsible inspector, and status bar.
- Added distinct WORLD and CAMPAIGN workspaces.
- Added a settlement/anchor Type category for Community / settlement and Point anchor.
- Added non-destructive story-point removal, removed-point counts, restoration, persistence, and undo/redo integration.
- Added targeted Milestone 21 tests and a dependency-independent static QA build.

### Changed
- Made the map the dominant default workspace and closed the inspector by default.
- Reorganized existing tools around GM tasks instead of subsystem tabs.
- Consolidated settlements into the Anchors workflow and kept the Island Editor removed.
- Removed settlement quantity controls from Generation.
- Narrowed active authored-map state to settlements/community anchors and point anchors.
- Retired generalized authored terrain, road, river, building, district, infrastructure, natural-feature, label, and Hidden Payaw geometry workflows from the visible UI.
- Changed the default UI presentation to the light Messenger-inspired theme.

### Retained boundaries
- Player View remains Milestone 22.
- Authentication, hosted realtime synchronization, and player netcode remain Milestone 23.

## 0.20.0

### Added
- Added a schema-20 Campaign System layered over the authored world.
- Added a campaign dashboard with active session, active scene, clock, weather, event, reveal, revision, checklist, and activity summaries.
- Added the Scene Director and scene library with lifecycle states, linked or freeform locations, GM/player descriptions, staged participants, exits, presentation settings, and referenced campaign material.
- Added GM-friendly campaign clock controls, exact time setting, IANA timezone editing, time-jump previews, and eligible-event detection.
- Added timeline events with manual, time, scene-activation, relative, window, condition, and recurring triggers.
- Added confirmation-gated, idempotent event execution and campaign action logging.
- Added clues, handouts, objectives, audience-scoped reveal records, and reversible reveal metadata.
- Added local in-world message threads, drafts, queued messages, scheduled delivery metadata, and glitch presentation settings.
- Added a campaign asset registry for images, audio, documents, videos, and external links.
- Added GM notes, live notes, preparation checklists, session recaps, encounters, checkpoints, restore, activity history, backlinks, campaign search, and reference validation.
- Added campaign-only JSON export/import and schema-20 project/autosave persistence.
- Added targeted Milestone 20 behavioral validation.

### Changed
- Promoted campaign preparation and live-session controls into the DM workspace while retaining world authoring below them.
- Changed campaign time advancement from simulation-speed controls to semantic GM actions such as +15 minutes, next morning, next evening, and tomorrow.
- Connected active campaign scenes to the existing author-driven NPC scene-placement layer without enabling autonomous NPC travel.
- Updated generation lineage to `payaw-m20-campaign-system-v1` and project schema to 20.

### Deferred
- Player-facing projections and Player View remain Milestone 22.
- Authentication, hosted persistence, realtime synchronization, and player netcode remain Milestone 23.
- The full visual restructuring into WORLD and CAMPAIGN workspaces remains Milestone 21.

## 0.19.0

### Added
- Added GM-authored NPC creation and non-destructive editing of generated NPC suggestions.
- Added residential-only home assignment with an explicit unusual-residence override.
- Added exact Monday–Sunday schedule blocks with activity, location, travel description, and visibility.
- Added schedule overlap validation, weekday copying, day clearing, and home fallback.
- Added NPC relationships, portraits, tags, public descriptions, and GM notes.
- Added temporary NPC placements and active-scene placements with scene-first resolution.
- Added campaign location records for buildings, anchors, community anchors, and authored map features.
- Added location owners, player/GM descriptions, tags, visibility, weekly venue hours, and manual venue states.
- Added schema-19 persistence and targeted Milestone 19 behavioral validation.

### Changed
- Consolidated towns, barangays, subdivisions, neighborhoods, sitios, districts, compounds, and custom communities into the Anchor points authoring workflow.
- Removed satellite-settlement controls from the Generation profile.
- Removed the Island Editor interface; an anchor's landmass is inferred from its placed position.
- Changed NPC schedule behavior from autonomous commute simulation to GM-authored location resolution.
- Changed generated NPC story conditions to default to Alive; consequential conditions are now authored by the GM.
- Updated generation lineage to `payaw-m19-npc-location-authoring-v1`.

### Fixed
- Kept generated and authored NPC homes limited to residential buildings unless the GM deliberately enables an unusual residence.
- Preserved NPC/location authoring through autosave, project import/export, and world regeneration.
- Removed runtime directions to the deleted Island Editor.

## 0.18.0

### Added
- Added a unified non-destructive World Authoring Layer over deterministic generation.
- Added manual settlement creation for towns, barangays, subdivisions, neighborhoods, villages, sitios, districts, compounds, and custom community types.
- Added settlement movement, resizing, rotation metadata, renaming, hierarchy, duplication, visibility, locking, suppression, and reset-to-generated behavior.
- Added per-settlement switches for generated local roads and buildings.
- Added terrain raise, lower, set-elevation, smooth, paint, river-carve, river-erase, restore, brush size, strength, and terrain-lock tools.
- Added point, path, and polygon authoring for roads, rivers, buildings, districts, landmarks, infrastructure, natural features, labels, and Hidden Payaw.
- Added authored-feature aliases, GM notes, visibility, style, scale, rotation, opacity, locking, hiding, duplication, movement, deletion, and restoration.
- Added generated-road and generated-building adoption with stable suppression IDs and restoration links.
- Added authored roads to the routing graph and authored rivers to the terrain stage.
- Added separate normal-world and Hidden Payaw rendering layers.
- Added Milestone 18 persistence, undo/redo snapshots, schema migration, tests, and documentation.

### Fixed
- Changed live infrastructure status into a zoom-aware exception overlay instead of drawing warning markers over the full regional network.
- Disabled infrastructure exceptions by default and prioritized manual GM statuses over weather-derived warnings.
- Preserved destination island identity when settlements are moved across islands.
- Re-enabled destination-island road generation after moving a settlement across islands.

### Product direction
- Reframed PAYAW's living-world systems as optional GM support rather than autonomous campaign authority.
- Established the generated map as a recoverable starting draft under full GM authorship.

## 0.18.0

### Added
- Added a persistent, non-destructive world authoring layer over deterministic generation.
- Added manual settlement creation for towns, barangays, subdivisions, neighborhoods, villages, sitios, districts, compounds, and custom community types.
- Added settlement movement, resizing, rotation, hierarchy, visibility, locking, population, density, and selective local generation controls.
- Added terrain brushes for elevation, terrain painting, river carving, river removal, and tile restoration.
- Added authored point, path, area, and circle features for roads, waterways, buildings, districts, landmarks, infrastructure, natural features, labels, and Hidden Payaw.
- Added generated-road and generated-building adoption with stable identities and reset-to-generated behavior.
- Added authored feature translation, scaling, rotation, visibility, aliases, notes, hiding, locking, duplication, deletion, and reset controls.
- Added authoring and Hidden Payaw render layers.
- Added Milestone 18 behavioral validation and schema version 18.

### Changed
- Changed satellite-settlement placement rules from hard blockers to GM-facing warnings; in-bounds authored positions are preserved even on water, floodplains, or steep terrain.
- Changed granular regeneration to reconstruct the deterministic baseline before reapplying authoring overrides, preventing stale geometry.
- Updated generation lineage to `payaw-m18-world-authoring-v1`.
- Updated retained settlement-placement tests to reflect GM authorship rather than generator vetoes.

### Fixed
- Fixed the Infrastructure Status overlay covering the regional map with dense red markers. It now defaults off and renders only zoom-appropriate exceptions, prioritizing manual and severe disruptions.
- Fixed authored feature hit-testing and dragging after scale or rotation.
- Retained public npm lockfile metadata and forward-compatible legacy milestone checks.

## 0.17.1

### Fixed
- Preserved in-progress NPC travel across schedule boundaries, including delayed and unreachable states.
- Persisted the simulation event log through save/export and restore/import.
- Validated imported IANA timezones and normalized invalid values to Asia/Manila.
- Applied the simulation timezone consistently to schedule periods and date/time controls.
- Added routing penalties for restricted bridges, ports, and water routes.
- Removed internal registry URLs and synchronized release metadata in the npm lockfile.
- Restored the Milestone 8.2 collapsed-editor regression.

### Improved
- Rebuilt the living-world controls as a clearer DM operations panel.
- Added morning, evening-rush, 3 AM, and typhoon scenario presets.
- Added operational summary cards and a filterable, clearable event timeline.
- Added visible live-state overlays for infrastructure, venues, settlement activity, and supernatural activity.
- Improved responsive behavior, hierarchy, spacing, and light-theme presentation.

## 0.17.0

- Add real-time, accelerated campaign-time, and paused manual-time clock modes.
- Add deterministic and DM-authored weather.
- Add Metro Bacolod-style aggregate traffic periods.
- Add dynamic venue operating states.
- Add weather-derived and manually authored road, bridge, port, and water-route restrictions.
- Move NPCs through their daily schedules using the regional travel planner.
- Add delayed and unreachable NPC travel states.
- Add after-dark, storm-amplified, and 3 AM supernatural states.
- Add a simulation event log and status summaries.
- Apply live simulation context to Point A → Point B routing.
- Show current-condition and normal-condition travel estimates.
- Persist simulation state in project JSON and autosave data.
- Upgrade project schema to 17 and generation version to `payaw-m17-living-world-v1`.
- Retain cross-island settlement reassignment, NPC visibility controls, road forks, alternate routes, and all Milestone 14–16 editor capabilities.
