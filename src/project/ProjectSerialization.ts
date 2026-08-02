import type { NPCLocationAuthoringState } from '../campaign/NPCLocationAuthoring';
import type { CampaignState } from '../campaign/CampaignSystem';
import type { ImportedImageAsset, LabelDisplaySettings, StoredMapCustomization } from '../customization/Customization';
import type { EntityNameOverride } from '../engine/generation/GenerationOptions';
import type { StoredSimulationState } from '../engine/simulation/SimulationTypes';
import type { BuiltInAnchorOverride, CustomAnchorDefinition } from '../engine/settlement/Anchor';
import type { World } from '../engine/world/World';
import type { StoredProfile } from '../editor/EditorStatePersistence';
import type { PlayerViewState } from '../player/PlayerViewState';
import type { CustomStoryPointDefinition } from '../story/StoryObject';

export interface ProjectSerializationState {
  readonly world: World;
  readonly customization: StoredMapCustomization;
  readonly customAnchors: readonly CustomAnchorDefinition[];
  readonly builtInAnchorOverrides: readonly BuiltInAnchorOverride[];
  readonly roadNames: readonly EntityNameOverride[];
  readonly blockNames: readonly EntityNameOverride[];
  readonly labelDisplay: LabelDisplaySettings;
  readonly customStoryPoints: readonly CustomStoryPointDefinition[];
  readonly npcLocationAuthoring: NPCLocationAuthoringState;
  readonly campaign: CampaignState;
  readonly playerView: PlayerViewState;
  readonly simulation: StoredSimulationState | undefined;
  readonly imageAssets: readonly ImportedImageAsset[];
}

function profileFromWorld(world: World): StoredProfile {
  return {
    terrainSize: world.metadata.terrainSize,
    townScale: world.metadata.townScale,
    terrainShape: world.metadata.terrainShape,
    climatePreset: world.metadata.climatePreset,
    islandCount: world.metadata.targetIslandCount,
    islandSpacingKilometers: world.metadata.islandSpacingKilometers,
    satelliteSettlementCount: world.metadata.satelliteSettlementCount,
  };
}

export function serializeWorldCustomization(customization: StoredMapCustomization): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...customization };
  delete payload.npcLocationAuthoring;
  return payload;
}

export function serializePortableProject(state: ProjectSerializationState): Record<string, unknown> {
  const { world } = state;
  const authoring = {
    customAnchors: state.customAnchors,
    builtInAnchorOverrides: state.builtInAnchorOverrides,
    roadNames: state.roadNames,
    blockNames: state.blockNames,
    labelDisplay: state.labelDisplay,
    customStoryPoints: state.customStoryPoints,
    // Keep authored NPCs and generated-NPC edits, but not the generated roster cache.
    npcLocationAuthoring: state.npcLocationAuthoring,
    campaign: state.campaign,
    playerView: state.playerView,
    simulation: state.simulation,
    customization: serializeWorldCustomization(state.customization),
    imageAssets: state.imageAssets,
  };
  return {
    format: 'payaw-project',
    projectVersion: 2,
    metadata: {
      schemaVersion: world.metadata.schemaVersion,
      generationVersion: world.metadata.generationVersion,
      exportKind: 'compact-recipe',
    },
    project: { seed: world.seed, profile: profileFromWorld(world), authoring },
  };
}

export function serializeHostedCampaign(state: ProjectSerializationState): Readonly<Record<string, unknown>> {
  const { world } = state;
  return {
    format: 'payaw-hosted-campaign',
    projectVersion: 1,
    metadata: {
      schemaVersion: 20,
      generationVersion: world.metadata.generationVersion,
    },
    project: {
      seed: world.seed,
      profile: profileFromWorld(world),
      authoring: {
        customAnchors: state.customAnchors,
        builtInAnchorOverrides: state.builtInAnchorOverrides,
        roadNames: state.roadNames,
        blockNames: state.blockNames,
        labelDisplay: state.labelDisplay,
        customStoryPoints: state.customStoryPoints,
        npcRosterSize: world.npcs.length,
        npcLocationAuthoring: state.npcLocationAuthoring,
        campaign: state.campaign,
        playerView: state.playerView,
        simulation: state.simulation,
        customization: state.customization,
      },
    },
    campaign: state.campaign,
    playerView: state.playerView,
    checkpointedAt: new Date().toISOString(),
  };
}

export function serializeAutosave(state: ProjectSerializationState, profile: StoredProfile): Record<string, unknown> {
  const { world } = state;
  const customization = state.customization;
  return {
    format: 'payaw-project',
    projectVersion: 1,
    metadata: { schemaVersion: 20 },
    project: {
      seed: world.seed,
      profile,
      authoring: {
        customAnchors: state.customAnchors,
        builtInAnchorOverrides: state.builtInAnchorOverrides,
        roadNames: state.roadNames,
        blockNames: state.blockNames,
        labelDisplay: state.labelDisplay,
        customStoryPoints: state.customStoryPoints,
        npcRosterSize: world.npcs.length,
        npcLocationAuthoring: state.npcLocationAuthoring,
        campaign: state.campaign,
        playerView: state.playerView,
        simulation: state.simulation,
        customization,
        imageAssets: [],
      },
    },
    campaign: state.campaign,
    playerView: state.playerView,
    customization: {
      ...customization,
      labelDisplay: state.labelDisplay,
      customStoryPoints: state.customStoryPoints,
      npcRosterSize: world.npcs.length,
      imageAssets: [],
    },
    autosavedAt: new Date().toISOString(),
  };
}

export function downloadProjectJson(state: ProjectSerializationState): void {
  const json = JSON.stringify(serializePortableProject(state), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${state.world.seed.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.world.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
