# Anchor editor

The in-app editor exposes the engine's deterministic anchor-placement rules for both built-in and custom anchors.

## Editable fields

### Region

- Anywhere suitable
- Town center
- North
- South
- East
- West

### Terrain

- Safe buildable land
- Flat land
- Near coast
- Near river
- Forest edge
- Farmland
- High ground
- Low flood risk

### Relationship

An anchor can target another built-in anchor using one of four distance bands:

- Adjacent
- Near
- Outskirts
- Far

The relationship contributes to candidate scoring rather than forcing a hard coordinate.

### Zoning influence

An anchor may influence its surrounding generated zone as:

- None
- Commercial
- Residential
- Industrial
- Agricultural
- Institutional
- Government
- Forest

The influence radius is the same configurable radius used by the anchor rule. Anchor-controlled tiles are protected from normal zone smoothing.

## Built-in anchors

Select any existing anchor from the editor to change its display name, region, terrain rule, relationship, radius, spacing, or zoning influence. Reset restores the default engine definition. Built-in anchors cannot be removed because they are required by the settlement pipeline.

## Custom anchors

Custom anchors can be added and removed. They join the same anchor graph as required locations, receive road connectivity, affect zoning when configured, and serialize into the World object.

## Determinism and persistence

Rule definitions use stable IDs as RNG namespaces. The same seed, generation profile, and rule definitions reproduce the same result. Browser edits persist through `localStorage`.
