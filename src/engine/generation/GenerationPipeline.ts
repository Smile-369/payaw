import { DEFAULT_GENERATION_CONFIG, type GenerationConfig } from '../config/GenerationConfig';
import { SeededRandom } from '../rng/Random';
import { resolveGenerationOptions, type GenerationOptions, type ResolvedGenerationOptions } from './GenerationOptions';
import { resolveGenerationConfig } from './GenerationProfiles';
import { World } from '../world/World';
import type { GenerationStage } from './GenerationStage';
import {
  throwIfGenerationCancelled,
  yieldToBrowser,
  type GenerationRunOptions,
} from './GenerationScheduler';
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
import { AuthoringRoadStage } from './stages/AuthoringRoadStage';
import { GeneratedRoadOverrideStage } from './stages/GeneratedRoadOverrideStage';
import { BridgeStage } from './stages/BridgeStage';
import { PortStage } from './stages/PortStage';
import { SlopeStage } from './stages/SlopeStage';
import { TerrainStage } from './stages/TerrainStage';
import { AuthoringTerrainStage } from './stages/AuthoringTerrainStage';
import { GeneratedBuildingOverrideStage } from './stages/GeneratedBuildingOverrideStage';
import { ThermalErosionStage } from './stages/ThermalErosionStage';
import { VegetationStage } from './stages/VegetationStage';
import { ZoneStage } from './stages/ZoneStage';
import { ZoneOverrideStage } from './stages/ZoneOverrideStage';
import { StoryStage } from './stages/StoryStage';
import { LandmassStage } from './stages/LandmassStage';
import { IslandStage } from './stages/IslandStage';
import { SettlementStage } from './stages/SettlementStage';
import { NPCStage } from './stages/NPCStage';

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
  new AuthoringTerrainStage(),
  new LandmassStage(),
  new IslandStage(),
  new SettlementStage(),
  new AnchorStage(),
  new RoadStage(),
  new GeneratedRoadOverrideStage(),
  new AuthoringRoadStage(),
  new BridgeStage(),
  new PortStage(),
  new AccessibilityStage(),
  new BlockStage(),
  new LandValueStage(),
  new ZoneStage(),
  new ZoneOverrideStage(),
  new NamingStage(),
  new BuildingStage(),
  new GeneratedBuildingOverrideStage(),
  new VegetationStage(),
  new StoryStage(),
  new NPCStage(),
];

interface PreparedRun {
  readonly runtimeConfig: GenerationConfig;
  readonly resolvedOptions: ResolvedGenerationOptions;
}

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

  public stageIds(): readonly string[] {
    return this.stages.map((stage) => stage.id);
  }

  private stagesForRun(runOptions: GenerationRunOptions, startIndex = 0): readonly GenerationStage[] {
    const available = this.stages.slice(startIndex);
    const stopAfterStageId = runOptions.stopAfterStageId;
    if (stopAfterStageId === undefined) return available;
    const stopIndex = this.stages.findIndex((stage) => stage.id === stopAfterStageId);
    if (stopIndex < 0) throw new Error(`Unknown generation stage: ${stopAfterStageId}`);
    if (stopIndex < startIndex) {
      throw new Error(`Generation stop stage ${stopAfterStageId} is before the requested start stage.`);
    }
    return this.stages.slice(startIndex, stopIndex + 1);
  }

  private prepare(options: GenerationOptions): PreparedRun {
    const resolvedOptions = resolveGenerationOptions(options);
    return {
      resolvedOptions,
      runtimeConfig: resolveGenerationConfig(this.config, resolvedOptions),
    };
  }

  private runStage(
    stage: GenerationStage,
    stageIndex: number,
    stageCount: number,
    world: World,
    runtimeConfig: GenerationConfig,
    resolvedOptions: ResolvedGenerationOptions,
    rootRandom: SeededRandom,
    runStartedAt: number,
    stageTimings: Record<string, number>,
    runOptions: GenerationRunOptions,
  ): void {
    throwIfGenerationCancelled(runOptions.signal);
    const startedAt = performance.now();
    stage.run({ config: runtimeConfig, options: resolvedOptions, random: rootRandom.fork(stage.id), world });
    const stageDurationMs = performance.now() - startedAt;
    stageTimings[stage.id] = stageDurationMs;
    runOptions.onProgress?.({
      stageId: stage.id,
      stageIndex,
      stageCount,
      stageDurationMs,
      elapsedMs: performance.now() - runStartedAt,
      completed: stageIndex === stageCount - 1,
    });
  }

  /** Re-run only the selected stage and everything after it on an existing world. */
  public regenerateFrom(
    world: World,
    startStageId: string,
    options: GenerationOptions = {},
    runOptions: GenerationRunOptions = {},
  ): World {
    const { resolvedOptions, runtimeConfig } = this.prepare(options);
    const startIndex = this.stages.findIndex((stage) => stage.id === startStageId);
    if (startIndex < 0) throw new Error(`Unknown generation stage: ${startStageId}`);
    const rootRandom = new SeededRandom(world.seed);
    const stageTimings: Record<string, number> = { ...world.diagnostics.stageTimingsMs };
    const startedAt = performance.now();

    const stages = this.stagesForRun(runOptions, startIndex);
    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      if (stage === undefined) continue;
      this.runStage(stage, index, stages.length, world, runtimeConfig, resolvedOptions, rootRandom, startedAt, stageTimings, runOptions);
    }

    world.diagnostics = { generatedAt: new Date().toISOString(), stageTimingsMs: stageTimings };
    return world;
  }

  public async regenerateFromAsync(
    world: World,
    startStageId: string,
    options: GenerationOptions = {},
    runOptions: GenerationRunOptions = {},
  ): Promise<World> {
    const { resolvedOptions, runtimeConfig } = this.prepare(options);
    const startIndex = this.stages.findIndex((stage) => stage.id === startStageId);
    if (startIndex < 0) throw new Error(`Unknown generation stage: ${startStageId}`);
    const rootRandom = new SeededRandom(world.seed);
    const stageTimings: Record<string, number> = { ...world.diagnostics.stageTimingsMs };
    const startedAt = performance.now();

    const stages = this.stagesForRun(runOptions, startIndex);
    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      if (stage === undefined) continue;
      this.runStage(stage, index, stages.length, world, runtimeConfig, resolvedOptions, rootRandom, startedAt, stageTimings, runOptions);
      if (runOptions.yieldBetweenStages !== false && index < stages.length - 1) await yieldToBrowser();
    }

    throwIfGenerationCancelled(runOptions.signal);
    world.diagnostics = { generatedAt: new Date().toISOString(), stageTimingsMs: stageTimings };
    return world;
  }

  public generate(
    seed: string,
    options: GenerationOptions = {},
    runOptions: GenerationRunOptions = {},
  ): World {
    const normalizedSeed = seed.trim();
    if (normalizedSeed.length === 0) throw new Error('A non-empty seed is required.');
    const { resolvedOptions, runtimeConfig } = this.prepare(options);
    const world = new World(normalizedSeed, runtimeConfig, resolvedOptions);
    const rootRandom = new SeededRandom(normalizedSeed);
    const stageTimings: Record<string, number> = {};
    const startedAt = performance.now();

    const stages = this.stagesForRun(runOptions);
    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      if (stage === undefined) continue;
      this.runStage(stage, index, stages.length, world, runtimeConfig, resolvedOptions, rootRandom, startedAt, stageTimings, runOptions);
    }

    world.diagnostics = { generatedAt: new Date().toISOString(), stageTimingsMs: stageTimings };
    return world;
  }

  public async generateAsync(
    seed: string,
    options: GenerationOptions = {},
    runOptions: GenerationRunOptions = {},
  ): Promise<World> {
    const normalizedSeed = seed.trim();
    if (normalizedSeed.length === 0) throw new Error('A non-empty seed is required.');
    const { resolvedOptions, runtimeConfig } = this.prepare(options);
    const world = new World(normalizedSeed, runtimeConfig, resolvedOptions);
    const rootRandom = new SeededRandom(normalizedSeed);
    const stageTimings: Record<string, number> = {};
    const startedAt = performance.now();

    const stages = this.stagesForRun(runOptions);
    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      if (stage === undefined) continue;
      this.runStage(stage, index, stages.length, world, runtimeConfig, resolvedOptions, rootRandom, startedAt, stageTimings, runOptions);
      if (runOptions.yieldBetweenStages !== false && index < stages.length - 1) await yieldToBrowser();
    }

    throwIfGenerationCancelled(runOptions.signal);
    world.diagnostics = { generatedAt: new Date().toISOString(), stageTimingsMs: stageTimings };
    return world;
  }
}
