# Milestone 8.1 — Editor Core, Image Export, and Encounters

## Goal

Make repeated authoring safe and fast while moving story creation out of TypeScript and into the browser UI.

## Undo/redo architecture

`HistoryManager<T>` stores bounded snapshots of editor state. A snapshot contains custom anchors, anchor overrides, custom story definitions, names, label settings, zone edits, entity positions, story rules, and placed-image transforms.

It deliberately excludes full terrain, climate, hydrology, roads, blocks, buildings, and imported binary image data. Restoring a snapshot reapplies the lightweight override layer and deterministically regenerates the necessary derived world.

New edits clear the redo stack. The default limit is 64 snapshots.

## Partial regeneration

`GenerationPipeline.regenerateFrom(world, stageId, options)` resolves the current generation profile, recreates the root seeded random stream, and reruns the selected stage and every downstream stage using the same stage-specific random forks as a full generation.

This preserves deterministic equivalence while avoiding unrelated expensive work. The focused test verifies that rerunning only `story-layer` produces the same story-object output as a full generation with the same options.

## Rendering optimization

The canvas renderer now:

1. Caches category/type asset lists when the runtime asset array changes.
2. Calculates visible world bounds from camera translation, zoom, and viewport dimensions.
3. Skips off-screen buildings, vegetation, placed images, labels, anchors, and story markers.
4. Reuses rasterized terrain, elevation, moisture, temperature, accessibility, land-value, zoning, and flood layers.
5. Coalesces browser redraws through the existing animation-frame request loop.

PNG export uses a detached renderer with bounds covering the complete world, so viewport culling does not omit exported content.

## PNG export

`CanvasRenderer.exportPng()` creates a detached canvas and renderer, copies layer visibility and render customization, fits the complete world at a selected pixels-per-tile scale, and encodes the result as `image/png`.

The exporter supports padding and has a 120,000,000-pixel safety cap. Editor-only overlays are disabled by default.

## Custom story definitions

`CustomStoryPointDefinition` is serializable editor data with:

- stable id and name
- archetype
- regional and terrain preferences
- zoning constraints
- influence radius and minimum spacing
- optional wish and manifestation
- optional encounter entries

The Story Stage appends these definitions after the six required PAYAW story sites. Each custom point receives a stable key:

```text
custom-story:<definition-id>
```

Position and rule overrides match by key, avoiding breakage when story-array indices change.

## Encounter generation

Each story object stores `StoryEncounterDefinition[]` entries with a title, description, weight, and danger level.

When no authored entries are provided, `generateEncounterTable()` combines common encounter templates with archetype-specific templates and selects up to six entries through a forked deterministic random stream.

At play time, `pickWeightedEncounter()` maps a random value in `[0,1)` across cumulative non-negative weights. The browser uses `crypto.getRandomValues()` for each roll, while the encounter table itself remains reproducible from the world seed.

## Persistence

Custom story definitions are stored in localStorage and included in:

- history snapshots
- portable override export/import
- full World JSON export
- generation options

No source-code edits are required to add, edit, move, remove, skin, or populate a story point with encounters.
