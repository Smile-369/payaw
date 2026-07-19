# Milestone 10 — Inter-Island Bridge Network

## Objective

Milestone 10 converts the regional islands introduced in Milestone 9 into a connected road region where suitable island pairs can be joined by real bridge infrastructure.

The milestone preserves three architectural rules:

1. A bridge is a first-class world entity, not a visual road flag.
2. Generated and manually authored bridge state remain separate through overrides.
3. Bridges enter the pipeline before accessibility, blocks, zoning, buildings, and story placement.

## Data model

### `Bridge`

```ts
interface Bridge {
  id: number;
  key: string;
  name: string;

  fromIslandId: number;
  toIslandId: number;

  start: GridPoint;
  end: GridPoint;
  startTileIndex: number;
  endTileIndex: number;

  centerline: readonly GridPoint[];
  deckTileIndices: readonly number[];

  type: BridgeType;
  roadClass: RoadType;
  length: number;
  deckWidth: number;
  clearance: number;

  approachRoadIds: number[];
  deckRoadId: number | null;
  supportPoints: readonly GridPoint[];

  generated: boolean;
  locked: boolean;
}
```

### Override types

`BridgeOverride` changes or suppresses a generated/custom bridge without modifying its procedural definition.

`CustomBridgeDefinition` creates an authored bridge between two island keys. A custom island-pair bridge takes priority over an automatic bridge for the same pair.

### Road ownership

Every `Road` now has:

```ts
bridgeId: number | null;
```

Normal town roads use `null`. Bridge decks and approaches reference their owning bridge. This lets partial regeneration remove only bridge infrastructure while preserving the original intra-island road network.

## Candidate generation

For every eligible island pair:

1. Sample coastline tiles to bound comparison cost.
2. Compare coast points inside the permitted span range.
3. Rasterize a direct centerline between endpoints.
4. Reject candidates whose interior intersects land.
5. Reject candidates that cross a third island.
6. Calculate water depth and road-access cost.
7. Score the candidate and retain the best crossing for that pair.

A candidate has benefit:

```text
log(1 + connected population)
+ primary-settlement importance
+ port-hub importance
```

and cost:

```text
span length
+ average depth
+ endpoint slope
+ approach-road distance
+ bad shoreline-facing penalty
```

The final ranking uses:

```text
candidate score = benefit - cost
```

All loops use deterministic ordering and stable tie-breaks.

## Regional bridge selection

Candidate island pairs are sorted by score. A disjoint-set structure selects a minimum connectivity backbone without cycles, similar to Kruskal's minimum-spanning-tree pass.

After that backbone, the engine may add a configured number of extra high-score links when they connect island pairs not already joined directly.

This avoids both extremes:

- Connecting every island to every other island
- Leaving the region as an arbitrary collection of disconnected pair bridges

## Bridge type inference

The engine infers bridge type from:

- Span length
- Average water depth
- Combined connected population

Short shallow crossings may become causeways. Small low-demand crossings can become footbridges or local bridges. Longer high-demand crossings become highway or long-span bridges.

Manual definitions and overrides can replace the inferred type.

## Approach roads

For each coast endpoint, PAYAW finds the closest usable road tile on the same island. When no road exists, it falls back to a settlement center.

A* routes an approach using the same costs as town-road generation:

- Slope
- Flood risk
- Mountain penalty
- Forest penalty
- River-crossing penalty
- Existing-road discount

The deck is then committed as a distinct road containing water tiles marked with both `road` and `bridge`.

## Partial regeneration

`GenerationPipeline.regenerateFrom(world, 'bridges', options)` performs:

```text
Remove bridge-owned roads and deck flags
→ Restore base intra-island roads
→ Rebuild custom and generated bridges
→ Accessibility
→ Blocks
→ Land value
→ Zoning
→ Buildings
→ Vegetation
→ Story layer
```

This avoids rerunning terrain, erosion, hydrology, landmass detection, island classification, settlements, anchors, or the base road network.

## Editor integration

Bridge editing is stored in the same non-destructive customization snapshot as zoning, names, anchors, story points, and placed images.

Supported actions:

- Add custom bridge
- Edit generated or custom bridge properties
- Adjust endpoints using map coordinates that snap to coastlines
- Suppress a generated bridge
- Delete a custom bridge
- Lock bridge state
- Reset one or all bridge overrides
- Undo and redo
- Export and import overrides

## Rendering

The bridge renderer draws:

- Deck centerline
- Width based on deck width and camera zoom
- Repeated support markers
- Independent labels

Ordinary road rendering skips bridge-owned roads to prevent double drawing. Bridge labels are similarly independent from street labels.

## Schema

Milestone 10 increments `World.metadata.schemaVersion` to `10` and adds serialized bridge entities and island bridge references.
