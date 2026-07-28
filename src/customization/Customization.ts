import type { BuildingType } from '../engine/buildings/Building';
import type { IslandOverride } from '../engine/regional/Island';
import type { BridgeOverride, CustomBridgeDefinition } from '../engine/infrastructure/Bridge';
import type { PortOverride, CustomPortDefinition } from '../engine/infrastructure/Port';
import type { AuthoringLayerState } from '../authoring/AuthoringLayer';
import type { NPCLocationAuthoringState } from '../campaign/NPCLocationAuthoring';
import type {
  AnchorPositionOverride,
  SettlementPositionOverride,
  StoryPositionOverride,
  StoryRuleOverride,
  ZoneOverride,
} from '../engine/generation/GenerationOptions';

export enum AssetTargetCategory {
  Map = 'map',
  Building = 'building',
  Story = 'story',
  Anchor = 'anchor',
  Vegetation = 'vegetation',
  Infrastructure = 'infrastructure',
}

export interface ImportedImageAsset {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly targetCategory: AssetTargetCategory;
  readonly targetType: string | null;
  /** M7 compatibility field. Old IndexedDB records are migrated when loaded. */
  readonly buildingType?: BuildingType | null;
  readonly createdAt: string;
}

export interface PlacedImage {
  readonly id: string;
  readonly assetId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly opacity: number;
  readonly zIndex: number;
}

export interface StoredMapCustomization {
  readonly anchorPositions: readonly AnchorPositionOverride[];
  readonly settlementPositions: readonly SettlementPositionOverride[];
  readonly storyPositions: readonly StoryPositionOverride[];
  readonly storyRules: readonly StoryRuleOverride[];
  readonly zoneOverrides: readonly ZoneOverride[];
  readonly placedImages: readonly PlacedImage[];
  readonly islandOverrides: readonly IslandOverride[];
  readonly bridgeOverrides: readonly BridgeOverride[];
  readonly customBridges: readonly CustomBridgeDefinition[];
  readonly portOverrides: readonly PortOverride[];
  readonly customPorts: readonly CustomPortDefinition[];
  readonly authoringLayer: AuthoringLayerState;
  readonly npcLocationAuthoring: NPCLocationAuthoringState;
}

export interface RuntimeImageAsset {
  readonly definition: ImportedImageAsset;
  readonly image: HTMLImageElement;
}

export interface TravelPathOverlaySegment {
  readonly mode: 'walk' | 'drive' | 'public-transport' | 'boat';
  readonly tileIndices: readonly number[];
}

export interface TravelPathOverlay {
  readonly segments: readonly TravelPathOverlaySegment[];
}

export interface DragPreview {
  readonly kind: 'anchor' | 'settlement' | 'story' | 'authored-feature';
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

export interface RoadLabelSettings {
  readonly visible: boolean;
  readonly fontSizePx: number;
  readonly opacity: number;
  readonly density: number;
  readonly showMain: boolean;
  readonly showSecondary: boolean;
  readonly showLocal: boolean;
  readonly mainMinZoom: number;
  readonly secondaryMinZoom: number;
  readonly localMinZoom: number;
  readonly rotateAlongRoad: boolean;
  readonly outline: boolean;
}

export interface BlockLabelSettings {
  readonly visible: boolean;
  readonly fontSizePx: number;
  readonly opacity: number;
  readonly density: number;
  readonly minZoom: number;
  readonly outline: boolean;
}

export interface LabelDisplaySettings {
  readonly road: RoadLabelSettings;
  readonly block: BlockLabelSettings;
  readonly avoidCollisions: boolean;
}

export const DEFAULT_LABEL_DISPLAY_SETTINGS: LabelDisplaySettings = {
  road: {
    visible: true,
    fontSizePx: 7,
    opacity: 0.9,
    density: 0.8,
    showMain: true,
    showSecondary: true,
    showLocal: false,
    mainMinZoom: 2.4,
    secondaryMinZoom: 4.2,
    localMinZoom: 6.5,
    rotateAlongRoad: true,
    outline: true,
  },
  block: {
    visible: true,
    fontSizePx: 8,
    opacity: 0.85,
    density: 0.7,
    minZoom: 4.5,
    outline: true,
  },
  avoidCollisions: true,
};

export type ZoneDisplayMode = 'final' | 'generated' | 'overrides';

export interface RenderCustomization {
  readonly imageAssets: readonly RuntimeImageAsset[];
  readonly placedImages: readonly PlacedImage[];
  readonly editMode: boolean;
  readonly dragPreview: DragPreview | null;
  readonly labels: LabelDisplaySettings;
  readonly zoneDisplayMode: ZoneDisplayMode;
  readonly zoneBrushPreview: readonly number[];
  readonly travelPath: TravelPathOverlay | null;
  readonly authoringLayer: AuthoringLayerState;
  readonly activeAuthoringFeatureId: string | null;
  readonly authoringDraftPoints: readonly { readonly x: number; readonly y: number }[];
}

export const EMPTY_RENDER_CUSTOMIZATION: RenderCustomization = {
  imageAssets: [],
  placedImages: [],
  editMode: false,
  dragPreview: null,
  labels: DEFAULT_LABEL_DISPLAY_SETTINGS,
  zoneDisplayMode: 'final',
  zoneBrushPreview: [],
  travelPath: null,
  authoringLayer: { authoredSettlements: [], settlementOverrides: [], terrainOverrides: [], generatedFeatureOverrides: [], features: [] },
  activeAuthoringFeatureId: null,
  authoringDraftPoints: [],
};
