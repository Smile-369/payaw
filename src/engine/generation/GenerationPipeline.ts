import { DEFAULT_GENERATION_CONFIG, type GenerationConfig } from '../config/GenerationConfig';
import { SeededRandom } from '../rng/Random';
import { resolveGenerationOptions, type GenerationOptions } from './GenerationOptions';
import { resolveGenerationConfig } from './GenerationProfiles';
import { World } from '../world/World';
import type { GenerationStage } from './GenerationStage';
import { AccessibilityStage } from './stages/AccessibilityStage';
import { AnchorStage } from './stages/AnchorStage';
import { BlockStage } from './stages/BlockStage';
import { BuildingStage } from './stages/BuildingStage';
import { ClimateStage } from './stages/ClimateStage';
import { DrainageRepairStage } from './stages/DrainageRepairStage';
import { CoastlineStage } from './stages/CoastlineStage';
import { ElevationStage } from './stages/ElevationStage';
import { ErodedCoastlineStage } from './stages/ErodedCoastlineStage';
import { ErodedSlopeStage } from './stages/ErodedSlopeStage';
import { FinalCoastlineStage } from './stages/FinalCoastlineStage';
import { FinalSlopeStage } from './stages/FinalSlopeStage';
import { HydraulicErosionStage } from './stages/HydraulicErosionStage';
import { HydrologyStage } from './stages/HydrologyStage';
import { LandValueStage } from './stages/LandValueStage';
import { NamingStage } from './stages/NamingStage';
import { MountainStage } from './stages/MountainStage';
import { RoadStage } from './stages/RoadStage';
import { BridgeStage } from './stages/BridgeStage';
import { PortStage } from './stages/PortStage';
import { WaterRouteStage } from './stages/WaterRouteStage';
import { SlopeStage } from './stages/SlopeStage';
import { TerrainStage } from './stages/TerrainStage';
import { ThermalErosionStage } from './stages/ThermalErosionStage';
import { VegetationStage } from './stages/VegetationStage';
import { ZoneStage } from './stages/ZoneStage';
import { ZoneOverrideStage } from './stages/ZoneOverrideStage';
import { StoryStage } from './stages/StoryStage';
import { LandmassStage } from './stages/LandmassStage';
import { IslandStage } from './stages/IslandStage';
import { SettlementStage } from './stages/SettlementStage';

const DEFAULT_STAGES: readonly GenerationStage[] = [
  new ElevationStage(),
  new MountainStage(),
  new ThermalErosionStage(),
  new CoastlineStage(),
  new SlopeStage(),
  new ClimateStage(),
  new HydraulicErosionStage(),
  new ErodedCoastlineStage(),
  new ErodedSlopeStage(),
  new HydrologyStage(),
  new FinalCoastlineStage(),
  new DrainageRepairStage(),
  new FinalSlopeStage(),
  new TerrainStage(),
  new LandmassStage(),
  new IslandStage(),
  new SettlementStage(),
  new AnchorStage(),
  new RoadStage(),
  new BridgeStage(),
  new PortStage(),
  new WaterRouteStage(),
  new AccessibilityStage(),
  new BlockStage(),
  new LandValueStage(),
  new ZoneStage(),
  new ZoneOverrideStage(),
  new NamingStage(),
  new BuildingStage(),
  new VegetationStage(),
  new StoryStage(),
];

export class GenerationPipeline {
  private readonly config: GenerationConfig;
  private readonly stages: readonly GenerationStage[];

  public constructor(
    config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
    stages: readonly GenerationStage[] = DEFAULT_STAGES,
  ) {
    this.config = config;
    this.stages = stages;
  }

  /** Re-run only the selected stage and everything after it on an existing world. */
  public regenerateFrom(world: World, startStageId: string, options: GenerationOptions = {}): World {
    const resolvedOptions = resolveGenerationOptions(options);
    const runtimeConfig = resolveGenerationConfig(this.config, resolvedOptions);
    const startIndex = this.stages.findIndex((stage) => stage.id === startStageId);
    if (startIndex < 0) throw new Error(`Unknown generation stage: ${startStageId}`);
    const rootRandom = new SeededRandom(world.seed);
    const stageTimings: Record<string, number> = { ...world.diagnostics.stageTimingsMs };

    for (let index = startIndex; index < this.stages.length; index += 1) {
      const stage = this.stages[index];
      if (stage === undefined) continue;
      const startedAt = performance.now();
      stage.run({ config: runtimeConfig, options: resolvedOptions, random: rootRandom.fork(stage.id), world });
      stageTimings[stage.id] = performance.now() - startedAt;
    }

    world.diagnostics = {
      generatedAt: new Date().toISOString(),
      stageTimingsMs: stageTimings,
    };
    return world;
  }

  public generate(seed: string, options: GenerationOptions = {}): World {
    const normalizedSeed = seed.trim();
    if (normalizedSeed.length === 0) throw new Error('A non-empty seed is required.');
    const resolvedOptions = resolveGenerationOptions(options);
    const runtimeConfig = resolveGenerationConfig(this.config, resolvedOptions);
    const world = new World(normalizedSeed, runtimeConfig, resolvedOptions);
    const rootRandom = new SeededRandom(normalizedSeed);
    const stageTimings: Record<string, number> = {};

    for (const stage of this.stages) {
      const startedAt = performance.now();
      stage.run({ config: runtimeConfig, options: resolvedOptions, random: rootRandom.fork(stage.id), world });
      stageTimings[stage.id] = performance.now() - startedAt;
    }

    world.diagnostics = {
      generatedAt: new Date().toISOString(),
      stageTimingsMs: stageTimings,
    };
    return world;
  }
}
