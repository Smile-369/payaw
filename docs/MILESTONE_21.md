# Milestone 21 — UI/UX Overhaul

## Product objective

Milestone 21 makes PAYAW feel like a purpose-built TTRPG campaign editor rather than a procedural generator with additional panels attached. The map remains the primary canvas, while tools appear according to the GM's current task.

The release is based on the visual and interaction language of the supplied PAYAW Messenger reference: compact Windows desktop framing, strong title bars, beveled controls, white input surfaces, restrained gradients, and clear active/inactive states.

## Core interaction model

### Workspace switcher

PAYAW has two top-level workspaces:

- **WORLD** — map generation, communities/anchors, story sites, NPC/location setup, transit, and project controls
- **CAMPAIGN** — campaign dashboard, scenes, timeline, reveals, messages, assets, notes, and live run controls

The switch changes the tool rail and contextual drawer without replacing the map or campaign state.

### Map-first layout

The default desktop layout is:

1. Compact tool rail
2. Contextual tool drawer
3. Main map canvas
4. Closed inspector/layers dock

The inspector only consumes horizontal space when the GM opens it. The left drawer can also collapse.

### Consistent chrome

Buttons, fields, cards, title bars, menus, tabs, status bars, and selected states use a consistent Win98-inspired visual system. The active tool receives a clear blue selected state; inactive tools remain neutral gray.

## WORLD workspace

### Generate

Generation controls create or rebuild the deterministic starting world. Settlement counts are not part of generation.

### Map

Map display and navigation controls are grouped without exposing generalized authored geometry.

### Anchors

Anchors are the sole manual map-placement concept retained in Milestone 21.

The Type category control contains:

- **Community / settlement**
- **Point anchor**

Community/settlement subtypes include city, town, barangay, subdivision, neighborhood, village, sitio, district, compound, and custom. Community hierarchy and movement remain non-destructive. Landmass ownership follows the anchor's current position.

Point anchors are lightweight named points of interest. They are not a replacement for generic authored roads, rivers, terrain, or buildings.

### Story

Story sites display generated campaign hooks. Each story point includes a Remove action. Removed points are suppressed rather than destructively deleted, and the section provides a Restore removed action with a count.

### NPCs

NPC and campaign-location authoring from Milestone 19 remains available, including residential home rules, weekly schedules, relationships, portraits, venue states, and scene/temporary placement overrides.

### Project

Project contains save, import/export, undo/redo, and related project actions. Point-to-point travel remains available where it serves GM planning, but water-route generation and ferry-network simulation are not part of the Milestone 21.1 product surface.

## Milestone 21.1 QA remediation

The 21.1 maintenance release completes the overhaul boundary instead of wrapping the legacy editor:

- WORLD/CAMPAIGN tabs use bounded dimensions and cannot inherit the old oversized workspace-tab layout.
- The inspector remains closed by default, including after the initial active-tool selection.
- Road/block naming, bridges, port management, and generalized authored-map editors are retired from the active shell.
- Community creation remains consolidated under Anchors through its Type category.
- Story-point removal is available directly in WORLD > Story.
- Constrained forms stack into one readable column rather than retaining viewport-wide grids inside a narrow drawer.
- Status summaries use explicit accessible foreground and background colors.
- Water routes are removed from generation, rendering, simulation, travel planning, and UI.

## CAMPAIGN workspace

Milestone 20 features are reorganized into focused tools:

- Dashboard
- Scenes
- Timeline
- Reveals
- Messages
- Assets
- Notes
- Run

The Scene Director and live campaign clock remain GM-controlled. Campaign events require explicit authoring and confirmation rather than becoming an autonomous storyteller.

## Authored-map simplification

The previous generalized authoring system was too broad for PAYAW's current purpose and contributed significantly to UI clutter.

Milestone 21 removes its visible workflows and normalizes loaded authoring data to retain only:

- Authored settlements/community anchors
- Settlement overrides
- Point-anchor authored features

The following authored feature categories are dropped from normalized active state:

- Terrain overrides
- Generic road/path features
- Generic waterways
- Generic buildings
- Generic districts/areas
- Generic infrastructure
- Generic natural features
- Generic labels
- Hidden Payaw geometry
- Generated-feature override/adoption records

The underlying generated world remains intact. Campaign content references generated entities, settlements, point anchors, and campaign locations.

## Explicit exclusions

Milestone 21 does not include:

- Player-facing interface
- Authentication
- Realtime synchronization
- Remote campaign hosting
- Player permissions or knowledge projections
- Player netcode

Those are Milestones 22 and 23.

## Definition of done

Milestone 21 is complete when:

- WORLD and CAMPAIGN are the primary navigation modes.
- The map occupies most of the default workspace.
- The inspector is closed by default and can be opened when needed.
- Settlements are authored through Anchors with a Type category.
- The Island Editor and settlement generation controls are absent.
- Generic authored-map feature controls are absent from the visible UI.
- Active authoring state retains only settlements and point anchors.
- Story points can be removed and restored non-destructively.
- Milestone 20 campaign features remain reachable and functional.
- The UI follows the supplied PAYAW Messenger visual direction.
