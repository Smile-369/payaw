# Milestone 18 Architecture — Non-Destructive World Authoring

## Core rule

World generation proposes. The GM decides.

Generated objects are not edited in place. The final campaign world is resolved from deterministic generation plus an explicit authoring layer.

```text
GenerationOptions
      │
      ▼
Generated terrain / settlements / roads / buildings
      │
      ├── terrain overrides
      ├── generated-feature suppressions
      ├── generated-settlement overrides
      ├── authored settlements
      └── authored feature geometry
      ▼
Resolved World + renderer customization
```

## Authoring records

### Authored settlements

`AuthoredSettlementDefinition` creates a new settlement that has no generated source. Its stable key is independent of array order and seed regeneration.

### Generated settlement overrides

`SettlementAuthoringOverride` changes generated settlement metadata and transforms or suppresses it. Removing the override restores the generated settlement.

### Terrain overrides

`TerrainTileOverride` targets a deterministic tile index. Terrain overrides are reapplied immediately after terrain generation and before downstream hydrology-dependent and infrastructure-dependent output.

### Generated feature overrides

`GeneratedFeatureOverride` targets a stable generated identity rather than a current array index. Milestone 18 implements suppression for roads and buildings, allowing authored replacements to survive reindexing.

### Authored map features

`AuthoredMapFeature` stores reusable geometry and metadata for campaign-authored map content. Road and river features are rasterized into engine structures. Other feature categories remain renderer-level campaign geometry until a later domain system needs them.

## Pipeline integration

```text
TerrainStage
AuthoringTerrainStage
Regional / settlement stages
RoadStage
GeneratedRoadOverrideStage
AuthoringRoadStage
Bridge and maritime stages
Block / zoning stages
BuildingStage
GeneratedBuildingOverrideStage
Story and NPC stages
```

This ordering ensures:

- Authored terrain affects downstream placement.
- Suppressed generated roads are removed before authored roads are appended.
- Authored roads can participate in routing and tile road state.
- Suppressed buildings are removed after building generation.

## Transform behavior

Authored feature geometry stores source coordinates plus scale and rotation. Translation updates geometry points directly; scale and rotation remain reversible transform metadata applied during rendering and rasterization.

Settlement position and radius affect world generation. Settlement rotation is retained as authored campaign metadata and boundary presentation, allowing later local-layout algorithms to consume the same transform without migrating saved data.

## Persistence

Schema 18 stores authoring data in `StoredMapCustomization.authoringLayer`. The normalizer validates and bounds imported records. Project payloads and local autosaves retain the complete layer.

Older projects import with an empty authoring layer. Legacy settlement-position records remain supported and are kept synchronized when moving generated settlements.

## Undo and restoration

Editor snapshots include both legacy customization records and the authoring layer. Restore behavior depends on source:

- Authored item: remove its definition.
- Generated settlement: remove its override.
- Adopted generated feature: remove the authored replacement and source suppression.
- Terrain: remove the affected tile override.

No restoration operation attempts to reverse-engineer the generated state; it simply exposes the deterministic baseline again.

## Visibility layers

Authoring visibility and reality are separate concerns:

- Visibility: players, GM-only, or hidden.
- Reality: normal world or Hidden Payaw.

The renderer exposes separate normal-authoring and Hidden Payaw layers. Future player projections can filter records server-side without redesigning the map model.

## Infrastructure exception rendering

The live-infrastructure renderer consumes manual and derived status maps separately. At regional zoom it renders only high-signal manual exceptions and major derived closures. Local roads and weather-derived restrictions are progressively disclosed as zoom increases.
