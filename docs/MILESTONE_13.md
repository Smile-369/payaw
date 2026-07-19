# Milestone 13 — World Layout Presets

PAYAW now exposes eight authored world layouts in the generation panel:

- Single Small Island
- Single Medium Island
- Single Large Island (default)
- Archipelago
- Twin Islands
- Peninsula
- Inland Coast
- Delta

The three single-island choices change the physical footprint of the generated landmass without changing the regional map extent. This lets a 32×24 km Metro-scale canvas contain either a compact island municipality or a large regional island.

Archipelago retains the editable 2–12 island count and spacing controls. Twin Islands fixes the requested count to two. Island count and spacing inputs are disabled for layouts where they do not apply.

Older JSON values are migrated safely:

- `full-island` → `single-large-island`
- `inland` → `inland-coast`
- `river-delta` → `delta`
- `atoll` → `single-medium-island`

The underlying landmasses remain procedural and are not manually movable. Satellite settlements remain movable through non-destructive settlement position overrides.
