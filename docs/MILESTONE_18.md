# Milestone 18 — World Authoring

## Product goal

The generated world is a draft. The GM can author the campaign world without destroying the seeded baseline or being forced to regenerate unrelated systems.

## Delivered systems

### 1. Authoring state

`AuthoringLayerState` stores:

- Authored settlements
- Overrides for generated settlements
- Tile-level terrain overrides
- Stable overrides for generated features
- Authored map features

The layer is included in local customization storage, autosaves, project exports, imports, history snapshots, and the renderer customization state.

### 2. Settlement authoring

The editor supports city, town, barangay, subdivision, neighborhood, village, sitio, district, compound, and custom settlement kinds.

A settlement record contains:

- Stable key
- Name and kind
- Exact map position
- Influence radius
- Rotation metadata
- Population target and density
- Parent settlement key
- Local-road and building-generation flags
- Lock, hidden, and visibility state
- GM notes

Generated settlements use override records. Manually created settlements use authored definitions. Both resolve into the same world settlement model.

The GM can create, duplicate, move, rename, resize, rotate, convert, nest, hide, lock, suppress, and restore settlements. Cross-island movement transfers island ownership and activates destination infrastructure when needed.

### 3. Terrain authoring

Tile overrides are applied after deterministic terrain generation and before regional infrastructure. Supported operations are raise, lower, absolute elevation, smooth, paint, river carve, river erase, and restore.

An override may alter terrain, water class, elevation, moisture, forest density, flood risk, or river presence. Removing it restores the original generated tile on the next terrain regeneration.

### 4. Authored feature geometry

A feature may be a point, circle, polyline, or polygon. Transform data is non-destructive and includes scale and rotation. Common metadata includes category, subtype, names, aliases, notes, reality layer, visibility, style, lock, and hidden state.

Categories:

- Terrain
- River
- Road
- Building
- District
- Landmark
- Infrastructure
- Natural
- Label
- Hidden Payaw

Road and river categories participate in generation. Other categories remain authoritative campaign geometry rendered over the generated map.

### 5. Generated feature adoption

Generated roads and buildings expose stable `generatedId` values. Adopting one creates an authored replacement and a suppression override for the source. Reset removes both the authored replacement and source suppression.

This gives the GM a safe edit workflow without mutating or losing deterministic generator output.

### 6. Regeneration behavior

Terrain changes regenerate from the terrain stage. Road changes regenerate from the road-network stage. Building source suppression regenerates from the building stage. Settlement edits regenerate from the settlement stage.

Unrelated upstream generation remains intact. Authored data is reapplied after regenerated data.

### 7. History and reset

Undo/redo snapshots include the authoring layer. Any authored feature can be hidden, locked, duplicated, moved, deleted, or reset. Generated features return to their deterministic state when their override is removed.

### 8. Hidden Payaw

Hidden Payaw features share the authored-feature model but use a separate reality layer and renderer layer. They do not modify normal-world terrain or routing unless deliberately authored as normal-world features.

### 9. Infrastructure status UX

Infrastructure state is displayed as a selective exception overlay. Manual GM exceptions are prominent at all useful zooms. Derived weather warnings are hidden at regional overview and progressively revealed when zooming closer. The layer starts disabled.

## Editor workflow

1. Generate a world.
2. Open **World authoring**.
3. Select a tool: Select, Settlement, Point, Path, Area, or Terrain brush.
4. Create or select a world item.
5. Change properties or drag it on the map.
6. Lock completed work if needed.
7. Restore an item to expose the generated baseline.
8. Toggle Hidden Payaw separately from the normal authoring layer.

## Definition of done

Milestone 18 is complete when:

- Authored settlements can coexist with generated settlements.
- Generated settlements can be moved across islands without losing ownership or infrastructure.
- Terrain edits survive save/load and restore cleanly.
- Authored roads and rivers are applied at the correct pipeline stages.
- Generated roads and buildings can be replaced and restored by stable identity.
- All authoring categories render, persist, and support visibility and history.
- Hidden Payaw remains a separate map layer.
- The infrastructure exception overlay remains readable at regional scale.
