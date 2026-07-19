# PAYAW Procedural World Engine — Milestone 10

**Milestone 10: Inter-Island Bridge Network** adds deterministic, first-class bridges to the regional world introduced in Milestone 9.

Bridges are not decorative lines. Each bridge owns a water-crossing deck, bridge approach roads, island references, support points, a stable identity, generated or authored properties, renderer layers, and non-destructive editor overrides.

The existing World Editor, DM Mode, regional islands and settlements, story encounters, zone authoring, custom assets, undo/redo, label controls, PNG export, and JSON/override export remain available.

## What Milestone 10 adds

### Bridge demand and candidate generation

PAYAW samples coastlines between inhabited islands that permit roads and bridges. A crossing candidate is rejected when it:

- Connects an island to itself
- Falls outside the configured span range
- Crosses interior land instead of water
- Intersects an unintended third island
- Cannot connect to a road or settlement on either side

Valid candidates are scored using:

- Connected island population
- Primary-settlement and port-hub importance
- Span length
- Average water depth
- Shoreline approach direction
- Endpoint slope
- Distance to the existing road network

The engine first selects a deterministic minimum regional connection network, then may add a limited number of high-value extra links.

### First-class bridge entities

Each bridge records:

- Stable key and generated/editable name
- Origin and destination islands
- Coast endpoints
- Centerline and water deck tiles
- Bridge type and road class
- Length, deck width, and clearance
- Support points
- Approach-road IDs
- Deck-road ID
- Generated/custom and locked state

Bridge types include:

- Footbridge
- Causeway
- Local bridge
- Highway bridge
- Long-span bridge

### Road integration

A selected bridge produces three connected pieces:

```text
Island road network
→ approach road
→ bridge deck
→ approach road
→ destination road network
```

Approach roads use the existing A* terrain-cost pathfinder. They account for slope, flood risk, mountains, forests, rivers, and existing-road reuse. The deck is stored as a separate bridge-owned road that can cross water tiles.

Bridge-owned roads are excluded from normal street rendering and labeling so the bridge renderer and bridge label system remain authoritative.

### Bridge Editor

The World Editor now contains a **Bridges** module.

For generated bridges, you can edit:

- Name
- Bridge type
- Road class
- Deck width
- Clearance
- Approximate endpoint coordinates, which snap to valid coast tiles
- Lock state
- Suppression state

You can also add a custom bridge by selecting:

- Origin island
- Destination island
- Name
- Bridge type
- Road class
- Deck width
- Clearance

Custom bridge definitions suppress automatic duplication of the same island pair.

All bridge authoring supports:

- Undo and redo
- Local persistence
- Portable override export/import
- Reset to generated defaults
- Partial regeneration beginning at the bridge stage

### Rendering and labels

New independent layers:

- Bridge decks and supports
- Bridge labels

Bridge labels do not depend on street-label visibility. Imported artwork can also target `infrastructure:bridge` and render at bridge midpoints.

Bridges are included in full-map PNG and World JSON export when their corresponding layers are enabled.

## Generation order

```text
Terrain and hydrology
→ Landmasses, islands, and settlements
→ Anchors
→ Intra-island roads
→ Bridges and approach roads
→ Accessibility
→ Blocks
→ Land value and zoning
→ Buildings and vegetation
→ Story layer
```

Placing bridges before accessibility allows cross-island connections to influence downstream development and travel potential.

## Milestone boundary

Milestone 10 generates road bridges only. It does not generate:

- Ports
- Ferry terminals
- Water-navigation fields
- Passenger or cargo routes
- Schedules or travel-time simulation

Those belong to the maritime and mobility milestones that follow.

## Run

```bash
corepack enable
pnpm install
pnpm dev
```

## Validate

```bash
pnpm check
pnpm test:ms8
pnpm test:ms81
pnpm test:ms82
pnpm test:ms9
pnpm test:ms10
```

After dependencies are installed, create a production bundle with:

```bash
pnpm build
```
