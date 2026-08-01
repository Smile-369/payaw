import type {
  AuthoredMapFeature,
  AuthoredSettlementDefinition,
  AuthoringLayerState,
  AuthoringPoint,
} from '../authoring/AuthoringLayer';
import { EMPTY_AUTHORING_LAYER } from '../authoring/AuthoringLayer';
import type { CampaignState } from '../campaign/CampaignSystem';
import type { NPCLocationAuthoringState } from '../campaign/NPCLocationAuthoring';
import {
  EMPTY_NPC_LOCATION_AUTHORING,
  applyNpcLocationAuthoring,
  normalizeNpcLocationAuthoring,
} from '../campaign/NPCLocationAuthoring';
import type {
  ImportedImageAsset,
  LabelDisplaySettings,
  PlacedImage,
  RuntimeImageAsset,
  StoredMapCustomization,
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

export interface EditorSnapshot {
  readonly customAnchors: readonly CustomAnchorDefinition[];
  readonly builtInOverrides: readonly BuiltInAnchorOverride[];
  readonly customStoryPoints: readonly CustomStoryPointDefinition[];
  readonly roadNames: readonly EntityNameOverride[];
  readonly blockNames: readonly EntityNameOverride[];
  readonly labels: LabelDisplaySettings;
  readonly mapCustomization: StoredMapCustomization;
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

  public currentMapCustomization(): StoredMapCustomization {
    return {
      anchorPositions: this.anchorPositionOverrides,
      settlementPositions: this.settlementPositionOverrides,
      storyPositions: this.storyPositionOverrides,
      storyRules: this.storyRuleOverrides,
      zoneOverrides: this.zoneOverrides,
      placedImages: this.placedImages,
      islandOverrides: this.islandOverrides,
      bridgeOverrides: this.bridgeOverrides,
      customBridges: this.customBridges,
      portOverrides: this.portOverrides,
      customPorts: this.customPorts,
      authoringLayer: this.authoringLayer,
      npcLocationAuthoring: this.npcLocationAuthoring,
    };
  }

  public captureSnapshot(): EditorSnapshot {
    return structuredClone({
      customAnchors: this.customAnchors,
      builtInOverrides: this.builtInOverrides,
      customStoryPoints: this.customStoryDefinitions,
      roadNames: this.roadNameOverrides,
      blockNames: this.blockNameOverrides,
      labels: this.labelSettings,
      mapCustomization: this.currentMapCustomization(),
    });
  }

  public restoreSnapshot(snapshot: EditorSnapshot): void {
    this.customAnchors = [...snapshot.customAnchors];
    this.builtInOverrides = [...snapshot.builtInOverrides];
    this.customStoryDefinitions = [...snapshot.customStoryPoints];
    this.roadNameOverrides = [...snapshot.roadNames];
    this.blockNameOverrides = [...snapshot.blockNames];
    this.labelSettings = structuredClone(snapshot.labels);
    this.anchorPositionOverrides = [...snapshot.mapCustomization.anchorPositions];
    this.settlementPositionOverrides = [...snapshot.mapCustomization.settlementPositions];
    this.storyPositionOverrides = [...snapshot.mapCustomization.storyPositions];
    this.storyRuleOverrides = [...snapshot.mapCustomization.storyRules];
    this.zoneOverrides = [...snapshot.mapCustomization.zoneOverrides];
    this.placedImages = [...snapshot.mapCustomization.placedImages];
    this.islandOverrides = [...snapshot.mapCustomization.islandOverrides];
    this.bridgeOverrides = [...snapshot.mapCustomization.bridgeOverrides];
    this.customBridges = [...snapshot.mapCustomization.customBridges];
    this.portOverrides = [...snapshot.mapCustomization.portOverrides];
    this.customPorts = [...snapshot.mapCustomization.customPorts];
    this.authoringLayer = structuredClone(snapshot.mapCustomization.authoringLayer);
    this.npcLocationAuthoring = structuredClone(snapshot.mapCustomization.npcLocationAuthoring);
  }

  public setStudioTab(tab: StudioTab): void {
    this.activeStudioTab = tab;
  }

  public setInspectorSelection(selection: InspectorSelection | null): void {
    this.selectedInspectorItem = selection;
  }

  public setLabelSettings(settings: LabelDisplaySettings): void {
    this.labelSettings = structuredClone(settings);
  }

  public selectNpc(key: string | null): void {
    this.selectedNpcKey = key;
    this.pendingNpcPortraitDataUrl = null;
  }

  public selectNpcScheduleDay(day: CampaignDay): void {
    this.selectedNpcScheduleDay = day;
  }

  public selectLocation(sourceRef: string | null): void {
    this.selectedLocationRef = sourceRef;
  }

  public setPendingNpcPortrait(dataUrl: string | null): void {
    this.pendingNpcPortraitDataUrl = dataUrl;
  }

  public applyNpcAuthoringState(next: NPCLocationAuthoringState): void {
    const selectedKey = this.selectedNpcKey;
    this.npcLocationAuthoring = normalizeNpcLocationAuthoring(next);
    this.world.npcs = applyNpcLocationAuthoring(this.world, this.npcLocationAuthoring);
    this.simulation?.replaceWorld(this.world);
    this.simulation?.setNpcLocationAuthoring(this.npcLocationAuthoring);
    this.simulation?.tick(Date.now(), true);
    this.selectedNpcKey = selectedKey !== null && this.world.npcs.some((npc) => npc.key === selectedKey)
      ? selectedKey
      : null;
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
