# Milestone 9 — Regional World Foundation

## Objective

Milestone 9 removes the assumption that all meaningful development belongs to one connected landmass. It introduces a regional layer between physical terrain and urban generation:

```text
Tile grid
→ physical landmasses
→ gameplay islands
→ settlements
→ regional transport demand
→ detailed town systems
```

Bridges and maritime routes are deliberately deferred. This milestone establishes the data identities and generation dependencies they will require.

## Domain separation

### Landmass

A landmass is a physical connected component of land tiles. It is descriptive and does not imply settlement, population, or gameplay importance.

`LandmassDetector` uses deterministic four-neighbor flood fill, then computes:

- Tile and coastline membership
- Simplified coastline samples
- Bounds and centroid
- Physical averages
- Freshwater score
- Buildable area

Every land tile belongs to exactly one landmass.

### Island

An island is a gameplay entity promoted from a viable landmass. It stores development policy and regional allocation state. Tiny rocks, sandbars, and insignificant fragments may remain unpromoted.

An island's stable key derives from its landmass key, allowing edits to survive deterministic regeneration of the same world identity.

### Settlement

A settlement is a populated center belonging to one island. An island can contain zero, one, or multiple settlements. This prevents future bridge and ferry logic from incorrectly treating “island” and “town” as interchangeable.

## Island viability

Viability combines normalized area, buildable-land ratio, freshwater, useful coastline, slope, and flood safety:

```text
viability =
  area scale       × 0.31
+ buildable ratio  × 0.34
+ freshwater       × 0.13
+ coastline value  × 0.08
+ slope safety     × 0.09
+ flood safety     × 0.05
```

The largest viable candidate becomes the default primary island. Other roles are selected from size, buildability, moisture, forest cover, freshwater, and coastline characteristics.

## Population model

Regional population budgets currently use:

- Rural: 4,800
- Semi-urban: 22,000
- Urban: 78,000

The primary-island share is:

- Rural: 72%
- Semi-urban: 64%
- Urban: 56%

Remaining population is distributed by:

```text
viability^1.25 × role weight × author population weight
```

Every allocation is capped by island population capacity. Capacity derives from buildable area and viability.

## Settlement placement

Settlement candidates must be:

- On the assigned island
- Dry land and outside river channels
- Below slope and flood limits
- Sufficiently separated from already selected centers

Candidate scoring considers flatness, dryness, centrality, coastline suitability, role-specific terrain, settlement separation, and deterministic seeded variation.

The primary settlement is aligned to the generated town plaza after anchor placement so the established PAYAW town center remains authoritative.

## Road and urban integration

Milestone 9 adds two settlement road passes:

1. **Same-island settlement connection** — a minimum-distance tree connects multiple settlements on one island using the existing terrain-aware pathfinder.
2. **Settlement backbones** — each settlement grows one or more local/secondary spurs within its influence area.

Downstream changes:

- Settlement centers seed accessibility propagation.
- Block masks include settlement influence regions.
- Zoning responds to island roles and preservation rules.
- Place naming recognizes settlement names.
- Story candidates require island story permission.

Roads never cross open water in Milestone 9. Inter-island bridges are a separate first-class system planned for Milestone 10.

## Editor and override model

`IslandOverride` supports:

```ts
interface IslandOverride {
  key: string;
  name?: string;
  role?: IslandRole;
  developmentLevel?: DevelopmentLevel;
  populationWeight?: number;
  settlementCount?: number;
  allowBridges?: boolean;
  allowPorts?: boolean;
  allowRoads?: boolean;
  allowStoryPoints?: boolean;
  preserveNature?: boolean;
  locked?: boolean;
}
```

Overrides are stored alongside the existing map customization state. They participate in:

- Undo and redo
- Local persistence
- Portable override export/import
- Partial regeneration beginning at the `islands` stage

Changing an island plan reruns islands, settlements, anchors, roads, zoning, buildings, vegetation, and story while preserving terrain and hydrology.

## Schema additions

`World` now exports:

- `landmasses`
- `islands`
- `settlements`

Tiles now carry:

- `landmassId`
- `islandId`
- `settlementId`

Roads may carry `connectsSettlementIds`.

The World JSON schema version is **9** and the generation version is `payaw-m9-regional-world-v1`.

## Terrain-shape correction

The previous archipelago macro masks overlapped enough to frequently merge into one physical landmass after terrain processing. Milestone 9 separates the archipelago and twin-island masks while leaving the default Full Island algorithm unchanged.

This gives the regional system actual distinct islands without changing existing default PAYAW elevation compatibility.

## Deferred systems

The following controls are intentionally preparatory metadata in Milestone 9:

- Allow ports
- Allow future bridges

Actual bridge entities, approach roads, ports, water navigation, ferries, and shipping routes belong to Milestones 10 and 11.
