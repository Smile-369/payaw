# Milestone 6.1 implementation

## Profile system

Terrain extent and settlement density remain independent generation options.

| Terrain preset | Dimensions | Tiles |
|---|---:|---:|
| Small | 256×192 | 49,152 |
| Medium | 320×240 | 76,800 |
| Large | 384×288 | 110,592 |

Town scale changes secondary and local road counts, town radius, maximum block reach, commercial thresholds, building occupancy, and vegetation intensity. It does not alter heightmap dimensions.

## Anchor editing and movement

Built-in and custom anchors share the editable rule vocabulary:

- Region preference
- Terrain preference
- Target anchor
- Proximity band
- Influence radius
- Minimum spacing
- Zoning influence

Milestone 6.1 also supports explicit world-space position overrides. Dragging an anchor regenerates all downstream settlement systems. Manual positions persist per world signature and can be reset independently from placement rules.

## Visual assets

The asset repository is browser-side IndexedDB. Generated building data remains asset-agnostic. The renderer selects imported images by `BuildingType`, clips them to generated footprint polygons, and preserves fallback procedural colors when no image is assigned.

Freeform images are stored as separate placed-image overlay records. They can be dropped, dragged, resized, rotated, faded, focused, or removed without mutating the generated tile grid.

## Place naming

Road and block names are generated deterministically after zoning. Main roads derive names from connected anchors; secondary and local roads use deterministic local name pools. Blocks use zone type and nearby anchors. User overrides are keyed by entity ID and persisted per world signature.

Road labels now render at approximately seven screen pixels and are progressively revealed by road class and zoom level.

## Story layer

Every world generates three Balete Trees, Old School, Abandoned Cinema, and Old Cemetery. Candidate scoring remains procedural unless a `StoryPositionOverride` is present.

## Pipeline

```text
Terrain and erosion
→ Hydrology and carved rivers
→ Anchor rules + manual positions
→ Roads and bridges
→ Accessibility
→ Blocks
→ Land value
→ Zoning
→ Naming
→ Buildings
→ Vegetation
→ Story rules + manual positions
→ World
→ Renderer building skins + placed image overlays
```
