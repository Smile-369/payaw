# PAYAW Procedural World Engine — Milestone 14

Milestone 14 is the performance release for PAYAW's Metro Bacolod-scale regional editor. It keeps the deterministic generation and non-destructive authoring model from Milestone 13, while moving full-world generation off the browser's UI thread and reducing unnecessary render work.

## What changed

### Optional satellite settlements

The **Satellite Towns** setting now accepts **0–12**.

- `0` generates only the primary settlement/Poblacion.
- Higher values deterministically allocate satellite settlements across viable islands and the primary landmass.
- Manual per-island settlement-count overrides still take priority.
- Existing movable-settlement overrides and stale-position recovery remain supported.

### Background generation

User-triggered full generation runs in a dedicated Web Worker.

- The editor remains responsive while terrain, hydrology, settlements, roads, buildings, and story layers are generated.
- The progress display reports all 31 deterministic generation stages.
- **Cancel** immediately terminates the active worker.
- A cancelled run leaves the previously completed world active.
- Browsers without Worker support use the scheduled main-thread fallback.

Initial startup generation remains synchronous so the editor always opens with a complete valid world. Later full regenerations use the worker.

### Renderer optimization

- Raster layers are cached independently.
- Partial regeneration invalidates only raster layers affected by the changed generation stage.
- Building and vegetation drawing use a deterministic uniform-grid spatial index.
- Dense point layers query the visible viewport instead of scanning every object each frame.
- Render diagnostics expose cache-build time, last-frame render time, and visible object counts.

### Performance diagnostics

The World Foundation panel includes live values for:

- Total generation time
- Slowest generation stage
- Raster-cache rebuild time
- Last render time
- Visible buildings
- Visible vegetation

## Regional scale

The physical map scale remains **125 meters per tile**.

| Extent | Grid | Approximate size |
|---|---:|---:|
| Small | 256×192 | 32×24 km |
| Medium | 320×240 | 40×30 km |
| Large | 384×288 | 48×36 km |

**Single Large Island** remains the default world layout.

## World layouts

- Single Small Island
- Single Medium Island
- Single Large Island
- Archipelago
- Twin Islands
- Peninsula
- Inland Coast
- Delta

Archipelago retains the authored 2–12 island count and island-spacing controls. PAYAW does not provide finished-landmass dragging; macro geography is regenerated coherently from the selected layout and seed.

## JSON compatibility

Project JSON export/import includes the satellite settlement count and all previous authoring data. PAYAW accepts projects through schema version 14 and migrates older supported layout names.

## Run locally

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run check
npm run test:ms14
npm run build
```

Additional regression scripts are available as `test:ms13`, `test:ms12`, `test:ms111`, `test:ms11`, `test:ms10`, `test:ms9`, `test:ms82`, `test:ms81`, and `test:ms8`.

## Architecture notes

See:

- `docs/MILESTONE_14.md`
- `docs/VALIDATION_14.md`
- `docs/MS14_TEST_RESULTS.json`
