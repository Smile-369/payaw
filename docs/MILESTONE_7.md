# Milestone 7 design

## Macro terrain masks

The base FBM elevation remains unchanged for the Full Island preset. Other shapes blend FBM detail with analytic ellipse and continental masks. This creates recognizable macro geography while retaining seeded local coast detail.

## Climate profiles

Climate profiles override the base temperature, moisture, ocean moisture, eastern rainfall, and farmland forest-reduction coefficients. The climate stage also varies latitude cooling and mountain rainfall by preset.

## Robust extreme-world generation

Archipelago and delta profiles loosen airport constraints. If a strict airport candidate is impossible, generation selects the safest and flattest separated land tile on the town landmass. Story locations retain their preferred scoring rules but use a dry-land fallback when extreme geography makes a required landmark impossible.

## Non-destructive editor model

Milestone 7 keeps all existing object movement, imported images, building skins, names, and label settings in override storage. Resetting an override restores the procedural result.

## Next editor expansion

Brush-based terrain sculpting, road-node drawing, polygon block editing, and painted generation constraints require a dedicated command/history system and are intentionally not represented as completed features in this release.
