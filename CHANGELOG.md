# 0.14.0

- Added 0–12 satellite-settlement control; zero produces only the primary settlement.
- Added deterministic allocation of requested satellite settlements across viable islands.
- Added a dedicated Web Worker for user-triggered full-world generation.
- Added immediate generation cancellation by terminating the active worker.
- Added 31-stage generation progress reporting and live timing diagnostics.
- Added worker-result rehydration without regenerating on the main thread.
- Added per-raster-layer cache invalidation for partial regeneration.
- Added viewport spatial indexes for buildings and vegetation.
- Added live renderer diagnostics for cache, frame time, and visible dense objects.
- Updated world schema and engine generation version for Milestone 14.
- Added focused deterministic, cancellation, and satellite-count tests.

# 0.13.0

- Added eight explicit World Layout presets.
- Added separate small, medium, and large single-island terrain masks.
- Made Single Large Island the default layout.
- Added Inland Coast and simplified Delta naming.
- Preserved Archipelago island-count and spacing controls.
- Added migration for legacy layout values in saved profiles and JSON imports.
- Added Milestone 13 layout regression tests.

# Changelog

## Milestone 12 — Metro-Scale Regional Controls and JSON Import

- Added 125-meter tile scale and exported physical world dimensions.
- Added authored archipelago island count from 2 to 12.
- Added authored island spacing in kilometers.
- Added regional island planning that prioritizes count and relaxes impossible spacing safely.
- Added preferred satellite-community allocation by town scale.
- Added draggable non-primary settlement centers with validation and stale-position recovery.
- Added full PAYAW project/world JSON import.
- Added automatic detection of override-only JSON.
- Added drag-and-drop JSON import.
- Added schema validation, 64 MB input limit, normalization, and embedded image-asset restoration.
- Updated customization signatures to include island count and spacing.
- Updated schema version to 12 and engine version to `payaw-m12-metro-region-v1`.

## Milestone 11.1 — Saved Position Recovery

- Added typed invalid-position errors for anchors and story locations.
- Full generation automatically removes and persists only stale position overrides.
- Procedural placement is restored without deleting unrelated customization.
- Direct object dragging remains strict.
- Added focused recovery tests.

## Milestone 11 — Maritime Network

- Added deterministic port placement and port approach roads.
- Added small-boat, ferry, and cargo-vessel water navigation.
- Added generated and custom water routes with travel time and danger.
- Added weighted deterministic maritime encounter tables and DM rolls.
- Added port and route editors, overrides, undo/redo, layers, labels, and exports.
- Added bridge/port road ownership for deterministic partial regeneration.
- Incremented the world schema to version 11.

## 0.10.0 — Inter-Island Bridge Network

- Added deterministic coast-to-coast bridge candidate generation.
- Added benefit/cost scoring using population, island role, span, depth, slope, shoreline direction, and road-access distance.
- Added disjoint-set regional backbone selection and optional extra bridge links.
- Added first-class bridge entities with island ownership, deck geometry, supports, width, clearance, type, and road class.
- Added footbridge, causeway, local, highway, and long-span bridge types.
- Added A* bridge approach roads and separate bridge-owned deck roads across water.
- Integrated bridge connectivity before accessibility, blocks, zoning, buildings, and story generation.
- Added bridge and bridge-label renderer layers plus imported bridge artwork targeting.
- Added a non-destructive bridge editor with custom bridges, endpoint adjustment, suppression, reset, persistence, import/export, and undo/redo.
- Added partial regeneration from the bridge stage.
- Added schema version 10 and bridge data to World JSON.
- Added focused deterministic, override, suppression, custom-bridge, and partial-regeneration tests.

## 0.9.0 — Regional World Foundation

- Added physical landmass detection with coastline, bounds, centroid, freshwater, hazard, and buildable-area statistics.
- Added first-class island entities with stable keys, names, roles, development levels, population capacity, and regional permissions.
- Added regional population allocation for rural, semi-urban, and urban profiles.
- Added multiple generated settlements per island with population targets and influence radii.
- Added same-island settlement connectors and local settlement road backbones.
- Integrated settlements into accessibility, blocks, zoning, place naming, and story placement.
- Added island boundaries, labels, and settlement rendering layers.
- Added a non-destructive island editor with undo/redo, persistence, import/export, and partial regeneration.
- Added schema version 9 and regional data to World JSON.
- Corrected Archipelago and Twin Islands macro masks so they reliably produce separate physical landmasses.
- Added focused Milestone 9 deterministic and regional-invariant tests.

## 0.8.2 — Editor / DM Workspaces

- Split the application into persistent World Editor and DM Mode workspaces.
- Moved encounter rolling and story-site reference cards out of authoring controls.
- Added a town-wide random encounter roller and recent-roll session log.
- Added story-site search and DM map presets.
- DM Mode automatically disables object and zone editing.
- Grouped editor tools into five collapsed sections.
- Modernized the sidebar, cards, toolbar, form styling, spacing, and responsive layout.
- Added focused Milestone 8.2 UI architecture tests.

## 0.8.1 — Editor Core, Image Export, and Encounters

- Added bounded 64-step undo/redo for non-destructive authoring state.
- Added toolbar actions and standard undo/redo keyboard shortcuts.
- Added history support for zoning, names, anchor/story edits, and placed-image transforms.
- Added `GenerationPipeline.regenerateFrom()` for deterministic partial pipeline updates.
- Added cached asset target lookup and viewport culling for dense visual layers.
- Added complete-world PNG export using current visible layers and label settings.
- Added browser-authored custom story points with no TypeScript editing required.
- Added new story archetypes for haunted houses, shrines, ruins, forests, and waterside haunts.
- Added deterministic encounter-table generation for every story point.
- Added weighted random encounter rolls and browser-authored encounter tables.
- Added key-based custom story position and rule overrides.
- Added custom story points to portable override and World JSON exports.
- Added focused Milestone 8.1 runtime tests and a 142-selector DOM audit.

## 0.8.0 — Asset, Zone, and Story Authoring

- Replaced building-only image assignment with category/type asset targeting.
- Added building, story, anchor, vegetation, infrastructure, and map targets.
- Added Mall, Cinema, Nipa Hut, Town House, Boarding House, Mansion, Condominium, Convenience Store, Restaurant, Café, Hotel, Office Building, Factory, and Farm House templates.
- Added story name and zoning-rule editor.
- Added Mixed Use zoning.
- Added non-destructive generated/final/override zone state.
- Added paint, erase, fill, rectangle, eyedropper, smooth, lock, and unlock zone tools.
- Added generated/final/override-only zone visualization.
- Added portable customization export and import.
- Added Milestone 8 focused deterministic tests.
