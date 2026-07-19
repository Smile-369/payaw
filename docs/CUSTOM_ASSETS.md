# Asset and spatial customization

## Asset library

Image assets are stored in IndexedDB under the `payaw-custom-assets` database. This avoids the small storage limits of `localStorage` and keeps binary image data out of the deterministic generator.

Each asset contains:

- Stable asset ID
- Display name
- MIME type
- Data URL
- Optional generated-building assignment
- Import timestamp

Assignments target a `BuildingType`. If several assets target the same type, the renderer selects one using `building.id % assignedAssetCount`; the visual result is therefore stable for a generated World.

## Map images

A placed image stores:

- Asset ID
- World-space center position
- Width and height in tiles
- Rotation in radians
- Opacity
- Z-order

Placed images are customization overlays and do not occupy tiles or affect pathfinding, zoning, buildings, or vegetation.

## Dragging anchors

Anchor dragging is not a renderer-only offset. The selected tile is stored as an `AnchorPositionOverride` and the generation pipeline runs again. The anchor generator validates that the tile is dry land. Non-plaza anchors must remain on the town plaza's connected landmass. All later stages consume the moved anchor.

```text
Anchor position override
→ anchor placement
→ road network
→ accessibility
→ blocks
→ land value
→ zoning
→ naming
→ buildings
→ vegetation
→ story layer
```

If a drop creates an invalid or disconnected world, the application restores the previous position and reports the error.

## Dragging story locations

Story movement uses `StoryPositionOverride`. Manual locations must be on dry land. Wishes and manifestations remain deterministic, while the selected position overrides candidate scoring.

## Persistence

Manual positions and placed images are keyed by:

```text
seed | terrain size | town scale
```

Road and block naming use the same world signature. Imported assets are global to the browser asset library and can be reused across worlds.

## Export

The JSON export contains the complete serialized World plus a `customization` object containing:

- Anchor position overrides
- Story position overrides
- Placed image records
- Imported image assets and data URLs

Exports containing many large images can be substantially larger than normal World JSON files.
