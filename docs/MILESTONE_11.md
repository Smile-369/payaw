# Milestone 11 — Maritime Network Architecture

## Objective

Milestone 11 adds deterministic maritime infrastructure after the bridge stage and before accessibility, zoning, buildings, and story placement.

```text
Roads
→ Bridges
→ Ports
→ Water Routes
→ Accessibility
→ Blocks
→ Land Value
→ Zoning
→ Buildings
→ Story
```

This ordering allows bridge and ferry access to influence later settlement analysis.

## Data model

### Port

A port is a land-side transport node with an adjacent navigable water entry point.

```ts
interface Port {
  id: number;
  key: string;
  name: string;
  islandId: number;
  settlementId: number | null;
  position: GridPoint;
  waterPosition: GridPoint;
  type: PortType;
  capacity: number;
  waterDepth: number;
  shelteredScore: number;
  roadAccessDistance: number;
  accessRoadId: number | null;
  routeIds: number[];
  generated: boolean;
  locked: boolean;
}
```

### Water route

```ts
interface WaterRoute {
  id: number;
  key: string;
  name: string;
  fromPortId: number;
  toPortId: number;
  type: WaterRouteType;
  vesselClass: VesselClass;
  tileIndices: readonly number[];
  centerline: readonly GridPoint[];
  distance: number;
  estimatedTravelTimeMinutes: number;
  dangerRating: number;
  encounters: readonly MaritimeEncounter[];
  generated: boolean;
  enabled: boolean;
  locked: boolean;
}
```

## Port candidate scoring

The engine samples coastline tiles instead of comparing every coastal point. A candidate must:

- Belong to the target island
- Be land adjacent to ocean
- Have sufficient nearby water depth
- Support a valid road approach

Its score combines depth, shelter, flatness, road access, flood exposure, island role, and population demand.

Authored positions are treated as preferences. The engine snaps them to the closest valid coastal candidate on the selected island.

## Access roads

If the chosen port tile is not already connected to a road, A* creates a same-island approach road. Traversal cost penalizes:

- Steep slope
- Flood risk
- Forest
- Rivers
- Mountains

Existing road tiles receive a reuse discount.

Every road now stores both `bridgeId` and `portId`. Ordinary roads use `null` for both. This allows partial regeneration to remove only the infrastructure owned by the regenerated system.

## Water cost field

A breadth-first field measures each ocean tile’s distance from land. Vessel routing uses this field together with water depth.

For each edge, the simplified cost is:

```text
1
+ shallow-water penalty
+ open-water exposure penalty
```

Land is impassable. Water below the vessel draft threshold is impassable except at port endpoints.

## Vessel classes

- Small boats accept the shallowest routes and are used for fishing or low-demand links.
- Ferries require deeper channels and serve passenger routes.
- Cargo vessels require the deepest channels and are selected for industrial connections.

## Route demand and selection

All valid port pairs are scored from connected population, capacity, role importance, distance, and bridge competition.

A disjoint-set structure starts with island pairs already connected by bridges. High-scoring routes are then chosen to connect otherwise disconnected components. Additional connections are selected only above a demand threshold.

Custom routes suppress the generated route for the same port pair.

## Travel time

```text
T = boardingMinutes + distanceTiles × tileSizeKm ÷ vesselSpeedKph × 60
```

The editor may override the calculated value without changing the route path.

## Maritime danger

Danger combines:

- Route length
- Average open-water exposure
- Average shallow-water risk

The numeric value is mapped for presentation to low, moderate, high, or severe.

## Encounters

Encounter tables are seeded by route identity. Regenerating the same seed, ports, and route definitions creates the same entries and weights.

DM rolls remain intentionally non-deterministic during play, while the underlying table is deterministic.

## Overrides

Milestone 11 adds:

```ts
PortOverride[]
CustomPortDefinition[]
WaterRouteOverride[]
CustomWaterRouteDefinition[]
```

These live in the same per-world override document as names, zones, anchors, story points, images, islands, and bridges.

## Partial-regeneration ownership

### Starting at bridges

- Old bridge-owned roads are removed.
- Old port-owned roads are also removed because they are downstream.
- Bridges, ports, and routes are rebuilt.

### Starting at ports

- Bridge infrastructure is preserved.
- Port-owned access roads, ports, and routes are removed.
- Ports and routes are rebuilt.

### Starting at water routes

- Roads, bridges, and ports are preserved.
- Only routes and downstream analysis are rebuilt.

This makes regeneration independent of stale editor state.
