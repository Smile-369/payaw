# Milestone 14 — Performance

## Goal

Keep PAYAW responsive at its existing Metro Bacolod-scale world sizes without changing the deterministic output contract or weakening the non-destructive authoring model.

## 1. Optional satellite settlements

`GenerationOptions.satelliteSettlementCount` is resolved to an integer from 0 through 12.

The regional allocation rules are:

1. The primary island always begins with one primary settlement.
2. Other islands begin with zero settlements.
3. Requested satellite settlements are distributed deterministically across viable secondary islands.
4. Remaining satellites are assigned to the primary island when necessary.
5. Explicit per-island settlement-count overrides are applied afterward and remain authoritative.

This means a value of zero produces exactly one generated settlement unless the author explicitly overrides an island's settlement count.

## 2. Worker-backed generation

### Browser flow

```text
Generate command
→ GenerationWorkerClient
→ disposable generation.worker
→ GenerationPipeline
→ structured-cloned SerializedWorld
→ World.fromSerialized
→ renderer cache rebuild
```

The worker runs the same `GenerationPipeline` and the same seeded RNG streams as synchronous generation. It does not use a separate simplified generator.

### Cancellation

Each requested full generation owns an `AbortController`. Aborting:

1. rejects the pending run with `GenerationCancelledError`;
2. terminates the worker immediately;
3. discards any incomplete worker state; and
4. leaves the previous complete world active.

Starting another full generation automatically aborts the prior run.

### Progress

The pipeline exposes stage observers. The worker forwards one progress event after each of the 31 stages, including:

- stage identifier;
- stage index and total;
- stage duration;
- elapsed run time; and
- completion state.

### Fallback

`GenerationWorkerClient` falls back to `GenerationPipeline.generateAsync()` when the Worker API is unavailable. That fallback yields between stages and preserves cancellation checks between stage boundaries.

## 3. Worker serialization

The worker sends `World.toJSON()` plus diagnostics. `World.fromSerialized()` rehydrates the structured-cloned object without executing generation again.

Typed invalid-position failures are serialized with their anchor/settlement/story identity. The main thread reconstructs `InvalidPositionOverrideError`, allowing the existing stale-position recovery loop to continue working with worker generation.

## 4. Raster-layer invalidation

The renderer owns independent one-tile-per-pixel canvases for:

- terrain;
- elevation;
- moisture;
- temperature;
- accessibility;
- land value;
- final zones;
- generated zones;
- zone overrides; and
- flood risk.

`rasterCacheLayersForStage()` maps a partial-regeneration start stage to only the raster layers that can have changed.

Examples:

- Name, building, vegetation, and story changes rebuild no raster canvases.
- Zone overrides rebuild final zones and the override overlay.
- Zoning rebuilds all zone canvases.
- Road, bridge, port, settlement, and regional changes rebuild accessibility, land value, and zone-derived canvases.
- Terrain and hydrology changes rebuild every raster canvas.

## 5. Dense-layer spatial indexing

Buildings and vegetation are inserted into deterministic uniform-grid indexes when the world cache is rebuilt. During rendering, PAYAW queries only grid cells intersecting the visible world bounds.

This avoids scanning all dense point entities on every frame while panning and zooming. The index does not alter generation order, IDs, or serialized output.

## 6. Diagnostics

Generation stage timings are stored in `World.diagnostics` but deliberately excluded from `World.toJSON()` so wall-clock variation cannot affect deterministic project comparisons.

Renderer diagnostics report:

- raster cache build time;
- last render duration;
- visible building count; and
- visible vegetation count.

The UI also derives total generation time and the slowest generation stage.

## 7. Deliberate scope boundaries

Milestone 14 does not replace the world data model with TypedArrays, introduce streamed map chunks, or move partial authoring regeneration into workers. Those changes would require broader compatibility and editing-model work. This release targets the largest current bottlenecks while preserving all existing authoring behavior.
