# Milestone 16.4 — Cross-Island Settlement Reassignment

## Goal

Allow a generated satellite settlement to be moved from its original island to another island without breaking regional ownership, roads, travel routing, zoning, buildings, NPC placement, or JSON persistence.

## Authoring model

The generated settlement key remains unchanged. A manual position override changes its **current island assignment**, not its deterministic identity.

```text
Generated settlement identity
        +
Position and destination-island override
        =
Displayed and simulated settlement
```

This preserves non-destructive editing: deleting the override restores the settlement to its generated island and position.

## Data-model change

`SettlementPositionOverride` now supports an optional stable island key:

```ts
interface SettlementPositionOverride {
  key: string;
  x: number;
  y: number;
  islandKey?: string;
}
```

`islandKey` is optional for backward compatibility. New editor moves always save it.

`Settlement.islandId` is mutable during generation because a manual authoring override may reassign the generated settlement.

## Generation behavior

During `SettlementStage`:

1. The source island still determines the stable settlement key, name stream, type, and population share.
2. The manual tile determines the destination island.
3. The settlement is registered in `targetIsland.settlementIds` rather than the source island.
4. Destination infrastructure is enabled when necessary.
5. Island represented populations are recalculated from their final settlement ownership.
6. Settlement influence masks use the destination island's landmass.

Downstream stages therefore receive a coherent world model without special cross-island exceptions.

## Editor behavior

The drag preview searches all eligible islands rather than only the settlement's current island. It reports the nearest valid tile within the preview radius.

On drop, the editor saves:

- Settlement key
- Tile x/y
- Destination island key

Partial regeneration starts at `settlements`, rebuilding dependent regional systems while preserving terrain and island geometry.

## Safety rules

Cross-island moves are rejected when the target is:

- Ocean or an unregistered landmass
- A river tile
- Mountainous or too steep
- Severely flood-prone
- Too close to another settlement
- A locked island
- A protected-nature island

## Backward compatibility

Older JSON files containing only settlement key and x/y remain valid. The target island is inferred from the tile. A mismatched saved `islandKey` is treated as stale data and recovered using the existing override-recovery system.
