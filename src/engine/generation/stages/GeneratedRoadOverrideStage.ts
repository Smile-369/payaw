import type { GeneratedFeatureOverride } from '../../../authoring/AuthoringLayer';
import type { Road } from '../../infrastructure/Road';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

function overrideFor(
  overrides: readonly GeneratedFeatureOverride[],
  id: number,
): GeneratedFeatureOverride | undefined {
  return overrides.find((override) => override.entityType === 'road' && override.entityId === id);
}

export class GeneratedRoadOverrideStage implements GenerationStage {
  public readonly id = 'generated-road-overrides';

  public run({ world, options }: GenerationContext): void {
    const kept: Road[] = [];
    for (const road of world.roads) {
      const override = overrideFor(options.generatedFeatureOverrides, road.generatedId ?? road.id);
      if (override?.suppressed === true || override?.hidden === true) continue;
      const generatedId = road.generatedId ?? road.id;
      kept.push({
        ...road,
        id: kept.length,
        generatedId,
        source: road.source ?? 'generated',
        name: override?.name?.trim() || road.name,
      });
    }

    for (const tile of world.tiles) {
      tile.road = false;
      tile.roadId = null;
      tile.bridge = false;
    }
    world.roads = kept;
    for (const road of kept) {
      for (const tileIndex of road.path) {
        const tile = world.tiles[tileIndex];
        if (tile === undefined) continue;
        tile.road = true;
        tile.roadId ??= road.id;
      }
    }
  }
}
