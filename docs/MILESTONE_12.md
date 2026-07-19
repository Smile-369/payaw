# Milestone 12 — Metro-Scale Regional Controls

## Goals

Milestone 12 makes the regional layout itself authorable before the mobility milestones begin.

The release adds four related capabilities:

1. A real-world distance scale suitable for a Metro Bacolod-sized region.
2. User-defined island count and approximate island spacing.
3. Non-destructive movement of satellite settlements.
4. Import and restoration of PAYAW JSON projects.

## World scale

`GenerationConfig.world.tileSizeMeters` is fixed at 125 meters. World metadata exports both the tile scale and derived physical dimensions:

```ts
interface WorldMetadata {
  schemaVersion: 12;
  tileSizeMeters: number;
  worldWidthKilometers: number;
  worldHeightKilometers: number;
  targetIslandCount: number;
  islandSpacingKilometers: number;
}
```

The simulation grid remains unchanged, so the larger conceptual scale does not multiply terrain, hydrology, road, or building workloads.

## Island planning

Archipelago and Twin Islands use a deterministic island plan before heightmap sampling.

For each planned island, the engine selects an elliptical center and radius. Candidate centers are evaluated using the coastline-to-coastline gap:

```text
edge gap = center distance − first island radius − second island radius
```

The requested kilometer gap is converted to tiles:

```text
gap tiles = requested kilometers / tile size in kilometers
```

At 125 meters per tile:

```text
4 km = 32 tiles
```

If the requested count and gap cannot fit, spacing is reduced over bounded retries. The generator does not silently remove requested islands. It reports an error only if even the minimum fallback cannot fit the requested count.

## Regional role allocation

The old conservative island classifier could turn nearly every secondary island into protected nature. Milestone 12 reserves the highest-ranked viable secondary islands for regional communities before applying the ecological fallback.

The number of preferred developed secondary islands depends on town scale:

```text
Rural      1
Semi-urban 2
Urban      3
```

A secondary island still needs minimum area and buildable land. Its final role can become Satellite Town, Port Hub, or Rural Village according to buildability, freshwater, and coastal characteristics.

## Movable satellite settlements

`SettlementPositionOverride` is keyed by stable settlement identity:

```ts
interface SettlementPositionOverride {
  key: string;
  x: number;
  y: number;
}
```

Only non-primary settlement centers accept manual positions. The primary settlement remains controlled through the Town Plaza anchor so two independent overrides cannot fight over the Poblacion center.

Validation requires the new point to:

- Remain on the assigned island and landmass
- Be dry land and not a river tile
- Avoid mountain terrain
- Stay within slope and flood limits
- Remain separated from other settlements

An invalid old override is automatically removed during full generation through the existing stale-position recovery mechanism.

## Project JSON

World export now writes a project envelope alongside the serialized generated world:

```json
{
  "format": "payaw-project",
  "projectVersion": 1,
  "project": {
    "seed": "payaw-001",
    "profile": {},
    "authoring": {}
  },
  "metadata": {},
  "tiles": []
}
```

Import supports both the project envelope and older raw world JSON that still contains a seed and metadata.

The importer performs these steps:

1. Enforce the 64 MB file limit.
2. Parse and classify the JSON format.
3. Reject schema versions newer than 12.
4. Normalize the generation profile.
5. Normalize anchor, story, label, name, and map customization records.
6. Validate and store embedded image assets.
7. Regenerate from the imported seed and profile.
8. Reapply normalized authoring data.
9. Run stale-position recovery if geography changed.

The import UI accepts file selection and drag-and-drop. Override-only files are auto-detected and routed to the existing override importer.

## Persistence identity

Customization storage is keyed by:

```text
seed
+ terrain size
+ town scale
+ terrain shape
+ climate
+ island count
+ island spacing
```

This prevents an authored six-island layout from accidentally sharing moved objects with a five-island layout using the same seed.
