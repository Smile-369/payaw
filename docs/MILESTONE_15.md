# Milestone 15 — Studio UI/UX

## Goal

Turn PAYAW from a feature-dense procedural editor into a coherent world-building studio without changing its deterministic generation contract.

The release keeps the existing separation:

```text
Deterministic Generated World
        +
Non-destructive Override Layer
        +
Presentation / Workspace Layer
        =
Displayed and Authored World
```

Milestone 15 changes the workspace and project interaction layer. Terrain, hydrology, transport, settlement, story, and renderer generation remain deterministic.

## Workspace architecture

```text
Left Authoring Panel
│
├── World Editor
└── DM Mode

Central Viewport
│
├── Map toolbar
├── Canvas renderer
├── Minimap
└── Status bar

Right Studio Dock
│
├── Inspector
├── Layers
└── Project / Recovery
```

Both side panels can be hidden independently. Their state persists through `localStorage`.

## Inspector

A click on the map resolves a tile-centered selection. The inspector gives a single view of connected data rather than opening several unrelated editors.

Displayed properties include:

- Coordinates
- Terrain and elevation
- Slope and moisture
- Flood risk
- Final zoning
- Island and settlement
- Road and block
- Building
- Anchor
- Story site

Selection priority for the inspector title is:

```text
Story site
→ Anchor
→ Settlement
→ Road
→ Block
→ Terrain tile
```

The selection can be focused from the Inspector, the command palette, or the `F` shortcut.

## Layer manager

The right-side manager mirrors the canonical layer checkboxes already used by the renderer. It does not create a second visibility state.

```text
Studio toggle
→ canonical layer input
→ existing change event
→ renderer LayerVisibility
```

This preserves existing label-setting behavior and view presets.

Groups:

- Base
- Planning
- Region
- Infrastructure
- World objects

## Minimap

The minimap builds a cached low-resolution terrain representation whenever a complete world is loaded or generated.

Each animation frame overlays:

- Current camera viewport
- Current inspector selection

Clicking the minimap focuses the camera at the corresponding world coordinate while preserving zoom.

## Command palette

Commands are data-driven definitions containing:

```ts
interface CommandDefinition {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  run: () => void | Promise<void>;
}
```

Search is intentionally local and deterministic. No network or AI service is required.

## Autosave and recovery

The recovery snapshot is a compact PAYAW project envelope containing:

- Seed
- Generation profile
- Anchor authoring
- Story authoring
- Names and labels
- Map customization overrides
- Placed-image references

Embedded image data is not duplicated in `localStorage`; imported assets remain in the existing asset repository.

Autosave occurs:

- Shortly after authoring history changes
- After full/partial world refresh
- Every 30 seconds
- Best-effort during `beforeunload`

Restore reuses the canonical project importer by constructing an in-memory JSON `File`. This ensures recovery receives the same schema validation and normalization as a user-imported project.

## Recent worlds

Recent entries store only profile-level information:

- Seed
- Layout
- Terrain extent
- Town scale
- Climate
- Island controls
- Satellite count
- Last-opened timestamp

This keeps the list small and makes reopening deterministic.

## Themes

Themes are presentation-only and use `data-theme` on the root HTML element:

- `dark`
- `light`
- `contrast`

The renderer's world palette is not modified by UI appearance.

## Compatibility

- World schema: 15
- Generation version: `payaw-m15-studio-ui-v1`
- Project importer maximum supported schema: 15
- Older project normalization remains intact
- Milestone 14 worker protocol is unchanged
