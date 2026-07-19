import type { GenerationConfig } from '../config/GenerationConfig';
import { ClimatePreset, TerrainShape, TerrainSize, TownScale, type ResolvedGenerationOptions } from './GenerationOptions';

interface Dimensions {
  readonly width: number;
  readonly height: number;
}

const TERRAIN_DIMENSIONS: Readonly<Record<TerrainSize, Dimensions>> = {
  [TerrainSize.Small]: { width: 256, height: 192 },
  [TerrainSize.Medium]: { width: 320, height: 240 },
  [TerrainSize.Large]: { width: 384, height: 288 },
};

function townProfile(scale: TownScale): {
  readonly secondaryRoadCount: number;
  readonly localRoadCount: number;
  readonly localTownRadius: number;
  readonly blockRoadDistance: number;
  readonly urbanAnchorRadius: number;
  readonly maximumBuildingsPerBlock: number;
  readonly occupancyMultiplier: number;
  readonly commercialThresholdOffset: number;
  readonly vegetationMultiplier: number;
} {
  switch (scale) {
    case TownScale.Rural:
      return {
        secondaryRoadCount: 10,
        localRoadCount: 7,
        localTownRadius: 42,
        blockRoadDistance: 17,
        urbanAnchorRadius: 46,
        maximumBuildingsPerBlock: 18,
        occupancyMultiplier: 0.58,
        commercialThresholdOffset: 0.08,
        vegetationMultiplier: 1.18,
      };
    case TownScale.SemiUrban:
      return {
        secondaryRoadCount: 18,
        localRoadCount: 20,
        localTownRadius: 54,
        blockRoadDistance: 13,
        urbanAnchorRadius: 58,
        maximumBuildingsPerBlock: 34,
        occupancyMultiplier: 1,
        commercialThresholdOffset: 0,
        vegetationMultiplier: 1,
      };
    case TownScale.Urban:
      return {
        secondaryRoadCount: 27,
        localRoadCount: 32,
        localTownRadius: 76,
        blockRoadDistance: 10,
        urbanAnchorRadius: 78,
        maximumBuildingsPerBlock: 52,
        occupancyMultiplier: 1.28,
        commercialThresholdOffset: -0.07,
        vegetationMultiplier: 0.72,
      };
  }
}


function climateProfile(preset: ClimatePreset): Partial<GenerationConfig['climate']> {
  switch (preset) {
    case ClimatePreset.TropicalRainforest: return { preset, baseTemperature: 0.84, baseMoisture: 0.72, oceanMoistureStrength: 0.30, easternRainStrength: 0.18, westernFarmlandForestReduction: 0.05 };
    case ClimatePreset.TropicalMonsoon: return { preset, baseTemperature: 0.81, baseMoisture: 0.60, oceanMoistureStrength: 0.24, easternRainStrength: 0.14, westernFarmlandForestReduction: 0.18 };
    case ClimatePreset.TropicalSavanna: return { preset, baseTemperature: 0.86, baseMoisture: 0.40, oceanMoistureStrength: 0.16, easternRainStrength: 0.08, westernFarmlandForestReduction: 0.28 };
    case ClimatePreset.Temperate: return { preset, baseTemperature: 0.58, baseMoisture: 0.52, oceanMoistureStrength: 0.20, easternRainStrength: 0.09, westernFarmlandForestReduction: 0.15 };
    case ClimatePreset.Mediterranean: return { preset, baseTemperature: 0.67, baseMoisture: 0.37, oceanMoistureStrength: 0.17, easternRainStrength: 0.04, westernFarmlandForestReduction: 0.24 };
    case ClimatePreset.Boreal: return { preset, baseTemperature: 0.38, baseMoisture: 0.50, oceanMoistureStrength: 0.18, easternRainStrength: 0.07, westernFarmlandForestReduction: 0.08 };
  }
}

function shapeHydrology(shape: TerrainShape): Partial<GenerationConfig['hydrology']> {
  switch (shape) {
    case TerrainShape.Archipelago: return { riverSourceCount: 6, minimumRiverLength: 14, deltaDistributaryCount: 2 };
    case TerrainShape.TwinIslands: return { riverSourceCount: 8, minimumRiverLength: 18 };
    case TerrainShape.Peninsula: return { riverSourceCount: 10 };
    case TerrainShape.Inland: return { riverSourceCount: 14, sourceMinCoastDistance: 18 };
    case TerrainShape.RiverDelta: return { riverSourceCount: 12, deltaDistributaryCount: 5, deltaMinimumDischarge: 10 };
    case TerrainShape.Atoll: return { riverSourceCount: 0, minimumRiverLength: 999 };
    default: return {};
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function resolveGenerationConfig(
  base: GenerationConfig,
  options: ResolvedGenerationOptions,
): GenerationConfig {
  const dimensions = TERRAIN_DIMENSIONS[options.terrainSize];
  const town = townProfile(options.townScale);
  const terrainAreaRatio = (dimensions.width * dimensions.height) / (base.world.width * base.world.height);
  const linearRatio = Math.sqrt(terrainAreaRatio);

  return {
    ...base,
    version: base.version,
    world: { ...dimensions },
    terrain: { ...base.terrain, shapeProfile: options.terrainShape },
    climate: { ...base.climate, ...climateProfile(options.climatePreset) },
    anchors: options.terrainShape === TerrainShape.Archipelago || options.terrainShape === TerrainShape.RiverDelta
      ? { ...base.anchors, airportMaximumRelief: base.anchors.airportMaximumRelief * 3.2, maximumAirportSlope: base.anchors.maximumAirportSlope * 2.1, maximumFloodRisk: options.terrainShape === TerrainShape.RiverDelta ? 0.92 : base.anchors.maximumFloodRisk, minimumSpacing: Math.max(6, base.anchors.minimumSpacing - 3) }
      : base.anchors,
    story: options.terrainShape === TerrainShape.Inland
      ? { ...base.story, baleteMinimumSpacing: Math.max(12, base.story.baleteMinimumSpacing * 0.65), baleteMinimumForestDensity: Math.max(0.22, base.story.baleteMinimumForestDensity * 0.72) }
      : base.story,
    hydrology: {
      ...base.hydrology,
      ...shapeHydrology(options.terrainShape),
      riverSourceCount: Math.max(0, Math.round((shapeHydrology(options.terrainShape).riverSourceCount ?? base.hydrology.riverSourceCount) * linearRatio)),
      sourceSpacing: Math.round(base.hydrology.sourceSpacing * Math.min(1.35, linearRatio)),
      minimumRiverLength: Math.round((shapeHydrology(options.terrainShape).minimumRiverLength ?? base.hydrology.minimumRiverLength) * Math.min(1.35, linearRatio)),
    },
    roads: {
      ...base.roads,
      secondaryRoadCount: town.secondaryRoadCount,
      localRoadCount: town.localRoadCount,
      localTownRadius: town.localTownRadius,
      maximumPathVisits: Math.round(base.roads.maximumPathVisits * Math.min(1.7, Math.max(1, linearRatio))),
    },
    bridges: {
      ...base.bridges,
      maximumSpan: Math.round(base.bridges.maximumSpan * Math.min(1.35, linearRatio)),
      maximumManualSpan: Math.round(base.bridges.maximumManualSpan * Math.min(1.35, linearRatio)),
      maximumBridges: options.terrainShape === TerrainShape.Archipelago ? 5 : options.terrainShape === TerrainShape.TwinIslands ? 2 : base.bridges.maximumBridges,
      extraBridgeConnections: options.townScale === TownScale.Urban ? 2 : options.townScale === TownScale.Rural ? 0 : base.bridges.extraBridgeConnections,
    },
    maritime: {
      ...base.maritime,
      maximumRoutes: options.terrainShape === TerrainShape.Archipelago
        ? 10
        : options.terrainShape === TerrainShape.TwinIslands ? 4 : base.maritime.maximumRoutes,
      extraRouteConnections: options.townScale === TownScale.Urban
        ? 3
        : options.townScale === TownScale.Rural ? 0 : base.maritime.extraRouteConnections,
      maximumPathVisits: Math.round(base.maritime.maximumPathVisits * Math.min(1.7, terrainAreaRatio)),
    },
    blocks: {
      ...base.blocks,
      maximumRoadDistance: town.blockRoadDistance,
      urbanAnchorRadius: town.urbanAnchorRadius,
    },
    zoning: {
      ...base.zoning,
      commercialLandValueThreshold: clamp01(
        base.zoning.commercialLandValueThreshold + town.commercialThresholdOffset,
      ),
      commercialRoadDistance: options.townScale === TownScale.Urban
        ? 6
        : options.townScale === TownScale.Rural ? 3 : base.zoning.commercialRoadDistance,
    },
    buildings: {
      ...base.buildings,
      maximumBuildingsPerBlock: town.maximumBuildingsPerBlock,
      occupancyTargetResidential: clamp01(base.buildings.occupancyTargetResidential * town.occupancyMultiplier),
      occupancyTargetCommercial: clamp01(base.buildings.occupancyTargetCommercial * town.occupancyMultiplier),
      occupancyTargetIndustrial: clamp01(base.buildings.occupancyTargetIndustrial * town.occupancyMultiplier),
      occupancyTargetInstitutional: clamp01(base.buildings.occupancyTargetInstitutional * town.occupancyMultiplier),
      occupancyTargetGovernment: clamp01(base.buildings.occupancyTargetGovernment * town.occupancyMultiplier),
    },
    vegetation: {
      ...base.vegetation,
      forestDensityScale: base.vegetation.forestDensityScale * town.vegetationMultiplier,
      roadsideTreeChance: base.vegetation.roadsideTreeChance * town.vegetationMultiplier,
      maximumInstances: Math.round(base.vegetation.maximumInstances * terrainAreaRatio),
    },
  };
}
