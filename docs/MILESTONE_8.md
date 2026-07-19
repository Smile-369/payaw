# Milestone 8 — Asset, Zone, and Story Authoring

## Goal

Maximize customization without turning generation into destructive editing.

```text
Generated World + Authored Overrides + Presentation Settings = Displayed World
```

## New modules

### `src/customization/AssetTargets.ts`

Defines asset categories and valid target types. The renderer resolves assets by `(targetCategory, targetType)` rather than the Milestone 7 building-only field.

### `src/editor/ZoneEditor.ts`

Pure editor algorithms for:

- circular brush selection
- rectangle selection
- contiguous flood fill
- paint/erase
- lock/unlock
- local zone smoothing

These functions operate on `ZoneOverride[]` records and do not mutate the procedural zoning source.

### `src/engine/zoning/ZoneOverrides.ts`

Resets tiles to `generatedZoneType`, applies authored records, and rebuilds zone entities before buildings are generated.

### `ZoneOverrideStage`

Inserted directly after procedural zoning and before naming/building generation.

## Data model

```ts
interface ZoneOverride {
  tileIndex: number;
  zoneType: ZoneType | null;
  locked: boolean;
}
```

```ts
interface StoryRuleOverride {
  id: number;
  name?: string;
  preferredZone: ZoneType | null;
  allowedZones: readonly ZoneType[];
  disallowedZones: readonly ZoneType[];
  influenceRadius?: number;
}
```

```ts
interface ImportedImageAsset {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  targetCategory: AssetTargetCategory;
  targetType: string | null;
  createdAt: string;
}
```

## Zoning state on each tile

- `generatedZoneType`: untouched procedural result
- `zoneType`: final zone used by buildings and rendering
- `zoneOverrideType`: authored value
- `hasZoneOverride`: distinguishes no override from an explicit no-zone override
- `zoneLocked`: protects the override from normal editing tools

## Story placement scoring

A candidate is rejected when its zone is disallowed or outside a non-empty allowed list. A preferred-zone match adds a deterministic score bonus before seeded tie-breaking.

Manual story movement also validates the story's zone rules.

## Asset rendering

- Building assets are clipped into polygon footprints.
- Story assets replace story markers by type.
- Anchor assets replace anchor markers by type.
- Vegetation assets replace procedural plant symbols by type.
- Road, bridge, street-light, power-pole, bus-stop, waiting-shed, road-sign, bench, and fence targets use deterministic placement hooks.
- Map-only assets remain freely draggable images.

## Building template expansion

Milestone 8 adds residential and commercial authoring targets including malls, cinemas, multiple house types, hotels, offices, factories, and farm houses. Mixed-use zoning can select both residential and commercial-compatible templates.
