# PAYAW Procedural World Engine — Milestone 12

Milestone 12 expands PAYAW into a Metro Bacolod-scale regional generator with authored island count and spacing, movable satellite settlements, portable project JSON, bridges, ports, and water routes.

## Regional scale

PAYAW now uses a fixed scale of **125 meters per tile**.

| Terrain extent | Tiles | Approximate regional size |
|---|---:|---:|
| Small | 256×192 | 32×24 km |
| Medium | 320×240 | 40×30 km |
| Large | 384×288 | 48×36 km |

This is intended as a regional planning scale comparable to a Metro Bacolod-sized play area rather than a single compact town map.

## Island controls

When using **Archipelago**, the World Foundation panel exposes:

- Major island count: 2–12
- Approximate minimum island spacing: 0.5–12 km

Twin Islands is fixed to two islands but still allows spacing control. The generator treats island count as the stronger constraint and progressively relaxes spacing only when the requested layout cannot physically fit inside the selected terrain extent.

## Regional settlement behavior

Archipelagos reserve viable high-ranked secondary islands for satellite communities before ecological classification. This prevents every non-primary island from becoming protected wilderness.

Regional town scale influences how many secondary islands are developed:

- Rural: one preferred secondary community
- Semi-urban: two preferred secondary communities
- Urban: three preferred secondary communities

Satellite settlements can be moved directly in **Object editing** mode. Position overrides must remain on the settlement's assigned island, on dry land, below slope and flood limits, and far enough from another settlement center. The primary Poblacion remains aligned to the Town Plaza anchor.

## JSON import and export

The Project Output section now includes a dedicated **Import Project JSON** control and drag-and-drop area.

Supported files:

- `payaw-project` full project exports
- Serialized PAYAW world JSON containing a seed and metadata
- `payaw-world-overrides` customization exports

A full project import restores:

- Seed
- Terrain size and town scale
- World shape and climate
- Island count and spacing
- Custom and edited anchors
- Custom story points and encounter tables
- Moved anchors, settlements, and story sites
- Zone overrides
- Road and block names
- Label controls
- Island, bridge, port, and water-route overrides
- Placed images
- Embedded imported image assets

Import is validation-first. PAYAW rejects future schema versions, malformed files, unsupported formats, and project JSON above 64 MB. The world is regenerated from its deterministic seed and profile, then validated authoring data is reapplied. Imported tile arrays are not trusted as mutable engine state.

## Existing systems included

Milestone 12 retains:

- World Editor and separate DM Mode
- Undo and redo
- Asset targeting and freeform map images
- Zone editor
- Editable road and block names
- Label controls
- Custom story points and weighted encounters
- Island editor
- Procedural and custom bridges
- Procedural and custom ports
- Ferry and water-route editing
- Full-map PNG export
- World and override JSON export
- Automatic stale-position recovery

## Run

```bash
corepack enable
pnpm install
pnpm dev
```

## Validate

```bash
pnpm check
pnpm test:ms9
pnpm test:ms10
pnpm test:ms11
pnpm test:ms111
pnpm test:ms12
pnpm build
```

See `docs/MILESTONE_12.md` and `docs/VALIDATION_12.md` for implementation and validation details.
