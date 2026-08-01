import type {
  AuthoredMapFeature,
  AuthoredSettlementDefinition,
  AuthoringLayerState,
  AuthoringPoint,
} from '../authoring/AuthoringLayer';
import { EMPTY_AUTHORING_LAYER } from '../authoring/AuthoringLayer';
import type { CampaignState } from '../campaign/CampaignSystem';
import type { NPCLocationAuthoringState } from '../campaign/NPCLocationAuthoring';
import { EMPTY_NPC_LOCATION_AUTHORING } from '../campaign/NPCLocationAuthoring';
import type {
  ImportedImageAsset,
  LabelDisplaySettings,
  PlacedImage,
  RuntimeImageAsset,
} from '../customization/Customization';
import type {
  AnchorPositionOverride,
  EntityNameOverride,
  SettlementPositionOverride,
  StoryPositionOverride,
  StoryRuleOverride,
  ZoneOverride,
} from '../engine/generation/GenerationOptions';
import type { BridgeOverride, CustomBridgeDefinition } from '../engine/infrastructure/Bridge';
import type { CustomPortDefinition, PortOverride } from '../engine/infrastructure/Port';
import type { CampaignDay, NPC, NPCSchedulePeriod } from '../engine/npc/NPC';
import type { IslandOverride } from '../engine/regional/Island';
import type { BuiltInAnchorOverride, CustomAnchorDefinition } from '../engine/settlement/Anchor';
import type { StoredSimulationState } from '../engine/simulation/SimulationTypes';
import type { WorldSimulation } from '../engine/simulation/WorldSimulation';
import type { World } from '../engine/world/World';
import type { PlayerViewState } from '../player/PlayerViewState';
import type { CustomStoryPointDefinition } from '../story/StoryObject';

export type AuthoringTool = 'select' | 'anchor' | 'point' | 'polyline' | 'polygon' | 'terrain-brush';
export type WorkspaceMode = 'editor' | 'dm';
export type StudioTab = 'inspector' | 'layers' | 'project';

export interface DmSessionEntry {
  readonly time: string;
  readonly site: string;
  readonly title: string;
  readonly danger: string;
}

export interface InspectorSelection {
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly subtitle: string;
}

/**
 * Mutable application model for the editor session.
 *
 * Controllers may select data from this model and invoke its commands, while
 * views receive immutable snapshots or feature-specific projections.
 */
export class EditorSession {
  public customAnchors: CustomAnchorDefinition[] = [];
  public builtInOverrides: BuiltInAnchorOverride[] = [];
  public customStoryDefinitions: CustomStoryPointDefinition[] = [];
  public roadNameOverrides: EntityNameOverride[] = [];
  public blockNameOverrides: EntityNameOverride[] = [];
  public labelSettings!: LabelDisplaySettings;
  public anchorPositionOverrides: AnchorPositionOverride[] = [];
  public settlementPositionOverrides: SettlementPositionOverride[] = [];
  public storyPositionOverrides: StoryPositionOverride[] = [];
  public storyRuleOverrides: StoryRuleOverride[] = [];
  public zoneOverrides: ZoneOverride[] = [];
  public islandOverrides: IslandOverride[] = [];
  public bridgeOverrides: BridgeOverride[] = [];
  public customBridges: CustomBridgeDefinition[] = [];
  public portOverrides: PortOverride[] = [];
  public customPorts: CustomPortDefinition[] = [];
  public placedImages: PlacedImage[] = [];
  public authoringLayer: AuthoringLayerState = structuredClone(EMPTY_AUTHORING_LAYER);
  public npcLocationAuthoring: NPCLocationAuthoringState = structuredClone(EMPTY_NPC_LOCATION_AUTHORING);
  public campaignState!: CampaignState;
  public pendingImportedCampaign: CampaignState | null = null;
  public playerViewState!: PlayerViewState;
  public pendingImportedPlayerView: PlayerViewState | null = null;
  public selectedNpcKey: string | null = null;
  public selectedNpcScheduleDay: CampaignDay = 'monday';
  public selectedLocationRef: string | null = null;
  public pendingNpcPortraitDataUrl: string | null = null;
  public importedAssets: ImportedImageAsset[] = [];
  public runtimeImageAssets: RuntimeImageAsset[] = [];
  public world!: World;
  public simulation: WorldSimulation | null = null;
  public pendingImportedSimulation: Partial<StoredSimulationState> | undefined;
  public activeNpcSchedulePeriod!: NPCSchedulePeriod;
  public activeWorldSignature = '';
  public activeAuthoringFeatureId: string | null = null;
  public activeAuthoringSettlementKey: string | null = null;
  public pendingSettlementPlacement: AuthoredSettlementDefinition | null = null;
  public pendingPointAnchorPlacement = false;
  public authoringDraftPoints: AuthoringPoint[] = [];
  public authoringTool: AuthoringTool = 'select';
  public authoringTerrainStroke = new Set<number>();
  public authoringTerrainStrokeActive = false;
  public authoredFeatureOriginal: AuthoredMapFeature | null = null;
  public authoredFeaturePointerStart: AuthoringPoint | null = null;
  public activeWorkspace: WorkspaceMode = 'dm';
  public dmSessionEntries: DmSessionEntry[] = [];
  public activeStudioTab: StudioTab = 'inspector';
  public selectedInspectorItem: InspectorSelection | null = null;

  public renameRoad(id: number, name: string): boolean {
    const road = this.world.roads[id];
    if (road === undefined || name.trim().length === 0) return false;
    const normalized = name.trim();
    road.name = normalized;
    this.roadNameOverrides = this.replaceNameOverride(this.roadNameOverrides, id, normalized);
    return true;
  }

  public renameBlock(id: number, name: string): boolean {
    const block = this.world.blocks[id];
    if (block === undefined || name.trim().length === 0) return false;
    const normalized = name.trim();
    block.name = normalized;
    this.blockNameOverrides = this.replaceNameOverride(this.blockNameOverrides, id, normalized);
    return true;
  }

  public moveSettlement(key: string, x: number, y: number, islandKey: string): void {
    this.settlementPositionOverrides = [
      ...this.settlementPositionOverrides.filter((item) => item.key !== key),
      { key, x, y, islandKey },
    ].sort((left, right) => left.key.localeCompare(right.key));
  }

  public updateNpc(key: string, update: (npc: NPC) => NPC): boolean {
    const index = this.world.npcs.findIndex((npc) => npc.key === key);
    const npc = this.world.npcs[index];
    if (index < 0 || npc === undefined) return false;
    this.world.npcs = this.world.npcs.map((candidate) => candidate.key === key ? update(candidate) : candidate);
    return true;
  }

  private replaceNameOverride(values: readonly EntityNameOverride[], id: number, name: string): EntityNameOverride[] {
    return [...values.filter((item) => item.id !== id), { id, name }].sort((left, right) => left.id - right.id);
  }
}
