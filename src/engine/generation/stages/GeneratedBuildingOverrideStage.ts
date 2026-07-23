import type { GeneratedFeatureOverride } from '../../../authoring/AuthoringLayer';
import type { Building } from '../../buildings/Building';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

function overrideFor(
  overrides: readonly GeneratedFeatureOverride[],
  id: number,
): GeneratedFeatureOverride | undefined {
  return overrides.find((override) => override.entityType === 'building' && override.entityId === id);
}

export class GeneratedBuildingOverrideStage implements GenerationStage {
  public readonly id = 'generated-building-overrides';

  public run({ world, options }: GenerationContext): void {
    const kept: Building[] = [];
    for (const building of world.buildings) {
      const override = overrideFor(options.generatedFeatureOverrides, building.generatedId ?? building.id);
      if (override?.suppressed === true || override?.hidden === true) continue;
      kept.push({
        ...building,
        id: kept.length,
        generatedId: building.generatedId ?? building.id,
        source: building.source ?? 'generated',
      });
    }

    for (const tile of world.tiles) tile.buildingId = null;
    world.buildings = kept;
    for (const building of kept) {
      for (const tileIndex of building.tileIndices) {
        const tile = world.tiles[tileIndex];
        if (tile !== undefined) tile.buildingId = building.id;
      }
    }
  }
}
