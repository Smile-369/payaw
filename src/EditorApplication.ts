import { AssetRepository } from './customization/AssetRepository';
import {
  EMPTY_AUTHORING_LAYER,
  normalizeHexColor,
  type AuthoredMapFeature,
  type AuthoredSettlementDefinition,
  type GeneratedFeatureOverride,
  type AuthoringFeatureCategory,
  type AuthoringGeometry,
  type AuthoringPoint,
  type AuthoringRealityLayer,
  type AuthoringVisibility,
  type SettlementAuthoringOverride,
  type SettlementKind,
} from './authoring/AuthoringLayer';
import { authoringFeatureCenter, transformAuthoringGeometry, translateAuthoringGeometry } from './authoring/AuthoringGeometry';
import { createGeneratedReplacementFeature, generatedSourceForFeature } from './authoring/GeneratedFeatureAuthoring';
import {
  EMPTY_NPC_LOCATION_AUTHORING,
  applyNpcLocationAuthoring,
  collectCampaignLocations,
  normalizeNpcLocationAuthoring,
  scheduleLocationFromRef,
  type NPCLocationAuthoringState,
  type NPCScenePlacement,
} from './campaign/NPCLocationAuthoring';
import {
  createCampaign,
  normalizeCampaignState,
} from './campaign/CampaignSystem';
import { CampaignStudio, type CampaignStudioOption } from './campaign/CampaignStudio';
import { datetimeLocalValue, timestampFromZonedLocal } from './campaign/CampaignTime';
import { GmPlayerPreview } from './player/GmPlayerPreview';
import { readNetcodeConfig } from './netcode/NetcodeConfig';
import {
  createDefaultPlayerViewState,
  normalizePlayerViewState,
} from './player/PlayerViewState';
import {
  AssetTargetCategory,
  EMPTY_RENDER_CUSTOMIZATION,
  type ImportedImageAsset,
  type LabelDisplaySettings,
  type PlacedImage,
  type StoredMapCustomization,
} from './customization/Customization';
import { describeAssetTarget } from './customization/AssetTargets';
import {
  SETTLEMENT_KINDS,
  loadMapCustomization,
  normalizeMapCustomization,
  saveMapCustomization,
} from './customization/MapCustomizationPersistence';
import { DEFAULT_GENERATION_CONFIG } from './engine/config/GenerationConfig';
import { GenerationPipeline } from './engine/generation/GenerationPipeline';
import { GenerationWorkerClient } from './browser/GenerationWorkerClient';
import { GenerationCancelledError, type GenerationProgress } from './engine/generation/GenerationScheduler';
import { InvalidPositionOverrideError } from './engine/generation/InvalidPositionOverrideError';
import { recoverPositionOverrides } from './engine/generation/PositionOverrideRecovery';
import {
  ClimatePreset,
  TerrainShape,
  TerrainSize,
  TownScale,
  type AnchorPositionOverride,
  type EntityNameOverride,
  type GenerationOptions,
  type SettlementPositionOverride,
  type StoryPositionOverride,
  type StoryRuleOverride,
  type ZoneOverride,
} from './engine/generation/GenerationOptions';
import { Camera } from './engine/renderer/Camera';
import { CanvasRenderer, rasterCacheLayersForStage } from './engine/renderer/CanvasRenderer';
import { RenderLayer } from './engine/renderer/Layers';
import { GM_MAP_VIEW_PRESETS } from './engine/renderer/MapViewPresets';
import {
  ANCHOR_LABELS,
  AnchorProximityBand,
  AnchorRegionPreference,
  AnchorTerrainPreference,
  BUILT_IN_ANCHOR_TYPES,
  type AnchorRuleSettings,
  type BuiltInAnchorOverride,
  type BuiltInAnchorType,
  type CustomAnchorDefinition,
} from './engine/settlement/Anchor';
import { createDefaultBuiltInAnchorDefinitions } from './engine/settlement/AnchorRules';
import { TerrainType, WaterType } from './engine/world/Tile';
import { SeededRandom } from './engine/rng/Random';
import { generateNPCPopulation } from './engine/npc/NPCGenerator';
import { NPCStatus, type NPC, type NPCRelationship, type NPCScheduleEntry } from './engine/npc/NPC';
import { npcScheduleEntryForPeriod, npcSchedulePeriodForDate, npcSchedulePeriodForTimestamp } from './engine/time/WorldClock';
import { WorldSimulation } from './engine/simulation/WorldSimulation';
import { normalizeSimulationTimezone } from './engine/simulation/SimulationClock';
import type {
  InfrastructureOperationalState,
  SimulationClockMode,
  SimulationSpeed,
  SimulationEvent,
  StoredSimulationState,
  WeatherCondition,
} from './engine/simulation/SimulationTypes';
import { findNearestValidSettlementTile } from './engine/regional/SettlementGenerator';
import { BridgeType, type CustomBridgeDefinition } from './engine/infrastructure/Bridge';
import { RoadType, type Road } from './engine/infrastructure/Road';
import type { Building } from './engine/buildings/Building';
import { PortType, type CustomPortDefinition } from './engine/infrastructure/Port';
import { brushIndices, floodFillIndices, rectangleIndices, setZoneOverrides, smoothZoneOverrides, type ZoneTool } from './editor/ZoneEditor';
import { EditorHistoryController } from './editor/EditorHistoryController';
import {
  MAX_CUSTOM_ANCHORS,
  MAX_CUSTOM_STORY_POINTS,
  finiteSetting,
  formatEncounterLines,
  isEnumValue,
  loadAnchorState,
  loadCustomStoryDefinitions,
  loadLabelSettings,
  loadNameState,
  loadProfile,
  normalizeAnchorState,
  normalizeCustomStoryDefinition,
  normalizeLabelSettings,
  normalizeStoredProfile,
  parseEncounterLines,
  saveAnchorState,
  saveCustomStoryDefinitions,
  saveLabelSettings,
  saveNameState,
  saveProfile,
  validNameOverrides,
  type StoredProfile,
} from './editor/EditorStatePersistence';
import { World } from './engine/world/World';
import { ZoneType } from './engine/zoning/Zone';
import { pickWeightedEncounter } from './story/EncounterGenerator';
import { StoryObjectSource, StoryObjectType, type CustomStoryPointDefinition, type StoryEncounterDefinition } from './story/StoryObject';
import {
  hasSessionResumeMarker,
  markSessionResumeAvailable,
  readAutosaveRecoveryInfo,
  readAutosavedProject,
  readBrowserSession,
  updateBrowserSession,
  writeAutosavedProject,
  type PersistedMapView,
} from './session/SessionPersistence';
import {
  loadRecentProjects,
  saveRecentProject,
  type RecentProjectEntry,
} from './project/RecentProjectStore';
import { CommandPalette, type CommandDefinition } from './ui/CommandPalette';
import { renderWorldStatistics } from './ui/WorldStatistics';
import { AssetLibraryController } from './ui/AssetLibraryController';
import { NameEditorController } from './ui/NameEditorController';
import { SimulationPanelController } from './ui/SimulationPanelController';
import { TravelPlannerController } from './ui/TravelPlannerController';
import * as appElements from './ui/AppElements';
import { createCryptoSeed, createRuleId } from './utils/Identifiers';
import {
  downloadProjectJson,
  serializeAutosave,
  serializeHostedCampaign,
  serializeWorldCustomization,
  type ProjectSerializationState,
} from './project/ProjectSerialization';
import { EditorSession, type EditorSnapshot } from './models/EditorSession';
import { AuthoringController } from './authoring/AuthoringController';
import { NpcController } from './npc/NpcController';
import { renderNpcRosterView } from './npc/NpcRosterView';
import { ProjectController } from './project/ProjectController';
import { renderRecentProjectsView } from './project/RecentProjectsView';
import { GenerationController } from './generation/GenerationController';
import { MapInteractionController } from './map/MapInteractionController';
import { MapInspectorController } from './map/MapInspectorController';
import { StudioShellController } from './ui/StudioShellController';
import { LabelDisplayController } from './ui/LabelDisplayController';
import { NpcEditorView } from './npc/NpcEditorView';
import { NpcJsonController } from './npc/NpcJsonController';

export function startEditorApplication(): void {

const SATELLITE_SETTLEMENT_COUNT = 0;
const WORKSPACE_STORAGE_KEY = 'payaw.workspace.v1';
const CLOCK_FORMAT_STORAGE_KEY = 'payaw.clock-format.v1';

function updateStats(container: HTMLElement, world: World): void {
  renderWorldStatistics(container, world, {
    zoneOverrideCount: session.zoneOverrides.length,
    storyRuleOverrideCount: session.storyRuleOverrides.length,
    importedAssetCount: session.importedAssets.length,
    placedImageCount: session.placedImages.length,
  });
}


const {
  canvas, seedInput, terrainSizeSelect, townScaleSelect, terrainShapeSelect, climatePresetSelect, islandCountInput, islandSpacingInput,
  regionalScaleReadout, profileHint, generateButton, cancelGenerationButton, generationProgress, generationProgressFill, generationProgressStage, generationProgressPercent,
  perfGenerationTotal, perfSlowestStage, perfCacheTime, perfRenderTime, perfVisibleBuildings, perfVisibleVegetation, randomSeedButton,
  exportImageButton, imageExportScale, imageExportPadding, projectImportFile, fitMapButton,
  viewPreset, statusMessage, authoringModeBadge, authoringStatus, authoringSettlementName, authoringSettlementKind, authoringSettlementParent,
  authoringSettlementRadius, authoringSettlementRotation, authoringSettlementPopulation, authoringSettlementDensity, authoringSettlementVisibility, authoringSettlementNotes, authoringSettlementRoads, authoringSettlementBuildings,
  authoringPlaceSettlement, authoringApplySettlement, authoringDuplicateSettlement, authoringSettlementList, settlementAnchorOnlyFields, authoringFeatureName, authoringFeatureCategory, authoringFeatureSubtype,
  authoringFeatureReality, authoringFeatureVisibility, authoringFeatureColor, authoringFeatureLineWidth, authoringFeatureFill, authoringFeatureScale, authoringFeatureRotation, authoringFeatureOpacity,
  authoringFeatureAliases, authoringFeatureNotes, authoringStartFeature, authoringFinishFeature, authoringCancelFeature, authoringFeatureList, authoringTerrainOperation, authoringTerrainSize,
  authoringTerrainStrength, authoringTerrainType, authoringResetSelected, authoringDeleteSelected, mapTitle,
  mapSubtitle, stats, cursorReadout, anchorForm, anchorFormTitle, anchorEditKey, anchorCancelButton, anchorSubmitButton,
  anchorName, anchorRegion, anchorTerrain, anchorTarget, anchorProximity, anchorZone, anchorRadius, anchorSpacing,
  anchorList, anchorCount, roadLabelFontSize, roadLabelFontOutput, roadLabelOpacity, roadLabelOpacityOutput, roadLabelDensity, roadLabelDensityOutput,
  roadLabelMainZoom, roadLabelSecondaryZoom, roadLabelLocalZoom, roadLabelMain, roadLabelSecondary, roadLabelLocal, roadLabelRotate, roadLabelOutline,
  roadLabelSummary, blockLabelFontSize, blockLabelFontOutput, blockLabelOpacity, blockLabelOpacityOutput, blockLabelDensity, blockLabelDensityOutput, blockLabelMinZoom,
  blockLabelOutline, blockLabelSummary, labelAvoidCollisions, labelControlsReset, storyList, worldStoryList, removedStoryCount, restoreRemovedStoryPoints,
  storyRuleForm, storyRuleTarget, storyRuleName, storyPreferredZone, storyInfluenceRadius, storyAllowedZones, storyDisallowedZones, storyRuleReset,
  storyRuleWish, storyRuleManifestation, storyRuleEncounters, customStoryForm, customStoryFormTitle, customStoryCancel, customStoryEditId, customStoryName,
  customStoryType, customStoryRegion, customStoryTerrain, customStoryZone, customStoryAllowedZones, customStoryDisallowedZones, customStoryRadius, customStorySpacing,
  customStoryWish, customStoryManifestation, customStoryEncounters, customStoryList, customStoryCount, npcCount, npcRosterSize, npcSearch,
  npcList, npcExportSelected, npcExportGroup, npcViewToggleButton, realtimeClock, simulationClockMode, simulationSpeed, simulationDatetime,
  simulationApplyTime, simulationAdvance15, simulationAdvanceHour, simulationAdvanceDay, simulationWeather, simulationEventFilter, simulationEventClear,
  simulationInfrastructureKind, simulationInfrastructureTarget,
  simulationInfrastructureStatus, simulationInfrastructureApply, simulationInfrastructureClear, viewportShell, toolbarEditButton, undoButton, redoButton, editModeButton,
  resetObjectPositionsButton, assetForm, assetFiles, assetTargetCategory, assetTargetType, assetList, assetCount, placedImageList,
  zoneEditModeButton, zoneToolSelect, zonePaintType, zoneBrushSize, zoneBrushOutput, zoneDisplayMode, zoneLockNew, zoneResetAll,
  zoneOverrideCount, zoneEditorStatus, workspaceEditorButton, workspaceDmButton, editorWorkspace, dmWorkspace, workspaceKicker, workspaceTitle,
  workspaceDescription, mapWorkspaceBadge, dmViewPreset, dmStorySearch, dmRandomEncounterButton, dmRandomEncounterResult, dmStoryTotal, dmCustomTotal,
  dmSessionLog, dmClearLog, bridgeForm, bridgeName, bridgeFromIsland, bridgeToIsland, bridgeType, bridgeRoadClass,
  bridgeWidth, bridgeClearance, bridgeResetAll, portForm, portName, portIsland, portType, portCapacity, portResetAll, travelFromLocation,
  travelToLocation, travelMode, travelTraffic, travelCalculate, travelReverse, travelClear, travelPickFrom, travelPickTo,
  travelAlternatives, travelResult, toggleLeftPanelButton, toggleStudioDockButton, closeStudioDockButton, studioTabInspector, studioTabLayers, studioTabProject,
  studioInspectorPanel, studioLayersPanel, studioProjectPanel, inspectorContent, focusSelectionButton, studioLayerList, layerSearchInput, layersAllButton,
  layersNoneButton, studioThemeSelect, restoreSessionButton, autosaveIndicator, sessionRecoveryCopy,
  recentProjectList, minimapPanel, minimapCanvas, minimapCollapseButton, statusSeed, statusLayout, statusZoom,
  statusSelection, statusGeneration, toastStack, layerElements, commandPaletteButton, commandPaletteBackdrop, commandPaletteInput, commandPaletteResults,
} = appElements;


const REGION_LABELS: Readonly<Record<AnchorRegionPreference, string>> = {
  [AnchorRegionPreference.Anywhere]: 'anywhere',
  [AnchorRegionPreference.TownCenter]: 'town center',
  [AnchorRegionPreference.North]: 'north',
  [AnchorRegionPreference.South]: 'south',
  [AnchorRegionPreference.East]: 'east',
  [AnchorRegionPreference.West]: 'west',
};

const TERRAIN_LABELS: Readonly<Record<AnchorTerrainPreference, string>> = {
  [AnchorTerrainPreference.SafeLand]: 'safe land',
  [AnchorTerrainPreference.FlatLand]: 'flat land',
  [AnchorTerrainPreference.Coast]: 'coast',
  [AnchorTerrainPreference.River]: 'river',
  [AnchorTerrainPreference.ForestEdge]: 'forest edge',
  [AnchorTerrainPreference.Farmland]: 'farmland',
  [AnchorTerrainPreference.HighGround]: 'high ground',
  [AnchorTerrainPreference.DryLand]: 'dry land',
};

const pipeline = new GenerationPipeline();
const generationWorker = new GenerationWorkerClient(pipeline);
const renderer = new CanvasRenderer(canvas);
const camera = new Camera();
const assetRepository = new AssetRepository();
const defaultBuiltIns = createDefaultBuiltInAnchorDefinitions(DEFAULT_GENERATION_CONFIG.anchors);
const profile = loadProfile();
terrainSizeSelect.value = profile.terrainSize;
townScaleSelect.value = profile.townScale;
terrainShapeSelect.value = profile.terrainShape;
climatePresetSelect.value = profile.climatePreset;
islandCountInput.value = String(profile.islandCount);
islandSpacingInput.value = String(profile.islandSpacingKilometers);
const storedAnchors = loadAnchorState();
const session = new EditorSession();
session.customAnchors = [...storedAnchors.customAnchors];
session.builtInOverrides = [...storedAnchors.builtInOverrides];
session.customStoryDefinitions = loadCustomStoryDefinitions();
session.roadNameOverrides = [];
session.blockNameOverrides = [];
session.setLabelSettings(loadLabelSettings());
session.anchorPositionOverrides = [];
session.settlementPositionOverrides = [];
session.storyPositionOverrides = [];
session.storyRuleOverrides = [];
session.zoneOverrides = [];
session.islandOverrides = [];
session.bridgeOverrides = [];
session.customBridges = [];
session.portOverrides = [];
session.customPorts = [];
session.placedImages = [];
session.authoringLayer = structuredClone(EMPTY_AUTHORING_LAYER);
session.npcLocationAuthoring = structuredClone(EMPTY_NPC_LOCATION_AUTHORING);
session.campaignState = createCampaign('world:pending', 'Hidden Payaw');
let campaignStudio: CampaignStudio | null = null;
session.pendingImportedCampaign = null;
session.playerViewState = createDefaultPlayerViewState(6);
session.pendingImportedPlayerView = null;
let playerPreview: GmPlayerPreview | null = null;
session.selectNpc(null);
session.selectNpcScheduleDay('monday');
session.selectLocation(null);
session.importedAssets = [];
session.runtimeImageAssets = [];

session.simulation = null;

session.activeNpcSchedulePeriod = npcSchedulePeriodForDate(new Date());
let clockDisplayFormat: '12h' | '24h' = localStorage.getItem(CLOCK_FORMAT_STORAGE_KEY) === '24h' ? '24h' : '12h';
session.activeWorldSignature = '';
let activeGenerationController: AbortController | null = null;
let generationSequence = 0;
let renderRequested = true;
let dragging = false;
let editMode = false;
let zoneEditMode = false;
let zoneStrokeActive = false;
let zoneStrokeStart: { x: number; y: number } | null = null;
let zoneStrokeIndices = new Set<number>();
let zoneBrushPreview: number[] = [];
let lastPointerX = 0;
let lastPointerY = 0;
let dragPreview: { kind: 'anchor' | 'settlement' | 'story' | 'authored-feature'; key: string; x: number; y: number } | null = null;
session.activeAuthoringFeatureId = null;
session.activeAuthoringSettlementKey = null;
session.pendingSettlementPlacement = null;
session.authoringDraftPoints = [];
session.authoringTool = 'select';
session.authoringTerrainStroke = new Set<number>();
session.authoringTerrainStrokeActive = false;
session.authoredFeatureOriginal = null;
let authoredFeatureHistorySnapshot: EditorSnapshot | null = null;
session.authoredFeaturePointerStart = null;
let draggedImageId: string | null = null;
let draggedImageOffsetX = 0;
let draggedImageOffsetY = 0;
let draggedImageOriginal: PlacedImage | null = null;
let draggedImageHistorySnapshot: EditorSnapshot | null = null;
type WorkspaceMode = 'editor' | 'dm';
session.activeWorkspace = localStorage.getItem(WORKSPACE_STORAGE_KEY) === 'editor' ? 'editor' : 'dm';
session.dmSessionEntries = [];
session.activeStudioTab = 'inspector';
session.selectedInspectorItem = null;
let pointerTravel = 0;
let autosaveTimer: number | null = null;
const travelPlanner = new TravelPlannerController({
  elements: {
    canvas,
    fromLocation: travelFromLocation,
    toLocation: travelToLocation,
    mode: travelMode,
    traffic: travelTraffic,
    calculate: travelCalculate,
    reverse: travelReverse,
    clear: travelClear,
    pickFrom: travelPickFrom,
    pickTo: travelPickTo,
    alternatives: travelAlternatives,
    result: travelResult,
  },
  session,
  camera,
  syncMap: () => syncRendererCustomization(),
  requestRender: () => requestRender(),
  setStatus: (message, tone) => setStatus(message, tone),
});

const studioShell = new StudioShellController({
  session,
  elements: {
    toggleLeftPanelButton,
    toggleStudioDockButton,
    closeStudioDockButton,
    tabButtons: {
      inspector: studioTabInspector,
      layers: studioTabLayers,
      project: studioTabProject,
    },
    tabPanels: {
      inspector: studioInspectorPanel,
      layers: studioLayersPanel,
      project: studioProjectPanel,
    },
    layerList: studioLayerList,
    layerSearchInput,
    layersAllButton,
    layersNoneButton,
    themeSelect: studioThemeSelect,
    viewPreset,
    layerElements,
  },
  fitCamera: () => fitCamera(),
  requestRender: () => requestRender(),
  setLayer: (layer, visible) => setLayer(layer, visible),
});

const mapInspector = new MapInspectorController({
  session,
  camera,
  elements: {
    canvas,
    inspectorContent,
    focusSelectionButton,
    minimapPanel,
    minimapCanvas,
    minimapCollapseButton,
    statusSeed,
    statusLayout,
    statusZoom,
    statusSelection,
    statusGeneration,
  },
  fitCamera: () => fitCamera(),
  requestRender: () => requestRender(),
  openInspector: () => studioShell.setTab('inspector'),
  adoptRoad: (road) => adoptGeneratedRoad(road),
  adoptBuilding: (building) => adoptGeneratedBuilding(building),
  isGenerationRunning: () => activeGenerationController !== null,
});

const historyController = new EditorHistoryController({
  session,
  undoButton,
  redoButton,
  persist: () => persistAllEditorState(),
  applyLabels: () => labelDisplay.apply(session.labelSettings),
  regenerate: () => { generate(session.customAnchors, session.builtInOverrides, false, false); },
  scheduleAutosave: () => scheduleAutosave(),
  setStatus: (message, state) => setStatus(message, state),
});

const labelDisplay = new LabelDisplayController({
  session,
  elements: {
    roadFontSize: roadLabelFontSize,
    roadFontOutput: roadLabelFontOutput,
    roadOpacity: roadLabelOpacity,
    roadOpacityOutput: roadLabelOpacityOutput,
    roadDensity: roadLabelDensity,
    roadDensityOutput: roadLabelDensityOutput,
    roadMainZoom: roadLabelMainZoom,
    roadSecondaryZoom: roadLabelSecondaryZoom,
    roadLocalZoom: roadLabelLocalZoom,
    roadMain: roadLabelMain,
    roadSecondary: roadLabelSecondary,
    roadLocal: roadLabelLocal,
    roadRotate: roadLabelRotate,
    roadOutline: roadLabelOutline,
    roadSummary: roadLabelSummary,
    blockFontSize: blockLabelFontSize,
    blockFontOutput: blockLabelFontOutput,
    blockOpacity: blockLabelOpacity,
    blockOpacityOutput: blockLabelOpacityOutput,
    blockDensity: blockLabelDensity,
    blockDensityOutput: blockLabelDensityOutput,
    blockMinZoom: blockLabelMinZoom,
    blockOutline: blockLabelOutline,
    blockSummary: blockLabelSummary,
    avoidCollisions: labelAvoidCollisions,
    resetButton: labelControlsReset,
    viewPreset,
    layerElements,
  },
  captureSnapshot: () => captureEditorSnapshot(),
  recordHistory: (snapshot, label) => recordHistory(snapshot, label),
  setRenderedLayer: (layer, visible) => renderer.layers.setVisible(layer, visible),
  syncMap: () => syncRendererCustomization(),
  setStatus: (message, state) => setStatus(message, state),
});

const npcEditorView = new NpcEditorView({
  session,
  updateAuthoring: (next, message) => updateNpcAuthoringState(next, message),
  updateSchedule: (entries, message) => updateSelectedNpcSchedule(entries, message),
  updateRelationships: (relationships, message) => updateSelectedNpcRelationships(relationships, message),
  focusMapPoint: (x, y) => focusMapPoint(x, y),
  selectScheduleDay: (day) => session.selectNpcScheduleDay(day),
  selectLocation: (sourceRef) => session.selectLocation(sourceRef || null),
});

const npcJsonController = new NpcJsonController({
  session,
  updateAuthoring: (next, message) => updateNpcAuthoringState(next, message),
  setStatus: (message, tone) => setStatus(message, tone),
});

const assetLibrary = new AssetLibraryController<EditorSnapshot>({
  elements: { canvas, assetCount, assetList, placedImageList },
  session,
  repository: assetRepository,
  camera,
  createId: createRuleId,
  captureSnapshot: () => captureEditorSnapshot(),
  recordHistory: (snapshot, label) => recordHistory(snapshot, label),
  persist: () => persistMapCustomization(),
  syncMap: () => syncRendererCustomization(),
  onLibraryChanged: () => updateStats(stats, session.world),
  focusMapPoint: (x, y) => focusMapPoint(x, y),
  setStatus: (message, tone) => setStatus(message, tone),
});

const simulationPanel = new SimulationPanelController({
  renderer,
  session,
  getClockFormat: () => clockDisplayFormat,
  requestRender: () => requestRender(),
  onWorldRevision: (period) => {
    session.activeNpcSchedulePeriod = period;
    renderNPCList();
    travelPlanner.refreshLocations();
    mapInspector.renderInspector();
    travelPlanner.recalculateIfContextual();
  },
});

const nameEditor = new NameEditorController<EditorSnapshot>({
  session,
  captureSnapshot: () => captureEditorSnapshot(),
  recordHistory: (snapshot, label) => recordHistory(snapshot, label),
  persistNames: () => persistNames(),
  regenerateFrom: (stage, message) => regenerateFrom(stage, message),
  requestRender: () => requestRender(),
  setStatus: (message, tone) => setStatus(message, tone),
});

const npcController = new NpcController({
  session,
  regenerateRoster: () => regenerateNpcRoster(),
  renderList: () => renderNPCList(),
  toggleView: () => toggleNpcView(),
  filteredNpcs: () => filteredNpcs(),
  downloadJson: (npcs, name, includeWeeklySchedule) => npcJsonController.download(npcs, name, includeWeeklySchedule),
  importJson: (file) => npcJsonController.importFile(file),
  renderSelectors: (npc) => npcEditorView.renderSelectors(npc),
  campaignLocations: () => npcEditorView.campaignLocations(),
  nearestSettlementForTile: (tileIndex) => npcEditorView.nearestSettlementForTile(tileIndex),
  renderPortrait: (npc) => npcEditorView.renderPortrait(npc),
  renderLocation: () => npcEditorView.renderLocationEditor(),
  onAuthoringChanged: (message) => {
    persistMapCustomization();
    renderNPCList();
    npcEditorView.renderAll();
    travelPlanner.refreshLocations();
    campaignStudio?.refreshExternalReferences();
    updateStats(stats, session.world);
    requestRender();
    scheduleAutosave();
    if (message !== undefined) setStatus(message, 'success');
  },
  setStatus: (message, tone) => setStatus(message, tone),
});

new ProjectController({
  downloadProject: () => downloadWorld(),
  exportImage: () => exportVisibleMapImage(),
  exportCustomization: () => exportCustomization(),
  importCustomization: (file) => importCustomizationFile(file),
  importProject: (file) => importPayawJsonFile(file),
  restoreAutosave: () => restoreAutosave(),
  renderRecentProjects: () => renderRecentProjects(),
  setStatus: (message, tone) => setStatus(message, tone),
});

new GenerationController({
  session,
  generate: () => generateResponsive(session.customAnchors, session.builtInOverrides, true, true, true).then(() => undefined),
  cancel: () => activeGenerationController?.abort(),
  updateProfileHint: () => updateProfileHint(),
});

const authoringController = new AuthoringController<EditorSnapshot>({
  session,
  setTool: (tool) => setAuthoringTool(tool),
  beginSettlementPlacement: (duplicate) => beginSettlementPlacement(duplicate),
  applyAnchorDetails: () => commitAnchorDetails(),
  updateAnchorType: () => updateAuthoringAnchorTypeUi(),
  renderLists: () => renderAuthoringLists(),
  applyFeatureDetails: () => applyFeatureDetails(),
  finishFeature: () => finishAuthoredFeature(),
  captureSnapshot: () => captureEditorSnapshot(),
  persist: () => persistMapCustomization(),
  regenerateFrom: (stage, message) => regenerateFrom(stage, message),
  recordHistory: (snapshot, label) => recordHistory(snapshot, label),
  syncMap: () => syncRendererCustomization(),
  setAuthoringStatus: (message) => setAuthoringStatus(message),
  resetSelection: (deleteSelection) => resetAuthoringSelection(deleteSelection),
  setWorkspace: (workspace) => setWorkspace(workspace),
});

new MapInteractionController({
  canvas,
  viewportShell,
  camera,
  session,
  handleDrop: (event) => handleCanvasDrop(event),
  handlePointerDown: (event) => handleCanvasPointerDown(event),
  handlePointerMove: (event) => handleCanvasPointerMove(event),
  handlePointerEnd: (event, cancelled) => handleCanvasPointerEnd(event, cancelled),
  shouldIgnoreClick: () => pointerTravel > 5 || editMode || zoneEditMode || session.authoringTerrainStrokeActive
    || session.authoredFeatureOriginal !== null || dragPreview !== null || draggedImageId !== null,
  handleAuthoringClick: (x, y) => handleAuthoringMapClick(x, y),
  handleTravelClick: (x, y) => travelPlanner.handleMapPoint(x, y),
  inspectPosition: (x, y) => mapInspector.inspectMapPosition(x, y),
  fitCamera: () => fitCamera(),
  requestRender: () => requestRender(),
});

assetLibrary.updateImportTargetOptions();

function setAuthoringStatus(message: string, tone: 'neutral' | 'warning' | 'danger' = 'neutral'): void {
  authoringStatus.textContent = message;
  if (tone === 'neutral') delete authoringStatus.dataset.tone;
  else authoringStatus.dataset.tone = tone;
}

function updateAuthoringSelectionActions(): void {
  const selectedFeature = session.activeAuthoringFeatureId === null
    ? undefined
    : session.authoringLayer.features.find((feature) => feature.id === session.activeAuthoringFeatureId);
  const hasFeature = selectedFeature !== undefined;
  const hasSettlement = session.activeAuthoringSettlementKey !== null;
  authoringResetSelected.disabled = !hasFeature && !hasSettlement;
  authoringDeleteSelected.disabled = !hasFeature && !hasSettlement;
  authoringDuplicateSettlement.disabled = !hasSettlement && !isPointAnchorFeature(selectedFeature);
}

function setAuthoringTool(tool: typeof session.authoringTool): void {
  if (tool !== 'select') {
    if (editMode) setEditMode(false);
    if (zoneEditMode) setZoneEditMode(false);
  }
  session.authoringTool = tool;
  authoringModeBadge.textContent = tool.replace('-', ' ').toLocaleUpperCase();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-authoring-tool]')) {
    button.classList.toggle('active', button.dataset.authoringTool === tool);
  }
  canvas.classList.remove('authoring-crosshair', 'authoring-drawing', 'authoring-terrain', 'authoring-select');
  canvas.classList.add(tool === 'terrain-brush' ? 'authoring-terrain' : tool === 'select' ? 'authoring-select' : tool === 'anchor' || tool === 'point' ? 'authoring-crosshair' : 'authoring-drawing');
  if (tool !== 'polyline' && tool !== 'polygon') session.authoringDraftPoints = [];
  authoringFinishFeature.disabled = !(tool === 'polyline' || tool === 'polygon') || session.authoringDraftPoints.length < (tool === 'polygon' ? 3 : 2);
  authoringCancelFeature.disabled = tool === 'select' && session.pendingSettlementPlacement === null && !session.pendingPointAnchorPlacement && session.authoringDraftPoints.length === 0;
  if (tool === 'select') setAuthoringStatus('Select or move point anchors and community settlements on the map.');
  else if (tool === 'anchor') {
    const anchorType = selectedAuthoringAnchorType();
    const moving = anchorType === 'point'
      ? session.activeAuthoringFeatureId !== null && isPointAnchorFeature(session.authoringLayer.features.find((feature) => feature.id === session.activeAuthoringFeatureId))
      : session.activeAuthoringSettlementKey !== null && session.pendingSettlementPlacement === null;
    setAuthoringStatus(moving
      ? `Click the map to move the selected ${anchorType === 'point' ? 'anchor point' : 'community anchor'}.`
      : `Click the map to place the new ${anchorType === 'point' ? 'anchor point' : 'community anchor'}. Placement warnings will not block you.`);
  }
  else if (tool === 'point') setAuthoringStatus('Click the map to place the authored feature.');
  else if (tool === 'polyline') setAuthoringStatus('Click to add path vertices, then Finish shape.');
  else if (tool === 'polygon') setAuthoringStatus('Click around the area boundary, then Finish shape.');
  else setAuthoringStatus('Drag the brush over the map. Changes commit when you release the pointer.');
  syncRendererCustomization();
}

function upsertSettlementAuthoringOverride(next: SettlementAuthoringOverride): void {
  session.authoringLayer = {
    ...session.authoringLayer,
    settlementOverrides: [...session.authoringLayer.settlementOverrides.filter((item) => item.key !== next.key), next],
  };
}

function removeSettlementAuthoringOverride(key: string): void {
  session.authoringLayer = { ...session.authoringLayer, settlementOverrides: session.authoringLayer.settlementOverrides.filter((item) => item.key !== key) };
}

type AuthoringAnchorType = 'point' | SettlementKind;

function selectedAuthoringAnchorType(): AuthoringAnchorType {
  const value = authoringSettlementKind.value;
  return value === 'point' || SETTLEMENT_KINDS.includes(value as SettlementKind)
    ? value as AuthoringAnchorType
    : 'point';
}

function isSettlementAnchorType(value: AuthoringAnchorType): value is SettlementKind {
  return value !== 'point';
}

type PointAnchorFeature = AuthoredMapFeature & {
  readonly subtype: 'anchor-point';
  readonly geometry: { readonly kind: 'point'; readonly point: AuthoringPoint };
};

function isPointAnchorFeature(feature: AuthoredMapFeature | undefined): feature is PointAnchorFeature {
  return feature !== undefined
    && feature.category === 'landmark'
    && feature.subtype === 'anchor-point'
    && feature.geometry.kind === 'point';
}

function updateAuthoringAnchorTypeUi(): void {
  const settlement = isSettlementAnchorType(selectedAuthoringAnchorType());
  for (const field of settlementAnchorOnlyFields) field.hidden = !settlement;
  authoringPlaceSettlement.textContent = settlement ? 'Place settlement anchor' : 'Place point anchor';
  const selectedPoint = session.activeAuthoringFeatureId === null
    ? undefined
    : session.authoringLayer.features.find((feature) => feature.id === session.activeAuthoringFeatureId);
  authoringApplySettlement.disabled = settlement ? session.activeAuthoringSettlementKey === null : !isPointAnchorFeature(selectedPoint);
  updateAuthoringSelectionActions();
}

function pointAnchorFromForm(x: number, y: number, nameSuffix = ''): AuthoredMapFeature {
  const now = new Date().toISOString();
  const visibility = authoringSettlementVisibility.value as AuthoringVisibility;
  return {
    id: createRuleId(),
    name: `${authoringSettlementName.value.trim() || 'New Anchor'}${nameSuffix}`,
    category: 'landmark',
    subtype: 'anchor-point',
    geometry: { kind: 'point', point: { x, y } },
    realityLayer: 'normal',
    visibility,
    locked: false,
    hidden: visibility === 'hidden',
    opacity: 1,
    lineWidth: 2,
    fillOpacity: 0.2,
    color: '#f2c05e',
    rotation: 0,
    scale: 1,
    aliases: [],
    tags: ['anchor-point'],
    notes: authoringSettlementNotes.value.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

function settlementFormValues(): Omit<AuthoredSettlementDefinition, 'key' | 'x' | 'y'> {
  return {
    name: authoringSettlementName.value.trim() || 'New Community',
    kind: authoringSettlementKind.value as SettlementKind,
    radius: Math.max(2, Math.min(100, Number(authoringSettlementRadius.value) || 10)),
    rotation: Math.max(-180, Math.min(180, Number(authoringSettlementRotation.value) || 0)) * Math.PI / 180,
    populationTarget: Math.max(0, Math.min(500_000, Math.round(Number(authoringSettlementPopulation.value) || 0))),
    density: Math.max(0, Math.min(1, Number(authoringSettlementDensity.value) || 0.55)),
    parentKey: authoringSettlementParent.value || null,
    generateRoads: authoringSettlementRoads.checked,
    generateBuildings: authoringSettlementBuildings.checked,
    locked: false,
    hidden: authoringSettlementVisibility.value === 'hidden',
    visibility: authoringSettlementVisibility.value as AuthoringVisibility,
    notes: authoringSettlementNotes.value.trim(),
  };
}

function populateSettlementParentOptions(): void {
  const selected = authoringSettlementParent.value;
  authoringSettlementParent.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'None';
  authoringSettlementParent.append(none);
  if (session.world !== undefined) {
    for (const settlement of session.world.settlements) {
      if (settlement.key === session.activeAuthoringSettlementKey) continue;
      const option = document.createElement('option');
      option.value = settlement.key;
      option.textContent = settlement.name;
      authoringSettlementParent.append(option);
    }
  }
  authoringSettlementParent.value = [...authoringSettlementParent.options].some((option) => option.value === selected) ? selected : '';
}

function loadSettlementIntoForm(key: string): void {
  const settlement = session.world.settlements.find((item) => item.key === key);
  if (settlement === undefined) return;
  session.activeAuthoringSettlementKey = key;
  session.activeAuthoringFeatureId = null;
  session.pendingSettlementPlacement = null;
  authoringSettlementName.value = settlement.name;
  authoringSettlementKind.value = settlement.kind ?? (settlement.isPrimary ? 'city' : 'barangay');
  updateAuthoringAnchorTypeUi();
  authoringSettlementRadius.value = String(Math.round(settlement.influenceRadius));
  authoringSettlementRotation.value = String(Math.round((settlement.rotation ?? 0) * 180 / Math.PI));
  authoringSettlementPopulation.value = String(settlement.populationTarget);
  authoringSettlementDensity.value = String(settlement.density ?? 0.55);
  authoringSettlementVisibility.value = settlement.visibility ?? (settlement.hidden === true ? 'hidden' : 'players');
  authoringSettlementNotes.value = settlement.notes ?? '';
  authoringSettlementRoads.checked = settlement.generateRoads !== false;
  authoringSettlementBuildings.checked = settlement.generateBuildings !== false;
  populateSettlementParentOptions();
  authoringSettlementParent.value = settlement.parentKey ?? '';
  updateAuthoringSelectionActions();
  renderAuthoringLists();
  syncRendererCustomization();
  setAuthoringStatus(`Selected ${settlement.name}. Edit its properties, move it on the map, lock it, hide it, or reset it.`);
}

function loadPointAnchorIntoForm(id: string): void {
  const feature = session.authoringLayer.features.find((item) => item.id === id);
  if (!isPointAnchorFeature(feature)) return;
  session.activeAuthoringFeatureId = id;
  session.activeAuthoringSettlementKey = null;
  session.pendingPointAnchorPlacement = false;
  session.pendingSettlementPlacement = null;
  authoringSettlementKind.value = 'point';
  authoringSettlementName.value = feature.name;
  authoringSettlementVisibility.value = feature.visibility;
  authoringSettlementNotes.value = feature.notes;
  updateAuthoringAnchorTypeUi();
  updateAuthoringSelectionActions();
  renderAuthoringLists();
  syncRendererCustomization();
  setAuthoringStatus(`Selected ${feature.name}. Edit its anchor details, move it, duplicate it, hide it, or delete it.`);
}

function loadFeatureIntoForm(id: string): void {
  const feature = session.authoringLayer.features.find((item) => item.id === id);
  if (feature === undefined) return;
  session.activeAuthoringFeatureId = id;
  session.activeAuthoringSettlementKey = null;
  authoringFeatureName.value = feature.name;
  authoringFeatureCategory.value = feature.category;
  authoringFeatureSubtype.value = feature.subtype;
  authoringFeatureReality.value = feature.realityLayer;
  authoringFeatureVisibility.value = feature.visibility;
  authoringFeatureColor.value = feature.color ?? '#d1aa72';
  authoringFeatureLineWidth.value = String(feature.lineWidth);
  authoringFeatureFill.value = String(feature.fillOpacity);
  authoringFeatureScale.value = String(feature.scale);
  authoringFeatureRotation.value = String(Math.round(feature.rotation * 180 / Math.PI));
  authoringFeatureOpacity.value = String(feature.opacity);
  authoringFeatureAliases.value = feature.aliases.join(', ');
  authoringFeatureNotes.value = feature.notes;
  authoringStartFeature.textContent = 'Apply feature details';
  updateAuthoringSelectionActions();
  renderAuthoringLists();
  syncRendererCustomization();
  setAuthoringStatus(`Selected ${feature.name}. Drag it in Select mode or apply revised metadata.`);
}

function authoredFeatureFromGeometry(geometry: AuthoringGeometry): AuthoredMapFeature {
  const now = new Date().toISOString();
  const category = authoringFeatureCategory.value as AuthoringFeatureCategory;
  const realityLayer = category === 'hidden-payaw' ? 'hidden-payaw' : authoringFeatureReality.value as AuthoringRealityLayer;
  return {
    id: createRuleId(),
    name: authoringFeatureName.value.trim() || 'Authored feature',
    category,
    subtype: authoringFeatureSubtype.value.trim() || 'custom',
    geometry,
    realityLayer,
    visibility: authoringFeatureVisibility.value as AuthoringVisibility,
    locked: false,
    hidden: authoringFeatureVisibility.value === 'hidden',
    opacity: Math.max(0.1, Math.min(1, Number(authoringFeatureOpacity.value) || 0.92)),
    lineWidth: Math.max(0.5, Number(authoringFeatureLineWidth.value) || 2),
    fillOpacity: Math.max(0, Math.min(0.7, Number(authoringFeatureFill.value) || 0)),
    color: normalizeHexColor(authoringFeatureColor.value),
    rotation: Math.max(-180, Math.min(180, Number(authoringFeatureRotation.value) || 0)) * Math.PI / 180,
    scale: Math.max(0.25, Math.min(8, Number(authoringFeatureScale.value) || 1)),
    aliases: authoringFeatureAliases.value.split(',').map((value) => value.trim()).filter(Boolean),
    tags: [],
    notes: authoringFeatureNotes.value.trim(),
    createdAt: now,
    updatedAt: now,
  };
}


function suppressGeneratedFeature(override: GeneratedFeatureOverride): void {
  session.authoringLayer = {
    ...session.authoringLayer,
    generatedFeatureOverrides: [
      ...session.authoringLayer.generatedFeatureOverrides.filter((item) => !(item.entityType === override.entityType && item.entityId === override.entityId)),
      override,
    ],
  };
}

function adoptGeneratedRoad(road: Road): void {
  if (road.source === 'authored' || road.path.length < 2 || road.bridgeId !== null || road.portId !== null) return;
  const sourceId = road.generatedId ?? road.id;
  const points = road.path.flatMap((tileIndex, index) => {
    const tile = session.world.tiles[tileIndex];
    if (tile === undefined) return [];
    const keep = index === 0 || index === road.path.length - 1 || index % 3 === 0;
    return keep ? [{ x: tile.x, y: tile.y }] : [];
  });
  if (points.length < 2) return;
  const snapshot = captureEditorSnapshot();
  const feature = createGeneratedReplacementFeature(road.name || `Road ${sourceId + 1}`, 'road', road.type, { kind: 'polyline', points }, sourceId);
  suppressGeneratedFeature({ key: `generated-road:${sourceId}`, entityType: 'road', entityId: sourceId, suppressed: true, locked: false });
  session.authoringLayer = { ...session.authoringLayer, features: [...session.authoringLayer.features, feature] };
  session.activeAuthoringFeatureId = feature.id;
  persistMapCustomization();
  if (regenerateFrom('road-network', `Converted ${feature.name} into an authored road.`)) recordHistory(snapshot, `adopt road ${sourceId}`);
  loadFeatureIntoForm(feature.id);
}

function adoptGeneratedBuilding(building: Building): void {
  if (building.footprint.length < 3) return;
  const sourceId = building.generatedId ?? building.id;
  const snapshot = captureEditorSnapshot();
  const name = building.authoredName ?? building.type.replaceAll('-', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  const feature = createGeneratedReplacementFeature(name, 'building', building.type, { kind: 'polygon', points: building.footprint.map((point) => ({ x: point.x, y: point.y })) }, sourceId);
  suppressGeneratedFeature({ key: `generated-building:${sourceId}`, entityType: 'building', entityId: sourceId, suppressed: true, locked: false });
  session.authoringLayer = { ...session.authoringLayer, features: [...session.authoringLayer.features, feature] };
  session.activeAuthoringFeatureId = feature.id;
  persistMapCustomization();
  if (regenerateFrom('buildings', `Converted building #${sourceId} into an authored building.`)) recordHistory(snapshot, `adopt building ${sourceId}`);
  loadFeatureIntoForm(feature.id);
}

function featureRegenerationStage(feature: AuthoredMapFeature): string | null {
  if (feature.category === 'river') return 'terrain';
  if (feature.category === 'road') return 'road-network';
  if (feature.category === 'building') return 'buildings';
  return null;
}

function commitAuthoredFeature(feature: AuthoredMapFeature, label: string, snapshot: EditorSnapshot): void {
  session.authoringLayer = { ...session.authoringLayer, features: [...session.authoringLayer.features, feature] };
  persistMapCustomization();
  session.activeAuthoringFeatureId = feature.id;
  session.activeAuthoringSettlementKey = null;
  session.authoringDraftPoints = [];
  const stage = featureRegenerationStage(feature);
  if (stage !== null) regenerateFrom(stage, `Added ${feature.name}.`);
  else {
    syncRendererCustomization();
    renderAuthoringLists();
    scheduleAutosave();
  }
  recordHistory(snapshot, label);
  loadFeatureIntoForm(feature.id);
}

function finishAuthoredFeature(): void {
  const minimum = session.authoringTool === 'polygon' ? 3 : 2;
  if ((session.authoringTool !== 'polyline' && session.authoringTool !== 'polygon') || session.authoringDraftPoints.length < minimum) {
    setAuthoringStatus(`Add at least ${minimum} points before finishing.`, 'warning');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const geometry: AuthoringGeometry = session.authoringTool === 'polygon'
    ? { kind: 'polygon', points: [...session.authoringDraftPoints] }
    : { kind: 'polyline', points: [...session.authoringDraftPoints] };
  const feature = authoredFeatureFromGeometry(geometry);
  commitAuthoredFeature(feature, `draw ${feature.category}`, snapshot);
  setAuthoringTool('select');
}

function applyFeatureDetails(): void {
  if (session.activeAuthoringFeatureId === null) {
    const category = authoringFeatureCategory.value as AuthoringFeatureCategory;
    const inferred: typeof session.authoringTool = category === 'road' || category === 'river'
      ? 'polyline'
      : category === 'district' || category === 'terrain' || category === 'building'
        ? 'polygon'
        : 'point';
    setAuthoringTool(inferred);
    return;
  }
  const existing = session.authoringLayer.features.find((item) => item.id === session.activeAuthoringFeatureId);
  if (existing === undefined) return;
  const snapshot = captureEditorSnapshot();
  const category = authoringFeatureCategory.value as AuthoringFeatureCategory;
  const updated: AuthoredMapFeature = {
    ...existing,
    name: authoringFeatureName.value.trim() || existing.name,
    category,
    subtype: authoringFeatureSubtype.value.trim() || 'custom',
    realityLayer: category === 'hidden-payaw' ? 'hidden-payaw' : authoringFeatureReality.value as AuthoringRealityLayer,
    visibility: authoringFeatureVisibility.value as AuthoringVisibility,
    hidden: authoringFeatureVisibility.value === 'hidden',
    color: normalizeHexColor(authoringFeatureColor.value),
    lineWidth: Math.max(0.5, Number(authoringFeatureLineWidth.value) || 2),
    fillOpacity: Math.max(0, Math.min(0.7, Number(authoringFeatureFill.value) || 0)),
    opacity: Math.max(0.1, Math.min(1, Number(authoringFeatureOpacity.value) || existing.opacity)),
    rotation: Math.max(-180, Math.min(180, Number(authoringFeatureRotation.value) || 0)) * Math.PI / 180,
    scale: Math.max(0.25, Math.min(8, Number(authoringFeatureScale.value) || 1)),
    aliases: authoringFeatureAliases.value.split(',').map((value) => value.trim()).filter(Boolean),
    notes: authoringFeatureNotes.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  session.authoringLayer = { ...session.authoringLayer, features: session.authoringLayer.features.map((item) => item.id === updated.id ? updated : item) };
  persistMapCustomization();
  const oldStage = featureRegenerationStage(existing);
  const newStage = featureRegenerationStage(updated);
  const stage = oldStage === 'terrain' || newStage === 'terrain' ? 'terrain' : oldStage === 'road-network' || newStage === 'road-network' ? 'road-network' : null;
  if (stage !== null) regenerateFrom(stage, `Updated ${updated.name}.`);
  else { syncRendererCustomization(); renderAuthoringLists(); }
  recordHistory(snapshot, `edit ${updated.name}`);
  setAuthoringStatus(`Updated ${updated.name}.`);
}

function geometryDistance(feature: AuthoredMapFeature, x: number, y: number): number {
  const geometry = transformAuthoringGeometry(feature.geometry, feature.rotation, feature.scale);
  if (geometry.kind === 'point') return Math.hypot(x - geometry.point.x, y - geometry.point.y);
  if (geometry.kind === 'circle') return Math.abs(Math.hypot(x - geometry.center.x, y - geometry.center.y) - geometry.radius);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < geometry.points.length - 1; index += 1) {
    const a = geometry.points[index];
    const b = geometry.points[index + 1];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  if (geometry.kind === 'polygon') {
    const first = geometry.points[0];
    const last = geometry.points[geometry.points.length - 1];
    if (first !== undefined && last !== undefined) {
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - last.x) * dx + (y - last.y) * dy) / lengthSquared));
      best = Math.min(best, Math.hypot(x - (last.x + dx * t), y - (last.y + dy * t)));
    }
  }
  return best;
}

function hitAuthoredFeature(x: number, y: number): AuthoredMapFeature | undefined {
  const threshold = Math.max(1.2, 9 / Math.max(1, camera.zoom));
  return [...session.authoringLayer.features].reverse().find((feature) => !feature.hidden && geometryDistance(feature, x, y) <= threshold);
}

function duplicateAuthoredFeature(feature: AuthoredMapFeature): void {
  const snapshot = captureEditorSnapshot();
  const now = new Date().toISOString();
  const duplicate: AuthoredMapFeature = {
    ...feature,
    id: createRuleId(),
    name: `${feature.name} Copy`,
    geometry: translateAuthoringGeometry(feature.geometry, 2, 2),
    locked: false,
    hidden: false,
    tags: feature.tags.filter((tag) => !tag.startsWith('generated-source:')),
    createdAt: now,
    updatedAt: now,
  };
  session.authoringLayer = { ...session.authoringLayer, features: [...session.authoringLayer.features, duplicate] };
  session.activeAuthoringFeatureId = duplicate.id;
  session.activeAuthoringSettlementKey = null;
  persistMapCustomization();
  const stage = featureRegenerationStage(duplicate);
  if (stage !== null) regenerateFrom(stage, `Duplicated ${feature.name}.`);
  else { renderAuthoringLists(); syncRendererCustomization(); scheduleAutosave(); }
  recordHistory(snapshot, `duplicate ${feature.name}`);
  loadFeatureIntoForm(duplicate.id);
}

function renderAuthoringLists(): void {
  populateSettlementParentOptions();
  authoringSettlementList.replaceChildren();
  for (const feature of session.authoringLayer.features.filter(isPointAnchorFeature)) {
    const item = document.createElement('article');
    item.className = 'authoring-item';
    item.dataset.selected = String(session.activeAuthoringFeatureId === feature.id);
    item.dataset.hidden = String(feature.hidden);
    const copy = document.createElement('div');
    copy.className = 'authoring-item-copy';
    const title = document.createElement('strong');
    title.textContent = feature.name;
    const detail = document.createElement('small');
    detail.textContent = `Authored · point of interest${feature.locked ? ' · locked' : ''}`;
    copy.append(title, detail);
    const actions = document.createElement('div');
    actions.className = 'authoring-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => loadPointAnchorIntoForm(feature.id));
    const focus = document.createElement('button');
    focus.type = 'button'; focus.textContent = 'Focus'; focus.addEventListener('click', () => { const center = authoringFeatureCenter(feature); focusMapPoint(center.x, center.y); });
    const duplicate = document.createElement('button');
    duplicate.type = 'button'; duplicate.textContent = 'Duplicate'; duplicate.addEventListener('click', () => { loadPointAnchorIntoForm(feature.id); beginSettlementPlacement(true); });
    const lock = document.createElement('button');
    lock.type = 'button'; lock.textContent = feature.locked ? 'Unlock' : 'Lock';
    lock.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      session.authoringLayer = { ...session.authoringLayer, features: session.authoringLayer.features.map((candidate) => candidate.id === feature.id ? { ...candidate, locked: !candidate.locked, updatedAt: new Date().toISOString() } : candidate) };
      persistMapCustomization(); renderAuthoringLists(); syncRendererCustomization(); recordHistory(snapshot, `${feature.locked ? 'unlock' : 'lock'} anchor point`);
    });
    const hide = document.createElement('button');
    hide.type = 'button'; hide.textContent = feature.hidden ? 'Show' : 'Hide';
    hide.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      session.authoringLayer = { ...session.authoringLayer, features: session.authoringLayer.features.map((candidate) => candidate.id === feature.id ? { ...candidate, hidden: !candidate.hidden, visibility: candidate.hidden ? 'players' : 'hidden', updatedAt: new Date().toISOString() } : candidate) };
      persistMapCustomization(); renderAuthoringLists(); syncRendererCustomization(); recordHistory(snapshot, `${feature.hidden ? 'show' : 'hide'} anchor point`);
    });
    actions.append(edit, focus, duplicate, lock, hide);
    item.append(copy, actions);
    authoringSettlementList.append(item);
  }
  if (session.world !== undefined) {
    for (const settlement of session.world.settlements) {
      const item = document.createElement('article');
      item.className = 'authoring-item';
      item.dataset.selected = String(session.activeAuthoringSettlementKey === settlement.key);
      item.dataset.hidden = String(settlement.hidden === true);
      const copy = document.createElement('div');
      copy.className = 'authoring-item-copy';
      const title = document.createElement('strong');
      title.textContent = settlement.name;
      const detail = document.createElement('small');
      detail.textContent = `${settlement.source === 'authored' ? 'Authored' : 'Generated'} · ${(settlement.kind ?? settlement.type).replaceAll('-', ' ')} · ${Math.round(settlement.influenceRadius)} tile radius${settlement.locked === true ? ' · locked' : ''}`;
      copy.append(title, detail);
      const actions = document.createElement('div');
      actions.className = 'authoring-item-actions';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => loadSettlementIntoForm(settlement.key));
      const focus = document.createElement('button');
      focus.type = 'button'; focus.textContent = 'Focus'; focus.addEventListener('click', () => focusMapPoint(settlement.x, settlement.y));
      const lock = document.createElement('button');
      lock.type = 'button'; lock.textContent = settlement.locked === true ? 'Unlock' : 'Lock';
      lock.addEventListener('click', () => {
        const snapshot = captureEditorSnapshot();
        const existing = session.authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
        upsertSettlementAuthoringOverride({ ...existing, key: settlement.key, locked: settlement.locked !== true });
        persistMapCustomization();
        if (regenerateFrom('settlements', `${settlement.locked === true ? 'Unlocked' : 'Locked'} ${settlement.name}.`)) recordHistory(snapshot, `${settlement.locked === true ? 'unlock' : 'lock'} settlement`);
      });
      const hide = document.createElement('button');
      hide.type = 'button'; hide.textContent = settlement.hidden === true ? 'Show' : 'Hide';
      hide.addEventListener('click', () => {
        const snapshot = captureEditorSnapshot();
        const existing = session.authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
        upsertSettlementAuthoringOverride({ ...existing, key: settlement.key, hidden: settlement.hidden !== true, visibility: settlement.hidden === true ? 'players' : 'hidden' });
        persistMapCustomization();
        if (regenerateFrom('settlements', `${settlement.hidden === true ? 'Showed' : 'Hid'} ${settlement.name}.`)) recordHistory(snapshot, `${settlement.hidden === true ? 'show' : 'hide'} settlement`);
      });
      actions.append(edit, focus, lock, hide);
      item.append(copy, actions);
      authoringSettlementList.append(item);
    }
  }

  authoringFeatureList.replaceChildren();
  for (const feature of session.authoringLayer.features.filter((candidate) => !isPointAnchorFeature(candidate))) {
    const item = document.createElement('article');
    item.className = 'authoring-item';
    item.dataset.selected = String(session.activeAuthoringFeatureId === feature.id);
    item.dataset.hidden = String(feature.hidden);
    const copy = document.createElement('div');
    copy.className = 'authoring-item-copy';
    const title = document.createElement('strong');
    title.textContent = feature.name;
    const detail = document.createElement('small');
    detail.textContent = `${feature.category.replaceAll('-', ' ')} · ${feature.subtype.replaceAll('-', ' ')} · ${feature.geometry.kind}${feature.locked ? ' · locked' : ''}`;
    copy.append(title, detail);
    const actions = document.createElement('div');
    actions.className = 'authoring-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => loadFeatureIntoForm(feature.id));
    const focus = document.createElement('button');
    focus.type = 'button'; focus.textContent = 'Focus'; focus.addEventListener('click', () => { const center = authoringFeatureCenter(feature); focusMapPoint(center.x, center.y); });
    const duplicate = document.createElement('button');
    duplicate.type = 'button'; duplicate.textContent = 'Duplicate'; duplicate.addEventListener('click', () => duplicateAuthoredFeature(feature));
    const lock = document.createElement('button');
    lock.type = 'button'; lock.textContent = feature.locked ? 'Unlock' : 'Lock';
    lock.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      session.authoringLayer = { ...session.authoringLayer, features: session.authoringLayer.features.map((itemFeature) => itemFeature.id === feature.id ? { ...itemFeature, locked: !itemFeature.locked, updatedAt: new Date().toISOString() } : itemFeature) };
      persistMapCustomization(); renderAuthoringLists(); syncRendererCustomization(); recordHistory(snapshot, `${feature.locked ? 'unlock' : 'lock'} feature`);
    });
    const hide = document.createElement('button');
    hide.type = 'button'; hide.textContent = feature.hidden ? 'Show' : 'Hide';
    hide.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      const updated = { ...feature, hidden: !feature.hidden, updatedAt: new Date().toISOString() };
      session.authoringLayer = { ...session.authoringLayer, features: session.authoringLayer.features.map((itemFeature) => itemFeature.id === feature.id ? updated : itemFeature) };
      persistMapCustomization();
      const stage = featureRegenerationStage(feature);
      if (stage !== null) regenerateFrom(stage, `${updated.hidden ? 'Hid' : 'Showed'} ${feature.name}.`);
      else { renderAuthoringLists(); syncRendererCustomization(); }
      recordHistory(snapshot, `${updated.hidden ? 'hide' : 'show'} feature`);
    });
    actions.append(edit, focus, duplicate, lock, hide);
    item.append(copy, actions);
    authoringFeatureList.append(item);
  }
  updateAuthoringSelectionActions();
}

function commitAnchorDetails(): void {
  const anchorType = selectedAuthoringAnchorType();
  if (anchorType === 'point') {
    const feature = session.activeAuthoringFeatureId === null
      ? undefined
      : session.authoringLayer.features.find((candidate) => candidate.id === session.activeAuthoringFeatureId);
    if (!isPointAnchorFeature(feature)) {
      setAuthoringStatus('Select a point anchor first, or choose Place point anchor to create one.', 'warning');
      return;
    }
    const snapshot = captureEditorSnapshot();
    const visibility = authoringSettlementVisibility.value as AuthoringVisibility;
    const updated: AuthoredMapFeature = {
      ...feature,
      name: authoringSettlementName.value.trim() || feature.name,
      visibility,
      hidden: visibility === 'hidden',
      notes: authoringSettlementNotes.value.trim(),
      updatedAt: new Date().toISOString(),
    };
    session.authoringLayer = {
      ...session.authoringLayer,
      features: session.authoringLayer.features.map((candidate) => candidate.id === updated.id ? updated : candidate),
    };
    persistMapCustomization();
    renderAuthoringLists();
    syncRendererCustomization();
    recordHistory(snapshot, `edit anchor point ${feature.name}`);
    setAuthoringStatus(`Updated ${updated.name}.`, 'neutral');
    return;
  }

  if (session.activeAuthoringSettlementKey === null) {
    setAuthoringStatus('Select a settlement anchor first, or choose Place settlement anchor to create one.', 'warning');
    return;
  }
  const settlement = session.world.settlements.find((item) => item.key === session.activeAuthoringSettlementKey);
  if (settlement === undefined) return;
  const snapshot = captureEditorSnapshot();
  const values = settlementFormValues();
  const existing = session.authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
  upsertSettlementAuthoringOverride({
    ...existing,
    key: settlement.key,
    name: values.name,
    kind: values.kind,
    radius: values.radius,
    rotation: values.rotation,
    populationTarget: values.populationTarget,
    density: values.density,
    generateRoads: values.generateRoads,
    generateBuildings: values.generateBuildings,
    parentKey: values.parentKey,
    visibility: values.visibility,
    hidden: values.hidden,
    notes: values.notes,
  });
  if (settlement.source === 'authored') {
    session.authoringLayer = {
      ...session.authoringLayer,
      authoredSettlements: session.authoringLayer.authoredSettlements.map((item) => item.key === settlement.key
        ? { ...item, rotation: values.rotation, populationTarget: values.populationTarget, density: values.density, generateRoads: values.generateRoads, generateBuildings: values.generateBuildings }
        : item),
    };
  }
  persistMapCustomization();
  if (regenerateFrom('settlements', `Updated ${values.name}.`)) recordHistory(snapshot, `edit settlement anchor ${settlement.name}`);
}

function beginSettlementPlacement(duplicate = false): void {
  const anchorType = selectedAuthoringAnchorType();
  if (anchorType === 'point') {
    const selectedFeature = session.activeAuthoringFeatureId === null
      ? undefined
      : session.authoringLayer.features.find((feature) => feature.id === session.activeAuthoringFeatureId);
    if (isPointAnchorFeature(selectedFeature) && !duplicate) {
      session.pendingPointAnchorPlacement = false;
      setAuthoringTool('anchor');
      return;
    }
    session.pendingPointAnchorPlacement = true;
    session.pendingSettlementPlacement = null;
    if (!duplicate) session.activeAuthoringFeatureId = null;
    session.activeAuthoringSettlementKey = null;
    setAuthoringTool('anchor');
    return;
  }

  const values = settlementFormValues();
  if (session.activeAuthoringSettlementKey !== null && !duplicate) {
    session.pendingSettlementPlacement = null;
    session.pendingPointAnchorPlacement = false;
    setAuthoringTool('anchor');
    return;
  }
  let x = session.world.width / 2;
  let y = session.world.height / 2;
  if (duplicate && session.activeAuthoringSettlementKey !== null) {
    const source = session.world.settlements.find((item) => item.key === session.activeAuthoringSettlementKey);
    if (source !== undefined) { x = source.x + 3; y = source.y + 3; }
  }
  session.pendingSettlementPlacement = {
    key: `settlement:authored:${createRuleId()}`,
    ...values,
    name: duplicate ? `${values.name} Copy` : values.name,
    x,
    y,
  };
  session.pendingPointAnchorPlacement = false;
  session.activeAuthoringSettlementKey = null;
  session.activeAuthoringFeatureId = null;
  setAuthoringTool('anchor');
}

function placePendingAnchor(x: number, y: number): void {
  const anchorType = selectedAuthoringAnchorType();
  if (anchorType === 'point') {
    const selectedFeature = session.activeAuthoringFeatureId === null
      ? undefined
      : session.authoringLayer.features.find((feature) => feature.id === session.activeAuthoringFeatureId);
    if (!session.pendingPointAnchorPlacement && isPointAnchorFeature(selectedFeature)) {
      if (selectedFeature.locked) {
        setAuthoringStatus(`${selectedFeature.name} is locked. Unlock it before moving.`, 'warning');
        setAuthoringTool('select');
        return;
      }
      const snapshot = captureEditorSnapshot();
      const updated: AuthoredMapFeature = {
        ...selectedFeature,
        geometry: { kind: 'point', point: { x, y } },
        updatedAt: new Date().toISOString(),
      };
      session.authoringLayer = { ...session.authoringLayer, features: session.authoringLayer.features.map((feature) => feature.id === updated.id ? updated : feature) };
      persistMapCustomization();
      renderAuthoringLists();
      syncRendererCustomization();
      recordHistory(snapshot, `move anchor point ${selectedFeature.name}`);
      setAuthoringTool('select');
      loadPointAnchorIntoForm(updated.id);
      return;
    }
    const snapshot = captureEditorSnapshot();
    const feature = pointAnchorFromForm(x, y, session.pendingPointAnchorPlacement && selectedFeature !== undefined ? ' Copy' : '');
    session.authoringLayer = { ...session.authoringLayer, features: [...session.authoringLayer.features, feature] };
    session.pendingPointAnchorPlacement = false;
    session.activeAuthoringFeatureId = feature.id;
    session.activeAuthoringSettlementKey = null;
    persistMapCustomization();
    renderAuthoringLists();
    syncRendererCustomization();
    recordHistory(snapshot, `create anchor point ${feature.name}`);
    setAuthoringTool('select');
    loadPointAnchorIntoForm(feature.id);
    return;
  }

  if (session.pendingSettlementPlacement === null) {
    if (session.activeAuthoringSettlementKey !== null) commitSettlementMove(session.activeAuthoringSettlementKey, x, y);
    setAuthoringTool('select');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const definition: AuthoredSettlementDefinition = { ...session.pendingSettlementPlacement, x: Math.round(x), y: Math.round(y) };
  session.authoringLayer = { ...session.authoringLayer, authoredSettlements: [...session.authoringLayer.authoredSettlements, definition] };
  session.pendingSettlementPlacement = null;
  session.activeAuthoringSettlementKey = definition.key;
  persistMapCustomization();
  if (regenerateFrom('settlements', `Created ${definition.name}.`)) recordHistory(snapshot, `create ${definition.kind} anchor`);
  setAuthoringTool('select');
  loadSettlementIntoForm(definition.key);
}


function commitAuthoringTerrain(indices: readonly number[]): void {
  if (indices.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const operation = authoringTerrainOperation.value;
  const strength = Math.max(0.01, Number(authoringTerrainStrength.value) || 0.08);
  const byIndex = new Map(session.authoringLayer.terrainOverrides.map((override) => [override.tileIndex, override]));
  for (const tileIndex of indices) {
    const current = byIndex.get(tileIndex) ?? { tileIndex, locked: false };
    if (current.locked && operation !== 'restore') continue;
    if (operation === 'restore') {
      byIndex.delete(tileIndex);
      continue;
    }
    if (operation === 'raise') byIndex.set(tileIndex, { ...current, elevationDelta: (current.elevationDelta ?? 0) + strength });
    else if (operation === 'lower') byIndex.set(tileIndex, { ...current, elevationDelta: (current.elevationDelta ?? 0) - strength });
    else if (operation === 'flatten') byIndex.set(tileIndex, { ...current, elevation: strength, elevationDelta: 0 });
    else if (operation === 'smooth') {
      const tile = session.world.tiles[tileIndex];
      if (tile === undefined) continue;
      const neighbors = [session.world.getTile(tile.x - 1, tile.y), session.world.getTile(tile.x + 1, tile.y), session.world.getTile(tile.x, tile.y - 1), session.world.getTile(tile.x, tile.y + 1)].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined);
      const average = neighbors.length === 0 ? tile.elevation : neighbors.reduce((sum, candidate) => sum + candidate.elevation, 0) / neighbors.length;
      const blend = Math.max(0.01, Math.min(1, strength));
      byIndex.set(tileIndex, { ...current, elevation: tile.elevation + (average - tile.elevation) * blend, elevationDelta: 0 });
    }
    else if (operation === 'river') byIndex.set(tileIndex, { ...current, river: true });
    else if (operation === 'erase-river') byIndex.set(tileIndex, { ...current, river: false });
    else {
      const terrain = authoringTerrainType.value as TerrainType;
      const water = terrain === TerrainType.DeepWater || terrain === TerrainType.ShallowWater ? WaterType.Ocean : terrain === TerrainType.Lake ? WaterType.Lake : WaterType.Land;
      byIndex.set(tileIndex, {
        ...current, terrain, water, river: terrain === TerrainType.RiverChannel ? true : current.river,
        forestDensity: terrain === TerrainType.Forest ? Math.max(current.forestDensity ?? 0, 0.85) : current.forestDensity,
        floodRisk: terrain === TerrainType.Floodplain ? Math.max(current.floodRisk ?? 0, 0.8) : current.floodRisk,
      });
    }
  }
  session.authoringLayer = { ...session.authoringLayer, terrainOverrides: [...byIndex.values()].sort((left, right) => left.tileIndex - right.tileIndex) };
  persistMapCustomization();
  if (regenerateFrom('terrain', `Applied ${operation.replace('-', ' ')} terrain authoring.`)) recordHistory(snapshot, `${operation} terrain`);
}

function resetAuthoringSelection(deleteSelection: boolean): void {
  if (session.activeAuthoringFeatureId !== null) {
    const feature = session.authoringLayer.features.find((item) => item.id === session.activeAuthoringFeatureId);
    if (feature === undefined) return;
    const snapshot = captureEditorSnapshot();
    const generatedSource = generatedSourceForFeature(feature);
    session.authoringLayer = { ...session.authoringLayer, features: session.authoringLayer.features.filter((item) => item.id !== feature.id) };
    if (!deleteSelection && generatedSource !== null) {
      session.authoringLayer = {
        ...session.authoringLayer,
        generatedFeatureOverrides: session.authoringLayer.generatedFeatureOverrides.filter((item) => !(item.entityType === generatedSource.entityType && item.entityId === generatedSource.entityId)),
      };
    }
    session.activeAuthoringFeatureId = null;
    persistMapCustomization();
    const stage = featureRegenerationStage(feature);
    if (stage !== null) regenerateFrom(stage, `${deleteSelection ? 'Deleted' : 'Reset'} ${feature.name}.`);
    else { renderAuthoringLists(); syncRendererCustomization(); }
    recordHistory(snapshot, `${deleteSelection ? 'delete' : 'reset'} feature`);
    authoringStartFeature.textContent = 'Draw with selected tool';
    return;
  }
  if (session.activeAuthoringSettlementKey === null) return;
  const settlement = session.world.settlements.find((item) => item.key === session.activeAuthoringSettlementKey);
  if (settlement === undefined) return;
  const snapshot = captureEditorSnapshot();
  if (settlement.source === 'authored') {
    session.authoringLayer = {
      ...session.authoringLayer,
      authoredSettlements: session.authoringLayer.authoredSettlements.filter((item) => item.key !== settlement.key),
      settlementOverrides: session.authoringLayer.settlementOverrides.filter((item) => item.key !== settlement.key),
    };
  } else if (deleteSelection) {
    const existing = session.authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
    upsertSettlementAuthoringOverride({ ...existing, key: settlement.key, suppressed: true });
  } else {
    removeSettlementAuthoringOverride(settlement.key);
    session.settlementPositionOverrides = session.settlementPositionOverrides.filter((item) => item.key !== settlement.key);
  }
  session.activeAuthoringSettlementKey = null;
  persistMapCustomization();
  if (regenerateFrom('settlements', `${deleteSelection ? 'Removed' : 'Reset'} ${settlement.name}.`)) recordHistory(snapshot, `${deleteSelection ? 'remove' : 'reset'} settlement`);
}

function handleAuthoringMapClick(x: number, y: number): boolean {
  if (session.authoringTool === 'anchor') { placePendingAnchor(x, y); return true; }
  if (session.authoringTool === 'point') {
    const snapshot = captureEditorSnapshot();
    const feature = authoredFeatureFromGeometry({ kind: 'point', point: { x, y } });
    commitAuthoredFeature(feature, `place ${feature.category}`, snapshot);
    setAuthoringTool('select');
    return true;
  }
  if (session.authoringTool === 'polyline' || session.authoringTool === 'polygon') {
    session.authoringDraftPoints = [...session.authoringDraftPoints, { x, y }];
    authoringFinishFeature.disabled = session.authoringDraftPoints.length < (session.authoringTool === 'polygon' ? 3 : 2);
    authoringCancelFeature.disabled = false;
    setAuthoringStatus(`${session.authoringDraftPoints.length} point${session.authoringDraftPoints.length === 1 ? '' : 's'} added. Continue or finish the shape.`);
    syncRendererCustomization();
    return true;
  }
  if (session.authoringTool === 'select') {
    const feature = hitAuthoredFeature(x, y);
    if (feature !== undefined) {
      if (isPointAnchorFeature(feature)) loadPointAnchorIntoForm(feature.id);
      else loadFeatureIntoForm(feature.id);
      return true;
    }
    const settlement = [...session.world.settlements].reverse().find((item) => Math.hypot(x - item.x, y - item.y) <= Math.max(1.4, 10 / Math.max(1, camera.zoom)));
    if (settlement !== undefined) { loadSettlementIntoForm(settlement.key); return true; }
  }
  return false;
}

function selectedTerrainSize(): TerrainSize {
  return terrainSizeSelect.value as TerrainSize;
}

function selectedTownScale(): TownScale {
  return townScaleSelect.value as TownScale;
}

function selectedTerrainShape(): TerrainShape { return terrainShapeSelect.value as TerrainShape; }
function selectedClimatePreset(): ClimatePreset { return climatePresetSelect.value as ClimatePreset; }
function selectedIslandCount(): number { return Math.max(2, Math.min(12, Math.round(Number(islandCountInput.value) || 5))); }
function selectedIslandSpacing(): number { return Math.max(0.5, Math.min(12, Number(islandSpacingInput.value) || 4)); }
function worldSignature(): string {
  return `${seedInput.value.trim()}|${selectedTerrainSize()}|${selectedTownScale()}|${selectedTerrainShape()}|${selectedClimatePreset()}|${selectedIslandCount()}|${selectedIslandSpacing().toFixed(2)}|${SATELLITE_SETTLEMENT_COUNT}`;
}

function generationOptions(
  candidateCustom: readonly CustomAnchorDefinition[] = session.customAnchors,
  candidateBuiltIns: readonly BuiltInAnchorOverride[] = session.builtInOverrides,
  candidateAnchorPositions: readonly AnchorPositionOverride[] = session.anchorPositionOverrides,
  candidateSettlementPositions: readonly SettlementPositionOverride[] = session.settlementPositionOverrides,
  candidateStoryPositions: readonly StoryPositionOverride[] = session.storyPositionOverrides,
): GenerationOptions {
  return {
    customAnchors: candidateCustom,
    builtInAnchorOverrides: candidateBuiltIns,
    terrainSize: selectedTerrainSize(),
    townScale: selectedTownScale(),
    terrainShape: selectedTerrainShape(),
    climatePreset: selectedClimatePreset(),
    islandCount: selectedIslandCount(),
    islandSpacingKilometers: selectedIslandSpacing(),
    satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT,
    roadNameOverrides: session.roadNameOverrides,
    blockNameOverrides: session.blockNameOverrides,
    anchorPositionOverrides: candidateAnchorPositions,
    settlementPositionOverrides: candidateSettlementPositions,
    authoredSettlements: session.authoringLayer.authoredSettlements,
    settlementAuthoringOverrides: session.authoringLayer.settlementOverrides,
    terrainOverrides: session.authoringLayer.terrainOverrides,
    generatedFeatureOverrides: session.authoringLayer.generatedFeatureOverrides,
    authoredFeatures: session.authoringLayer.features,
    storyPositionOverrides: candidateStoryPositions,
    storyRuleOverrides: session.storyRuleOverrides,
    zoneOverrides: session.zoneOverrides,
    customStoryPoints: session.customStoryDefinitions,
    islandOverrides: session.islandOverrides,
    bridgeOverrides: session.bridgeOverrides,
    customBridges: session.customBridges,
    portOverrides: session.portOverrides,
    customPorts: session.customPorts,
  };
}

function currentMapCustomization(): StoredMapCustomization {
  return session.currentMapCustomization();
}

function persistMapCustomization(): void {
  if (session.activeWorldSignature.length === 0) return;
  saveMapCustomization(session.activeWorldSignature, currentMapCustomization());
}


function captureEditorSnapshot(): EditorSnapshot {
  return historyController.capture();
}

function recordHistory(previous: EditorSnapshot, label: string): void {
  historyController.record(previous, label);
}

function persistAllEditorState(): void {
  saveAnchorState(session.customAnchors, session.builtInOverrides);
  saveCustomStoryDefinitions(session.customStoryDefinitions);
  saveLabelSettings(session.labelSettings);
  persistMapCustomization();
  persistNames();
}

function undo(): void {
  historyController.undo();
}

function redo(): void {
  historyController.redo();
}

function syncRendererCustomization(): void {
  renderer.setCustomization({
    ...EMPTY_RENDER_CUSTOMIZATION,
    imageAssets: session.runtimeImageAssets,
    placedImages: session.placedImages,
    editMode,
    dragPreview,
    labels: session.labelSettings,
    zoneDisplayMode: zoneDisplayMode.value as 'final' | 'generated' | 'overrides',
    zoneBrushPreview,
    travelPath: travelPlanner.renderedPath(),
    authoringLayer: session.authoringLayer,
    activeAuthoringFeatureId: session.activeAuthoringFeatureId,
    authoringDraftPoints: session.authoringDraftPoints,
  });
  requestRender();
}

function requestRender(): void {
  renderRequested = true;
}



async function exportVisibleMapImage(): Promise<void> {
  exportImageButton.disabled = true;
  setStatus('Rendering full-world PNG…', 'working');
  try {
    const blob = await renderer.exportPng(session.world, {
      pixelsPerTile: Number(imageExportScale.value),
      padding: Number(imageExportPadding.value),
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSeed = session.world.seed.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.download = `${safeSeed}-${session.world.metadata.terrainShape}-${session.world.metadata.climatePreset}.png`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${(blob.size / 1024 / 1024).toFixed(2)} MB PNG using the visible map layers.`, 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    exportImageButton.disabled = false;
  }
}

function showToast(message: string, state: 'success' | 'warning' | 'error'): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.state = state;
  toast.textContent = message;
  toastStack.append(toast);
  window.setTimeout(() => toast.remove(), state === 'error' ? 7000 : 4200);
  while (toastStack.childElementCount > 4) toastStack.firstElementChild?.remove();
}

function setStatus(message: string, state: 'success' | 'warning' | 'error' | 'working' | 'idle' = 'idle'): void {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
  if (state === 'success' || state === 'warning' || state === 'error') showToast(message, state);
}

function currentProjectSerializationState(): ProjectSerializationState {
  return {
    world: session.world,
    customization: currentMapCustomization(),
    customAnchors: session.customAnchors,
    builtInAnchorOverrides: session.builtInOverrides,
    roadNames: session.roadNameOverrides,
    blockNames: session.blockNameOverrides,
    labelDisplay: session.labelSettings,
    customStoryPoints: session.customStoryDefinitions,
    npcLocationAuthoring: session.npcLocationAuthoring,
    campaign: session.campaignState,
    playerView: session.playerViewState,
    simulation: session.simulation?.serialize(),
    imageAssets: session.importedAssets,
  };
}

function downloadWorld(): void {
  downloadProjectJson(currentProjectSerializationState());
}

function createHostedCampaignPayload(): Readonly<Record<string, unknown>> {
  return serializeHostedCampaign(currentProjectSerializationState());
}

function createAutosavePayload(): Record<string, unknown> {
  const profile: StoredProfile = {
    terrainSize: selectedTerrainSize(), townScale: selectedTownScale(), terrainShape: selectedTerrainShape(),
    climatePreset: selectedClimatePreset(), islandCount: selectedIslandCount(),
    islandSpacingKilometers: selectedIslandSpacing(), satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT,
  };
  return serializeAutosave(currentProjectSerializationState(), profile);
}

function currentBrowserMapView(): PersistedMapView {
  return {
    seed: session.world.seed,
    x: camera.x,
    y: camera.y,
    zoom: camera.zoom,
    visibleLayers: renderer.layers.visible(),
  };
}

function saveBrowserMapView(): void {
  if (session.world === undefined) return;
  updateBrowserSession({ mapView: currentBrowserMapView() });
}

function restoreBrowserMapView(view: PersistedMapView | undefined): void {
  if (view === undefined || view.seed !== session.world.seed) return;
  camera.x = view.x;
  camera.y = view.y;
  camera.zoom = view.zoom;
  const visibleLayers = new Set(view.visibleLayers);
  for (const layer of Object.values(RenderLayer)) setLayer(layer, visibleLayers.has(layer));
  viewPreset.value = 'custom';
  studioShell.syncLayerManager();
  requestRender();
}

function updateRecoveryUi(): void {
  const recovery = readAutosaveRecoveryInfo();
  if (recovery.state === 'none') {
    restoreSessionButton.disabled = true;
    sessionRecoveryCopy.textContent = 'No recoverable session yet.';
    return;
  }
  if (recovery.state === 'invalid') {
    restoreSessionButton.disabled = true;
    sessionRecoveryCopy.textContent = 'The recovery snapshot is invalid.';
    return;
  }
  const date = recovery.savedAt === null ? 'at an unknown time' : new Date(recovery.savedAt).toLocaleString();
  restoreSessionButton.disabled = false;
  sessionRecoveryCopy.textContent = `${recovery.seed} was saved ${date} and will reopen automatically in this browser.`;
}

function scheduleAutosave(): void {
  if (session.world === undefined) return;
  document.dispatchEvent(new CustomEvent('payaw:project-state-changed'));
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
  autosaveIndicator.dataset.state = 'saving';
  autosaveIndicator.textContent = 'Saving…';
  autosaveTimer = window.setTimeout(() => {
    try {
      writeAutosavedProject(createAutosavePayload());
      saveBrowserMapView();
      markSessionResumeAvailable();
      autosaveIndicator.dataset.state = 'saved';
      autosaveIndicator.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      updateRecoveryUi();
    } catch (error) {
      autosaveIndicator.dataset.state = 'error';
      autosaveIndicator.textContent = 'Autosave failed';
      console.warn('PAYAW autosave failed', error);
    }
    autosaveTimer = null;
  }, 900);
}

async function restoreAutosave(announce = true): Promise<void> {
  const raw = readAutosavedProject();
  if (raw === null) return;
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  const savedMapView = readBrowserSession()?.mapView;
  const file = new File([raw], 'payaw-autosave.json', { type: 'application/json' });
  await importPayawJsonFile(file);
  restoreBrowserMapView(savedMapView);
  showToast(announce ? 'Restored the last autosaved PAYAW session.' : 'Continued your previous PAYAW session.', 'success');
}

function renderRecentProjects(): void {
  renderRecentProjectsView(recentProjectList, loadRecentProjects(), (entry) => {
    seedInput.value = entry.seed;
    terrainSizeSelect.value = entry.terrainSize;
    townScaleSelect.value = entry.townScale;
    terrainShapeSelect.value = entry.terrainShape;
    climatePresetSelect.value = entry.climatePreset;
    islandCountInput.value = String(entry.islandCount);
    islandSpacingInput.value = String(entry.islandSpacingKilometers);
    updateProfileHint();
    void generateResponsive(session.customAnchors, session.builtInOverrides, true, true);
  });
}

function recordRecentProject(): void {
  if (session.world === undefined) return;
  const entry: RecentProjectEntry = {
    seed: session.world.seed,
    terrainSize: selectedTerrainSize(), townScale: selectedTownScale(), terrainShape: selectedTerrainShape(),
    climatePreset: selectedClimatePreset(), islandCount: selectedIslandCount(), islandSpacingKilometers: selectedIslandSpacing(),
    satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT, updatedAt: new Date().toISOString(),
  };
  saveRecentProject(entry);
  renderRecentProjects();
}

function commandDefinitions(): CommandDefinition[] {
  return [
    { id: 'generate', label: 'Generate world', description: 'Regenerate using the current profile', shortcut: 'G', run: () => { void generateResponsive(session.customAnchors, session.builtInOverrides, true, true, true); } },
    { id: 'random-seed', label: 'Generate random world', description: 'Create a new random seed and keep active authoring', run: () => { seedInput.value = createCryptoSeed(); void generateResponsive(session.customAnchors, session.builtInOverrides, true, true, true); } },
    { id: 'save-json', label: 'Save compact World JSON', description: 'Export the reproducible world recipe and NPC edits without generated caches', shortcut: 'Ctrl+S', run: downloadWorld },
    { id: 'open-json', label: 'Open project JSON', description: 'Import a PAYAW project or override file', shortcut: 'Ctrl+O', run: () => projectImportFile.click() },
    { id: 'export-png', label: 'Export map PNG', description: 'Render the visible layer configuration', run: () => { void exportVisibleMapImage(); } },
    { id: 'fit', label: 'Fit entire world', description: 'Fit the regional map into the viewport', shortcut: 'F', run: fitCamera },
    { id: 'focus', label: 'Focus selection', description: 'Center the selected map object', run: () => mapInspector.focusSelection() },
    { id: 'editor', label: 'Switch to World Editor', description: 'Open authoring controls', run: () => setWorkspace('editor') },
    { id: 'dm', label: 'Switch to DM Mode', description: 'Open the session workspace', run: () => setWorkspace('dm') },
    { id: 'inspector', label: 'Open Inspector', description: 'Inspect the selected tile or object', run: () => studioShell.setTab('inspector') },
    { id: 'layers', label: 'Open Layer Manager', description: 'Toggle map visibility layers', run: () => studioShell.setTab('layers') },
    { id: 'project', label: 'Open Project panel', description: 'Autosave, recent worlds, and theme', run: () => studioShell.setTab('project') },
    { id: 'toggle-left', label: 'Toggle authoring panel', description: 'Show or hide the left workspace', shortcut: 'Ctrl+[', run: () => studioShell.toggleLeftPanel() },
    { id: 'toggle-right', label: 'Toggle Studio Dock', description: 'Show or hide inspector, layers, and project', shortcut: 'Ctrl+]', run: () => studioShell.toggleStudioDock() },
    { id: 'dark', label: 'Use dark appearance', description: 'Switch the interface theme', run: () => studioShell.setTheme('dark') },
    { id: 'light', label: 'Use light appearance', description: 'Switch the interface theme', run: () => studioShell.setTheme('light') },
    { id: 'contrast', label: 'Use high-contrast appearance', description: 'Switch the interface theme', run: () => studioShell.setTheme('contrast') },
  ];
}

const commandPalette = new CommandPalette({
  trigger: commandPaletteButton,
  backdrop: commandPaletteBackdrop,
  input: commandPaletteInput,
  results: commandPaletteResults,
}, commandDefinitions);

const GENERATION_STAGE_LABELS: Readonly<Record<string, string>> = {
  terrain: 'Elevation',
  'mountain-structure': 'Mountain structure',
  'thermal-erosion': 'Thermal erosion',
  coastline: 'Coastline',
  slope: 'Terrain slopes',
  climate: 'Climate',
  'hydraulic-erosion': 'Hydraulic erosion',
  'eroded-coastline': 'Eroded coastline',
  'eroded-slope': 'Eroded slopes',
  'terrain-hydrology': 'Hydrology',
  'final-coastline': 'Final coastline',
  'delta-drainage-repair': 'Drainage repair',
  'final-slope': 'Final slopes',
  'terrain-classification': 'Terrain classification',
  landmasses: 'Landmass detection',
  islands: 'Island planning',
  settlements: 'Settlements',
  'anchor-placement': 'Anchors',
  'road-network': 'Road network',
  bridges: 'Bridges',
  ports: 'Ports',
  accessibility: 'Accessibility',
  blocks: 'Blocks',
  'land-value': 'Land value',
  zoning: 'Zoning',
  'zone-overrides': 'Zone overrides',
  'place-naming': 'Place names',
  buildings: 'Buildings',
  vegetation: 'Vegetation',
  'story-layer': 'Story layer',
};

function setGenerationRunning(running: boolean): void {
  generateButton.disabled = running;
  randomSeedButton.disabled = running;
  cancelGenerationButton.hidden = !running;
  generationProgress.hidden = !running;
  if (!running) {
    generationProgressFill.style.width = '0%';
    generationProgressPercent.textContent = '0%';
  }
}

function updateGenerationProgress(progress: GenerationProgress): void {
  const completedStages = progress.stageIndex + 1;
  const percent = Math.round(completedStages / Math.max(1, progress.stageCount) * 100);
  generationProgressFill.style.width = `${percent}%`;
  generationProgressPercent.textContent = `${percent}%`;
  generationProgressStage.textContent = `${GENERATION_STAGE_LABELS[progress.stageId] ?? progress.stageId} · ${progress.stageDurationMs.toFixed(0)} ms`;
}

function updatePerformancePanel(): void {
  if (session.world === undefined) return;
  const stageEntries = Object.entries(session.world.diagnostics.stageTimingsMs);
  const total = stageEntries.reduce((sum, [, duration]) => sum + duration, 0);
  const slowest = [...stageEntries].sort((left, right) => right[1] - left[1])[0];
  const rendererDiagnostics = renderer.getDiagnostics();
  perfGenerationTotal.textContent = `${total.toFixed(0)} ms`;
  perfSlowestStage.textContent = slowest === undefined
    ? '—'
    : `${GENERATION_STAGE_LABELS[slowest[0]] ?? slowest[0]} · ${slowest[1].toFixed(0)} ms`;
  perfCacheTime.textContent = `${rendererDiagnostics.cacheBuildMs.toFixed(1)} ms`;
  perfRenderTime.textContent = `${rendererDiagnostics.lastRenderMs.toFixed(1)} ms`;
  perfVisibleBuildings.textContent = rendererDiagnostics.visibleBuildings.toLocaleString();
  perfVisibleVegetation.textContent = rendererDiagnostics.visibleVegetation.toLocaleString();
}

function fitCamera(): void {
  camera.fit(session.world.width, session.world.height, canvas.clientWidth, canvas.clientHeight);
  requestRender();
}

function updateProfileHint(): void {
  const terrain = selectedTerrainSize();
  const town = selectedTownScale();
  const shape = selectedTerrainShape();
  const terrainText = terrain === TerrainSize.Small ? 'compact 256×192 terrain' : terrain === TerrainSize.Medium ? 'expanded 320×240 terrain' : 'regional 384×288 terrain';
  const townText = town === TownScale.Rural ? 'sparse roads and low building occupancy' : town === TownScale.SemiUrban ? 'balanced roads, blocks, and buildings' : 'dense roads, tighter blocks, and high occupancy';
  const shapeText = terrainShapeSelect.selectedOptions[0]?.textContent ?? shape;
  const climateText = climatePresetSelect.selectedOptions[0]?.textContent ?? selectedClimatePreset();
  const dimensions: readonly [number, number] = terrain === TerrainSize.Small ? [256, 192] : terrain === TerrainSize.Medium ? [320, 240] : [384, 288];
  const widthKilometers = (dimensions[0] * 0.125).toFixed(0);
  const heightKilometers = (dimensions[1] * 0.125).toFixed(0);
  const archipelago = shape === TerrainShape.Archipelago;
  const twin = shape === TerrainShape.TwinIslands;
  islandCountInput.disabled = !archipelago;
  islandSpacingInput.disabled = !(archipelago || twin);
  if (twin) islandCountInput.value = '2';
  const islandText = archipelago
    ? ` ${selectedIslandCount()} major islands with approximately ${selectedIslandSpacing().toFixed(1)} km minimum gaps.`
    : twin ? ` Two major islands with approximately ${selectedIslandSpacing().toFixed(1)} km minimum separation.` : '';
  profileHint.textContent = `${shapeText}, ${climateText.toLowerCase()}, ${terrainText}, with ${townText}.${islandText} Communities are placed later as movable anchor points.`;
  regionalScaleReadout.textContent = `Metro-scale region: ${widthKilometers} × ${heightKilometers} km · 125 m per tile`;
}

function updateMapHeader(): void {
  mapTitle.textContent = session.world.seed;
  mapSubtitle.textContent = `${session.world.metadata.terrainShape} · ${session.world.metadata.climatePreset} · ${session.world.metadata.terrainSize} terrain · ${session.world.metadata.townScale} town · ${session.world.islands.length} islands · ${session.world.bridges.length} bridges · ${session.world.ports.length} ports · ${session.world.storyObjects.length} story sites`;
}

function mergedBuiltInDefinition(type: BuiltInAnchorType): BuiltInAnchorOverride {
  const override = session.builtInOverrides.find((definition) => definition.type === type);
  const fallback = defaultBuiltIns.find((definition) => definition.type === type);
  if (override !== undefined) return override;
  if (fallback === undefined) throw new Error(`Missing built-in definition for ${type}.`);
  return fallback;
}

function ruleSummary(settings: AnchorRuleSettings): string {
  const parts = [TERRAIN_LABELS[settings.terrain], REGION_LABELS[settings.region]];
  if (settings.zoneType !== null) parts.push(`${settings.zoneType} zone`);
  if (settings.targetAnchor !== null && settings.proximity !== AnchorProximityBand.None) {
    parts.push(`${settings.proximity} ${ANCHOR_LABELS[settings.targetAnchor]}`);
  }
  return parts.join(' · ');
}

function focusMapPoint(x: number, y: number): void {
  camera.focus(x, y, canvas.clientWidth, canvas.clientHeight, 9);
  requestRender();
}

function focusAnchor(key: string): void {
  const anchor = session.world.anchors.find((candidate) => candidate.key === key);
  if (anchor !== undefined) focusMapPoint(anchor.x, anchor.y);
}

function resetAnchorForm(): void {
  anchorForm.reset();
  anchorEditKey.value = '';
  anchorFormTitle.textContent = 'Add procedural point rule';
  anchorSubmitButton.textContent = 'Add rule and regenerate';
  anchorCancelButton.hidden = true;
  anchorRadius.value = '5';
  anchorSpacing.value = '12';
  anchorZone.value = ZoneType.Residential;
  anchorTarget.value = '';
  anchorProximity.value = AnchorProximityBand.None;
  anchorProximity.disabled = true;
}

function populateAnchorForm(key: string, settings: AnchorRuleSettings): void {
  anchorEditKey.value = key;
  anchorFormTitle.textContent = key.startsWith('builtin:') ? `Edit ${settings.name}` : 'Edit procedural point rule';
  anchorSubmitButton.textContent = 'Save rules and regenerate';
  anchorCancelButton.hidden = false;
  anchorName.value = settings.name;
  anchorRegion.value = settings.region;
  anchorTerrain.value = settings.terrain;
  anchorTarget.value = settings.targetAnchor ?? '';
  anchorProximity.disabled = settings.targetAnchor === null;
  anchorProximity.value = settings.targetAnchor === null ? AnchorProximityBand.None : settings.proximity;
  anchorZone.value = settings.zoneType ?? '';
  anchorRadius.value = String(settings.radius);
  anchorSpacing.value = String(settings.minimumDistance);
  anchorName.focus();
}

function editAnchor(key: string): void {
  if (key.startsWith('builtin:')) {
    const type = key.slice('builtin:'.length) as BuiltInAnchorType;
    populateAnchorForm(key, mergedBuiltInDefinition(type));
    return;
  }
  const id = key.slice('custom:'.length);
  const definition = session.customAnchors.find((candidate) => candidate.id === id);
  if (definition !== undefined) populateAnchorForm(key, definition);
}

function renderAnchorList(): void {
  anchorCount.textContent = String(BUILT_IN_ANCHOR_TYPES.length + session.customAnchors.length);
  anchorList.replaceChildren();
  for (const type of BUILT_IN_ANCHOR_TYPES) {
    const definition = mergedBuiltInDefinition(type);
    const edited = session.builtInOverrides.some((candidate) => candidate.type === type);
    anchorList.append(createAnchorListItem(`builtin:${type}`, definition, 'Built-in', edited));
  }
  for (const definition of session.customAnchors) {
    anchorList.append(createAnchorListItem(`custom:${definition.id}`, definition, 'Custom', true));
  }
}

function createAnchorListItem(key: string, settings: AnchorRuleSettings, sourceLabel: string, changed: boolean): HTMLElement {
  const item = document.createElement('article');
  item.className = 'anchor-item';
  const description = document.createElement('div');
  const titleRow = document.createElement('div');
  titleRow.className = 'anchor-title-row';
  const title = document.createElement('strong');
  title.textContent = settings.name;
  const moved = session.anchorPositionOverrides.some((position) => position.key === key.replace('builtin:', ''));
  const badge = document.createElement('span');
  badge.className = moved ? 'mini-badge object-moved-badge' : 'mini-badge';
  badge.textContent = [sourceLabel, changed ? 'edited' : '', moved ? 'moved' : ''].filter((value) => value.length > 0).join(' · ');
  titleRow.append(title, badge);
  const summary = document.createElement('p');
  summary.textContent = ruleSummary(settings);
  description.append(titleRow, summary);
  const actions = document.createElement('div');
  actions.className = 'anchor-actions';
  const focus = document.createElement('button');
  focus.type = 'button';
  focus.textContent = 'Focus';
  focus.addEventListener('click', () => focusAnchor(key.replace('builtin:', '')));
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => editAnchor(key));
  actions.append(focus, edit);
  if (moved) {
    const resetPosition = document.createElement('button');
    resetPosition.type = 'button';
    resetPosition.textContent = 'Reset pos.';
    resetPosition.addEventListener('click', () => resetAnchorPosition(key.replace('builtin:', '')));
    actions.append(resetPosition);
  }
  if (key.startsWith('builtin:') && changed) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => resetBuiltInAnchor(key.slice('builtin:'.length) as BuiltInAnchorType));
    actions.append(reset);
  }
  if (key.startsWith('custom:')) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeCustomAnchor(key.slice('custom:'.length)));
    actions.append(remove);
  }
  item.append(description, actions);
  return item;
}

function randomUnit(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 0) / 4_294_967_296;
}


function setWorkspace(mode: WorkspaceMode, applyDefaultView = true): void {
  session.activeWorkspace = mode;
  const editorActive = mode === 'editor';
  editorWorkspace.hidden = !editorActive;
  dmWorkspace.hidden = editorActive;
  workspaceEditorButton.setAttribute('aria-selected', String(editorActive));
  workspaceDmButton.setAttribute('aria-selected', String(!editorActive));
  workspaceKicker.textContent = editorActive ? 'WORLD' : 'CAMPAIGN';
  workspaceTitle.textContent = editorActive ? 'Build and inspect the world' : 'Prepare and run the campaign';
  workspaceDescription.textContent = editorActive
    ? 'Generation, layers, anchors, labels, story points, NPCs, and regional transport.'
    : 'Dashboard, Scene Director, timeline, reveals, messages, assets, notes, and session tools.';
  mapWorkspaceBadge.textContent = editorActive ? 'WORLD' : 'CAMPAIGN';
  viewportShell.dataset.workspace = mode;
  for (const button of document.querySelectorAll<HTMLElement>('[data-open-authoring]')) button.hidden = !editorActive;
  localStorage.setItem(WORKSPACE_STORAGE_KEY, mode);
  if (!editorActive) {
    setEditMode(false);
    setZoneEditMode(false);
    if (applyDefaultView) {
      dmViewPreset.value = 'story';
      applyViewPreset('story');
    }
  }
}

function updateDmStoryCounts(): void {
  dmStoryTotal.textContent = String(session.world.storyObjects.length);
  dmCustomTotal.textContent = String(session.world.storyObjects.filter((item) => item.source === StoryObjectSource.Custom).length);
  const removed = session.storyRuleOverrides.filter((rule) => rule.suppressed === true).length;
  removedStoryCount.textContent = String(removed);
  restoreRemovedStoryPoints.disabled = removed === 0;
}

function suppressStoryPoint(item: World['storyObjects'][number]): void {
  const snapshot = captureEditorSnapshot();
  const existing = storyRuleFor(item.id, item.key);
  const next: StoryRuleOverride = {
    id: item.id,
    key: item.key,
    ...(existing?.name !== undefined ? { name: existing.name } : { name: item.name }),
    preferredZone: existing?.preferredZone ?? item.preferredZone,
    allowedZones: existing?.allowedZones ?? item.allowedZones,
    disallowedZones: existing?.disallowedZones ?? item.disallowedZones,
    influenceRadius: existing?.influenceRadius ?? item.influenceRadius,
    ...(existing?.wish !== undefined ? { wish: existing.wish } : {}),
    ...(existing?.manifestation !== undefined ? { manifestation: existing.manifestation } : {}),
    ...(existing?.encounters !== undefined ? { encounters: existing.encounters } : {}),
    suppressed: true,
  };
  const previous = session.storyRuleOverrides;
  session.storyRuleOverrides = [
    ...session.storyRuleOverrides.filter((candidate) => candidate.key !== item.key && !(candidate.key === undefined && candidate.id === item.id)),
    next,
  ].sort((left, right) => left.id - right.id || (left.key ?? '').localeCompare(right.key ?? ''));
  persistMapCustomization();
  if (regenerateFrom('story-layer', `Removed ${item.name} from the campaign map.`)) {
    recordHistory(snapshot, `remove story point ${item.name}`);
    return;
  }
  session.storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', `Could not remove ${item.name}; restored the previous story map.`);
}

function restoreAllSuppressedStoryPoints(): void {
  const suppressed = session.storyRuleOverrides.filter((rule) => rule.suppressed === true);
  if (suppressed.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previous = session.storyRuleOverrides;
  session.storyRuleOverrides = session.storyRuleOverrides.filter((rule) => rule.suppressed !== true);
  persistMapCustomization();
  if (regenerateFrom('story-layer', `Restored ${suppressed.length} removed story point${suppressed.length === 1 ? '' : 's'}.`)) {
    recordHistory(snapshot, 'restore removed story points');
    return;
  }
  session.storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Could not restore removed story points; restored the previous story map.');
}

function filterDmStoryCards(): void {
  const query = dmStorySearch.value.trim().toLocaleLowerCase();
  for (const card of Array.from(storyList.querySelectorAll<HTMLElement>('.story-item'))) {
    const searchText = card.dataset.storySearch ?? '';
    card.dataset.filtered = String(query.length > 0 && !searchText.includes(query));
  }
}

function renderDmSessionLog(): void {
  dmSessionLog.replaceChildren();
  if (session.dmSessionEntries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'Encounter rolls will appear here.';
    dmSessionLog.append(empty);
    return;
  }
  for (const entry of session.dmSessionEntries) {
    const row = document.createElement('article');
    row.className = 'dm-log-entry';
    const time = document.createElement('time');
    time.textContent = entry.time;
    const copy = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${entry.site} — ${entry.title}`;
    const detail = document.createElement('div');
    detail.textContent = entry.danger;
    copy.append(strong, detail);
    row.append(time, copy);
    dmSessionLog.append(row);
  }
}

function showDmEncounter(
  story: World['storyObjects'][number],
  encounter: StoryEncounterDefinition | undefined,
  target: HTMLElement = dmRandomEncounterResult,
): void {
  target.replaceChildren();
  if (encounter === undefined) {
    const empty = document.createElement('span');
    empty.textContent = `${story.name} has no encounter entries.`;
    target.append(empty);
    return;
  }
  const source = document.createElement('span');
  source.className = 'story-source';
  source.textContent = story.name;
  const title = document.createElement('strong');
  title.textContent = encounter.title;
  const danger = document.createElement('span');
  danger.className = 'danger-badge';
  danger.textContent = encounter.danger;
  const description = document.createElement('p');
  description.textContent = encounter.description;
  target.append(source, title, danger, description);
  session.dmSessionEntries = [{
    time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    site: story.name,
    title: encounter.title,
    danger: encounter.danger,
  }, ...session.dmSessionEntries].slice(0, 12);
  renderDmSessionLog();
}

function rollDmEncounter(story?: World['storyObjects'][number], target?: HTMLElement): void {
  const candidates = story === undefined
    ? session.world.storyObjects.filter((item) => item.encounters.length > 0)
    : [story];
  if (candidates.length === 0) {
    dmRandomEncounterResult.innerHTML = '<span>No story encounters are available.</span>';
    return;
  }
  const selected = candidates[Math.min(candidates.length - 1, Math.floor(randomUnit() * candidates.length))];
  if (selected === undefined) return;
  const encounter = pickWeightedEncounter(selected.encounters, randomUnit());
  showDmEncounter(selected, encounter, target);
}

function createStoryListCard(item: World['storyObjects'][number]): HTMLElement {
    const card = document.createElement('article');
    card.className = 'story-item';
    const heading = document.createElement('div');
    heading.className = 'story-heading';
    const title = document.createElement('strong');
    title.textContent = item.name;
    const source = document.createElement('span');
    source.className = 'count-badge';
    source.textContent = item.source === StoryObjectSource.Custom ? 'custom' : 'generated';
    card.dataset.storySearch = [item.name, item.wish, item.manifestation, item.zoneType ?? '', item.preferredZone ?? '', item.type]
      .join(' ')
      .toLocaleLowerCase();
    const actions = document.createElement('div');
    actions.className = 'anchor-actions';
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => focusMapPoint(item.x, item.y));
    const roll = document.createElement('button');
    roll.type = 'button';
    roll.textContent = 'Roll';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ms21-story-remove-button';
    remove.textContent = 'Remove';
    remove.title = 'Remove this story point non-destructively. Undo or Restore removed can bring it back.';
    remove.addEventListener('click', () => suppressStoryPoint(item));
    actions.append(focus, roll, remove);
    heading.append(title, source, actions);
    const wish = document.createElement('p');
    const wishLabel = document.createElement('span');
    wishLabel.textContent = 'Wish';
    wish.append(wishLabel, ` ${item.wish}`);
    const manifestation = document.createElement('p');
    const manifestationLabel = document.createElement('span');
    manifestationLabel.textContent = 'Manifestation';
    manifestation.append(manifestationLabel, ` ${item.manifestation}`);
    const zoning = document.createElement('p');
    const preferred = item.preferredZone === null ? 'none' : item.preferredZone;
    const zoningLabel = document.createElement('span');
    zoningLabel.textContent = 'Zone';
    zoning.append(zoningLabel, ` ${item.zoneType ?? 'none'} · preferred ${preferred}`);
    const encounterResult = document.createElement('div');
    encounterResult.className = 'encounter-result';
    encounterResult.hidden = true;
    roll.addEventListener('click', () => {
      rollDmEncounter(item, encounterResult);
      encounterResult.hidden = false;
    });
    card.append(heading, wish, manifestation, zoning, encounterResult);
    return card;
}

function renderStoryList(): void {
  storyList.replaceChildren();
  worldStoryList.replaceChildren();
  for (const item of session.world.storyObjects) {
    storyList.append(createStoryListCard(item));
    worldStoryList.append(createStoryListCard(item));
  }
  updateDmStoryCounts();
  filterDmStoryCards();
}

function selectedZoneValues(select: HTMLSelectElement): ZoneType[] {
  return Array.from(select.selectedOptions).map((option) => option.value as ZoneType);
}

function setSelectedZoneValues(select: HTMLSelectElement, values: readonly ZoneType[]): void {
  const selected = new Set(values);
  for (const option of Array.from(select.options)) option.selected = selected.has(option.value as ZoneType);
}

function storyRuleFor(id: number, key: string): StoryRuleOverride | undefined {
  return session.storyRuleOverrides.find((rule) => rule.key === key) ?? session.storyRuleOverrides.find((rule) => rule.key === undefined && rule.id === id);
}

function storyFromEditorSelection(): World['storyObjects'][number] | undefined {
  const key = storyRuleTarget.value;
  return session.world.storyObjects.find((item) => item.key === key) ?? session.world.storyObjects[Number(key)];
}

function renderStoryRuleEditor(): void {
  const previousKey = storyRuleTarget.value;
  storyRuleTarget.replaceChildren();
  for (const item of session.world.storyObjects) {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = `${item.name} · ${item.zoneType ?? 'no zone'}`;
    storyRuleTarget.append(option);
  }
  storyRuleTarget.value = session.world.storyObjects.some((item) => item.key === previousKey)
    ? previousKey
    : session.world.storyObjects[0]?.key ?? '';
  syncStoryRuleEditor();
}

function syncStoryRuleEditor(): void {
  const item = storyFromEditorSelection();
  if (item === undefined) return;
  const rule = storyRuleFor(item.id, item.key);
  storyRuleName.value = rule?.name ?? item.name;
  storyPreferredZone.value = rule?.preferredZone ?? '';
  storyInfluenceRadius.value = String(rule?.influenceRadius ?? item.influenceRadius);
  setSelectedZoneValues(storyAllowedZones, rule?.allowedZones ?? item.allowedZones);
  setSelectedZoneValues(storyDisallowedZones, rule?.disallowedZones ?? item.disallowedZones);
  storyRuleWish.value = rule?.wish ?? item.wish;
  storyRuleManifestation.value = rule?.manifestation ?? item.manifestation;
  storyRuleEncounters.value = formatEncounterLines(rule?.encounters ?? item.encounters);
}

function resetCustomStoryForm(): void {
  customStoryForm.reset();
  customStoryEditId.value = '';
  customStoryFormTitle.textContent = 'Add story point';
  customStoryCancel.hidden = true;
  customStoryType.value = StoryObjectType.HauntedHouse;
  customStoryRegion.value = AnchorRegionPreference.Anywhere;
  customStoryTerrain.value = AnchorTerrainPreference.SafeLand;
  setSelectedZoneValues(customStoryAllowedZones, []);
  setSelectedZoneValues(customStoryDisallowedZones, []);
  customStoryRadius.value = '10';
  customStorySpacing.value = '12';
}

function populateCustomStoryForm(definition: CustomStoryPointDefinition): void {
  customStoryEditId.value = definition.id;
  customStoryFormTitle.textContent = `Edit ${definition.name}`;
  customStoryCancel.hidden = false;
  customStoryName.value = definition.name;
  customStoryType.value = definition.type;
  customStoryRegion.value = definition.region;
  customStoryTerrain.value = definition.terrain;
  customStoryZone.value = definition.preferredZone ?? '';
  setSelectedZoneValues(customStoryAllowedZones, definition.allowedZones);
  setSelectedZoneValues(customStoryDisallowedZones, definition.disallowedZones);
  customStoryRadius.value = String(definition.influenceRadius);
  customStorySpacing.value = String(definition.minimumDistance);
  customStoryWish.value = definition.wish ?? '';
  customStoryManifestation.value = definition.manifestation ?? '';
  customStoryEncounters.value = formatEncounterLines(definition.encounters);
}

function readCustomStoryDefinition(existingId?: string): CustomStoryPointDefinition {
  return {
    id: existingId ?? createRuleId(),
    name: customStoryName.value.trim(),
    type: customStoryType.value as StoryObjectType,
    region: customStoryRegion.value as AnchorRegionPreference,
    terrain: customStoryTerrain.value as AnchorTerrainPreference,
    preferredZone: customStoryZone.value.length === 0 ? null : customStoryZone.value as ZoneType,
    allowedZones: selectedZoneValues(customStoryAllowedZones),
    disallowedZones: selectedZoneValues(customStoryDisallowedZones).filter((zone) => !selectedZoneValues(customStoryAllowedZones).includes(zone)),
    influenceRadius: Math.max(2, Math.min(40, Number(customStoryRadius.value) || 10)),
    minimumDistance: Math.max(4, Math.min(80, Number(customStorySpacing.value) || 12)),
    ...(customStoryWish.value.trim().length > 0 ? { wish: customStoryWish.value.trim() } : {}),
    ...(customStoryManifestation.value.trim().length > 0 ? { manifestation: customStoryManifestation.value.trim() } : {}),
    encounters: parseEncounterLines(customStoryEncounters.value),
  };
}

function renderCustomStoryList(): void {
  customStoryCount.textContent = String(session.customStoryDefinitions.length);
  customStoryList.replaceChildren();
  if (session.customStoryDefinitions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'No custom story points yet.';
    customStoryList.append(empty);
    return;
  }
  for (const definition of session.customStoryDefinitions) {
    const card = document.createElement('article');
    card.className = 'story-item';
    const heading = document.createElement('div');
    heading.className = 'story-heading';
    const title = document.createElement('strong');
    title.textContent = definition.name;
    const actions = document.createElement('div');
    actions.className = 'anchor-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => populateCustomStoryForm(definition));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      const previous = captureEditorSnapshot();
      session.customStoryDefinitions = session.customStoryDefinitions.filter((item) => item.id !== definition.id);
      session.storyPositionOverrides = session.storyPositionOverrides.filter((item) => item.key !== `custom-story:${definition.id}`);
      session.storyRuleOverrides = session.storyRuleOverrides.filter((item) => item.key !== `custom-story:${definition.id}`);
      saveCustomStoryDefinitions(session.customStoryDefinitions);
      persistMapCustomization();
      if (regenerateFrom('story-layer', `Removed ${definition.name}.`)) {
        recordHistory(previous, `remove story point ${definition.name}`);
        resetCustomStoryForm();
      }
    });
    actions.append(edit, remove);
    heading.append(title, actions);
    const details = document.createElement('p');
    const type = document.createElement('span');
    type.textContent = definition.type;
    details.append(
      type,
      ` ${REGION_LABELS[definition.region]} · ${TERRAIN_LABELS[definition.terrain]} · ${definition.encounters.length || 'generated'} encounters`,
    );
    card.append(heading, details);
    customStoryList.append(card);
  }
}


function updateZoneEditorUi(): void {
  zoneOverrideCount.textContent = String(session.zoneOverrides.length);
  zoneBrushOutput.value = `${zoneBrushSize.value} tile${zoneBrushSize.value === '1' ? '' : 's'}`;
  zoneEditModeButton.textContent = zoneEditMode ? 'On' : 'Off';
  zoneEditModeButton.dataset.active = String(zoneEditMode);
  canvas.classList.toggle('zone-edit-mode', zoneEditMode);
  zoneEditorStatus.textContent = zoneEditMode
    ? `${zoneToolSelect.selectedOptions[0]?.textContent ?? 'Zone'} tool active · ${session.zoneOverrides.length} override tiles.`
    : `${session.zoneOverrides.length} override tiles · turn on Zone editing to paint.`;
}

function setZoneEditMode(enabled: boolean): void {
  if (enabled && session.authoringTool !== 'select') setAuthoringTool('select');
  zoneEditMode = enabled;
  if (enabled) setEditMode(false);
  zoneStrokeActive = false;
  zoneStrokeStart = null;
  zoneStrokeIndices.clear();
  zoneBrushPreview = [];
  updateZoneEditorUi();
  syncRendererCustomization();
}

function zoneTypeFromControl(): ZoneType | null {
  return zonePaintType.value.length === 0 ? null : zonePaintType.value as ZoneType;
}

function persistAndRegenerateZoneOverrides(
  previous: readonly ZoneOverride[],
  snapshot: EditorSnapshot,
  message: string,
): void {
  persistMapCustomization();
  if (!regenerateFrom('zone-overrides', message)) {
    session.zoneOverrides = [...previous];
    persistMapCustomization();
    regenerateFrom('zone-overrides', 'Restored previous zoning.');
    return;
  }
  recordHistory(snapshot, 'edit zoning');
  updateZoneEditorUi();
}

function commitZoneIndices(indices: readonly number[], tool: ZoneTool): void {
  if (indices.length === 0) return;
  if (tool === 'eyedropper') {
    const tile = session.world.tiles[indices[0] ?? -1];
    zonePaintType.value = tile?.zoneType ?? '';
    setStatus(`Picked ${tile?.zoneType ?? 'no zone'}.`, 'success');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = [...session.zoneOverrides];
  if (tool === 'smooth') {
    session.zoneOverrides = smoothZoneOverrides(session.world, session.zoneOverrides, indices);
  } else {
    const mode = tool === 'erase' ? 'erase' : tool === 'lock' ? 'lock' : tool === 'unlock' ? 'unlock' : 'paint';
    session.zoneOverrides = setZoneOverrides(session.zoneOverrides, indices, zoneTypeFromControl(), zoneLockNew.checked, mode);
  }
  persistAndRegenerateZoneOverrides(previous, snapshot, `Applied ${tool} to ${indices.length} zone tile${indices.length === 1 ? '' : 's'}.`);
}

function exportCustomization(): void {
  const payload = {
    format: 'payaw-world-overrides',
    version: 1,
    worldSignature: session.activeWorldSignature,
    customization: serializeWorldCustomization(currentMapCustomization()),
    roadNames: session.roadNameOverrides,
    blockNames: session.blockNameOverrides,
    labelDisplay: session.labelSettings,
    customStoryPoints: session.customStoryDefinitions,
    islandOverrides: session.islandOverrides,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${session.world.seed.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.payaw-overrides.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importCustomizationFile(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text()) as {
    customization?: StoredMapCustomization;
    roadNames?: EntityNameOverride[];
    blockNames?: EntityNameOverride[];
    labelDisplay?: LabelDisplaySettings;
    customStoryPoints?: CustomStoryPointDefinition[];
  };
  if (parsed.customization === undefined) throw new Error('The file does not contain PAYAW customization data.');
  const snapshot = captureEditorSnapshot();
  const normalized = normalizeMapCustomization(parsed.customization);
  session.anchorPositionOverrides = [...normalized.anchorPositions];
  session.settlementPositionOverrides = [...normalized.settlementPositions];
  session.storyPositionOverrides = [...normalized.storyPositions];
  session.storyRuleOverrides = [...normalized.storyRules];
  session.zoneOverrides = [...normalized.zoneOverrides];
  session.placedImages = [...normalized.placedImages];
  session.islandOverrides = [...normalized.islandOverrides];
  session.bridgeOverrides = [...normalized.bridgeOverrides];
  session.customBridges = [...normalized.customBridges];
  session.portOverrides = [...normalized.portOverrides];
  session.customPorts = [...normalized.customPorts];
  session.authoringLayer = structuredClone(normalized.authoringLayer);
  session.npcLocationAuthoring = structuredClone(normalized.npcLocationAuthoring);
  session.roadNameOverrides = validNameOverrides(parsed.roadNames);
  session.blockNameOverrides = validNameOverrides(parsed.blockNames);
  if (Array.isArray(parsed.customStoryPoints)) {
    session.customStoryDefinitions = parsed.customStoryPoints.flatMap((value) => normalizeCustomStoryDefinition(value) ?? []).slice(0, MAX_CUSTOM_STORY_POINTS);
    saveCustomStoryDefinitions(session.customStoryDefinitions);
  }
  if (parsed.labelDisplay !== undefined) {
    session.setLabelSettings(normalizeLabelSettings(parsed.labelDisplay));
    saveLabelSettings(session.labelSettings);
    labelDisplay.apply(session.labelSettings);
  }
  persistMapCustomization();
  persistNames();
  generate(session.customAnchors, session.builtInOverrides, false);
  recordHistory(snapshot, 'import overrides');
  setStatus('Imported PAYAW overrides.', 'success');
}

function normalizeImportedAsset(value: unknown): ImportedImageAsset | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string'
    || typeof item.name !== 'string'
    || typeof item.mimeType !== 'string'
    || !item.mimeType.startsWith('image/')
    || typeof item.dataUrl !== 'string'
    || !item.dataUrl.startsWith('data:image/')
    || !isEnumValue(Object.values(AssetTargetCategory), item.targetCategory)
    || !(item.targetType === null || typeof item.targetType === 'string')
  ) return undefined;
  return {
    id: item.id,
    name: item.name.trim() || 'Imported image',
    mimeType: item.mimeType,
    dataUrl: item.dataUrl,
    targetCategory: item.targetCategory,
    targetType: item.targetType,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
  };
}

async function importPayawJsonFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
    throw new Error('Select a JSON file exported by PAYAW.');
  }
  if (file.size >256 * 1024 * 1024) throw new Error('PAYAW JSON is larger than the 256 MB import limit.');
  const parsed: unknown = JSON.parse(await file.text());
  if (typeof parsed !== 'object' || parsed === null) throw new Error('The selected file is not a PAYAW JSON object.');
  const root = parsed as Record<string, unknown>;
  if (root.format === 'payaw-npcs') {
    await npcJsonController.importFile(file);
    return;
  }
  if (root.format === 'payaw-world-overrides') {
    await importCustomizationFile(file);
    return;
  }
  if (root.format === 'payaw-project' || typeof root.project === 'object' || typeof root.seed === 'string') {
    await importProjectFile(file);
    return;
  }
  throw new Error('Unsupported JSON. Import a PAYAW project/world export or PAYAW overrides file.');
}


function normalizeStoredSimulation(value: unknown): Partial<StoredSimulationState> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const timeValue = typeof item.time === 'object' && item.time !== null ? item.time as Record<string, unknown> : {};
  const mode = timeValue.mode === 'campaign' || timeValue.mode === 'manual' ? timeValue.mode : 'realtime';
  const rawSpeed = Number(timeValue.speed);
  const speed: SimulationSpeed = rawSpeed === 0 || rawSpeed === 5 || rawSpeed === 15 || rawSpeed === 60 ? rawSpeed : 1;
  const campaignTimestampMs = Number.isFinite(Number(timeValue.campaignTimestampMs))
    ? Number(timeValue.campaignTimestampMs)
    : Date.now();
  const timezone = normalizeSimulationTimezone(timeValue.timezone);
  const weatherValues: readonly WeatherCondition[] = ['clear', 'cloudy', 'rain', 'heavy-rain', 'thunderstorm', 'typhoon'];
  const weatherOverride = weatherValues.includes(item.weatherOverride as WeatherCondition)
    ? item.weatherOverride as WeatherCondition
    : null;
  const normalizeStatuses = (candidate: unknown): Readonly<Record<number, InfrastructureOperationalState>> => {
    if (typeof candidate !== 'object' || candidate === null) return {};
    const valid: readonly InfrastructureOperationalState[] = ['open', 'restricted', 'closed', 'flooded', 'damaged', 'under-repair'];
    const result: Record<number, InfrastructureOperationalState> = {};
    for (const [key, status] of Object.entries(candidate as Record<string, unknown>)) {
      const id = Number(key);
      if (Number.isInteger(id) && id >= 0 && valid.includes(status as InfrastructureOperationalState)) result[id] = status as InfrastructureOperationalState;
    }
    return result;
  };
  const validCategories: readonly SimulationEvent['category'][] = ['time', 'weather', 'traffic', 'infrastructure', 'venue', 'npc', 'supernatural'];
  const validSeverities: readonly SimulationEvent['severity'][] = ['info', 'warning', 'critical'];
  const eventLog: SimulationEvent[] = Array.isArray(item.eventLog) ? item.eventLog.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const event = candidate as Partial<SimulationEvent>;
    if (
      typeof event.id !== 'string'
      || !Number.isFinite(event.timestampMs)
      || !validCategories.includes(event.category as SimulationEvent['category'])
      || !validSeverities.includes(event.severity as SimulationEvent['severity'])
      || typeof event.message !== 'string'
      || event.message.trim().length === 0
    ) return [];
    return [{
      id: event.id,
      timestampMs: event.timestampMs as number,
      category: event.category as SimulationEvent['category'],
      severity: event.severity as SimulationEvent['severity'],
      message: event.message.trim(),
    }];
  }).slice(0, 120) : [];
  return {
    time: { mode, speed: mode === 'manual' ? 0 : speed, campaignTimestampMs, timezone },
    weatherOverride,
    manualRoadStatusById: normalizeStatuses(item.manualRoadStatusById),
    manualBridgeStatusById: normalizeStatuses(item.manualBridgeStatusById),
    manualPortStatusById: normalizeStatuses(item.manualPortStatusById),
    eventLog,
  };
}

async function importProjectPayload(parsed: unknown, sourceLabel: string): Promise<void> {
  if (typeof parsed !== 'object' || parsed === null) throw new Error('The selected file is not a PAYAW JSON object.');
  const root = parsed as Record<string, unknown>;
  const metadata = typeof root.metadata === 'object' && root.metadata !== null ? root.metadata as Record<string, unknown> : {};
  const schemaVersion = typeof metadata.schemaVersion === 'number' ? metadata.schemaVersion : 8;
  if (schemaVersion > 20) throw new Error(`This project uses schema ${schemaVersion}, but this editor supports up to schema 20.`);

  const project = typeof root.project === 'object' && root.project !== null ? root.project as Record<string, unknown> : {};
  const authoring = typeof project.authoring === 'object' && project.authoring !== null
    ? project.authoring as Record<string, unknown>
    : {};
  const seed = typeof project.seed === 'string' ? project.seed : typeof root.seed === 'string' ? root.seed : '';
  if (seed.trim().length === 0) throw new Error('The project JSON does not contain a valid world seed.');
  const profile = normalizeStoredProfile(project.profile ?? metadata);
  const customizationSource = authoring.customization ?? root.customization;
  let customization = normalizeMapCustomization(customizationSource);
  if (authoring.npcLocationAuthoring !== undefined) customization = { ...customization, npcLocationAuthoring: normalizeNpcLocationAuthoring(authoring.npcLocationAuthoring) };
  const anchorState = normalizeAnchorState({
    customAnchors: authoring.customAnchors,
    builtInAnchorOverrides: authoring.builtInAnchorOverrides,
  });
  const importedRoadNames = validNameOverrides(authoring.roadNames);
  const importedBlockNames = validNameOverrides(authoring.blockNames);
  const labelSource = authoring.labelDisplay
    ?? (typeof root.customization === 'object' && root.customization !== null
      ? (root.customization as Record<string, unknown>).labelDisplay
      : undefined);
  const storySource = authoring.customStoryPoints
    ?? (typeof root.customization === 'object' && root.customization !== null
      ? (root.customization as Record<string, unknown>).customStoryPoints
      : undefined);
  const importedStories = Array.isArray(storySource)
    ? storySource.flatMap((value) => normalizeCustomStoryDefinition(value) ?? []).slice(0, MAX_CUSTOM_STORY_POINTS)
    : [];
  const importedNpcRosterSize = Math.round(finiteSetting(authoring.npcRosterSize, 0, 0, 200));
  session.pendingImportedSimulation = normalizeStoredSimulation(authoring.simulation);
  session.pendingImportedCampaign = normalizeCampaignState(authoring.campaign ?? root.campaign, `world:${seed.trim()}`);
  const importedPlayerViewSource = authoring.playerView ?? root.playerView;
  const importedPlayerCount = typeof importedPlayerViewSource === 'object' && importedPlayerViewSource !== null
    && Array.isArray((importedPlayerViewSource as Record<string, unknown>).players)
    ? (importedPlayerViewSource as { readonly players: readonly unknown[] }).players.length
    : 6;
  session.pendingImportedPlayerView = normalizePlayerViewState(importedPlayerViewSource, importedPlayerCount);
  const assetSource = authoring.imageAssets
    ?? (typeof root.customization === 'object' && root.customization !== null
      ? (root.customization as Record<string, unknown>).imageAssets
      : undefined);
  const assets = Array.isArray(assetSource)
    ? assetSource.flatMap((value) => normalizeImportedAsset(value) ?? []).slice(0, 256)
    : [];

  seedInput.value = seed.trim();
  terrainSizeSelect.value = profile.terrainSize;
  townScaleSelect.value = profile.townScale;
  terrainShapeSelect.value = profile.terrainShape;
  climatePresetSelect.value = profile.climatePreset;
  islandCountInput.value = String(profile.islandCount);
  islandSpacingInput.value = String(profile.islandSpacingKilometers);
    updateProfileHint();

  session.customAnchors = [...anchorState.customAnchors];
  session.builtInOverrides = [...anchorState.builtInOverrides];
  session.customStoryDefinitions = importedStories;
  session.setLabelSettings(normalizeLabelSettings(labelSource));
  labelDisplay.apply(session.labelSettings);
  session.roadNameOverrides = importedRoadNames;
  session.blockNameOverrides = importedBlockNames;

  const signature = worldSignature();
  saveProfile(profile);
  saveAnchorState(session.customAnchors, session.builtInOverrides);
  saveCustomStoryDefinitions(session.customStoryDefinitions);
  saveLabelSettings(session.labelSettings);
  saveNameState(signature, { roads: session.roadNameOverrides, blocks: session.blockNameOverrides });
  saveMapCustomization(signature, customization);
  for (const asset of assets) await assetRepository.put(asset);
  await assetLibrary.refresh();

  if (!await generateResponsive(session.customAnchors, session.builtInOverrides, true, true)) {
    throw new Error(statusMessage.textContent ?? 'The imported PAYAW project could not be generated.');
  }
  if (importedNpcRosterSize > 0 && importedNpcRosterSize !== session.world.npcs.length) {
    session.world.npcs = generateNPCPopulation(session.world, new SeededRandom(session.world.seed).fork(`npc-import-${importedNpcRosterSize}`), importedNpcRosterSize);
    renderNPCList();
    travelPlanner.refreshLocations();
    requestRender();
  }
  if (session.pendingImportedCampaign !== null) {
    session.campaignState = normalizeCampaignState(session.pendingImportedCampaign, currentCampaignWorldRef());
    session.pendingImportedCampaign = null;
    campaignStudio?.replaceState(session.campaignState);
    const campaignTimestamp = Date.parse(session.campaignState.runState.campaignTime);
    if (Number.isFinite(campaignTimestamp)) session.simulation?.setTimestamp(campaignTimestamp);
    session.simulation?.setWeatherOverride(session.campaignState.runState.weatherOverride === 'auto' ? null : session.campaignState.runState.weatherOverride as WeatherCondition);
  }
  if (session.pendingImportedPlayerView !== null) {
    session.playerViewState = session.pendingImportedPlayerView;
    session.pendingImportedPlayerView = null;
  }
  campaignStudio?.refreshExternalReferences();
  playerPreview?.refresh();
  setStatus(`Imported ${sourceLabel}${assets.length > 0 ? ` with ${assets.length} embedded asset${assets.length === 1 ? '' : 's'}` : ''}.`, 'success');
}

async function loadHostedAuthorityDocument(value: Readonly<Record<string, unknown>>): Promise<void> {
  const project = typeof value.project === 'object' && value.project !== null
    ? value.project as Record<string, unknown>
    : null;
  if (project !== null && typeof project.seed === 'string' && project.seed.trim().length > 0) {
    await importProjectPayload(value, 'hosted campaign state');
    return;
  }

  const campaignSource = value.campaign;
  const playerViewSource = value.playerView;
  if (typeof campaignSource !== 'object' || campaignSource === null) {
    throw new Error('The hosted campaign authority does not contain a campaign state or world recipe.');
  }
  session.campaignState = normalizeCampaignState(campaignSource, currentCampaignWorldRef());
  campaignStudio?.replaceState(session.campaignState);
  const campaignTimestamp = Date.parse(session.campaignState.runState.campaignTime);
  if (Number.isFinite(campaignTimestamp)) session.simulation?.setTimestamp(campaignTimestamp);
  session.simulation?.setWeatherOverride(session.campaignState.runState.weatherOverride === 'auto'
    ? null
    : session.campaignState.runState.weatherOverride as WeatherCondition);

  const playerCount = typeof playerViewSource === 'object' && playerViewSource !== null
    && Array.isArray((playerViewSource as Record<string, unknown>).players)
    ? (playerViewSource as { readonly players: readonly unknown[] }).players.length
    : session.playerViewState.players.length || 6;
  session.playerViewState = normalizePlayerViewState(playerViewSource, playerCount);
  campaignStudio?.refreshExternalReferences();
  playerPreview?.refresh();
  setStatus('Loaded hosted campaign state. This older snapshot did not contain a world recipe, so the current local map was retained.', 'success');
}

async function importProjectFile(file: File): Promise<void> {
  if (file.size > 256 * 1024 * 1024) throw new Error('Project JSON is larger than the 256 MB import limit.');
  const parsed: unknown = JSON.parse(await file.text());
  await importProjectPayload(parsed, 'PAYAW project JSON');
}

function currentNpcScheduleEntry(npc: NPC) {
  return npcScheduleEntryForPeriod(npc, session.activeNpcSchedulePeriod);
}

function syncNpcViewToggle(): void {
  const visible = layerElements[RenderLayer.NPCs].checked;
  npcViewToggleButton.textContent = visible ? 'NPCs: shown' : 'NPCs: hidden';
  npcViewToggleButton.setAttribute('aria-pressed', String(visible));
  npcViewToggleButton.dataset.active = String(visible);
}

function toggleNpcView(): void {
  const checkbox = layerElements[RenderLayer.NPCs];
  checkbox.checked = !checkbox.checked;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}

function updateNpcAuthoringState(next: NPCLocationAuthoringState, message?: string): void {
  npcController.updateAuthoring(next, message);
}

function updateSelectedNpcSchedule(entries: readonly NPCScheduleEntry[], message?: string): void {
  npcController.updateSchedule(entries, message);
}

function updateSelectedNpcRelationships(relationships: readonly NPCRelationship[], message?: string): void {
  npcController.updateRelationships(relationships, message);
}

function selectNpcForEditing(key: string): void {
  session.selectNpc(key);
  renderNPCList();
  npcEditorView.renderAll();
}

function npcStatusLabel(status: NPCStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function npcSettlement(npc: NPC): string {
  return session.world.settlements[npc.settlementId]?.name ?? 'Unknown settlement';
}

function filteredNpcs(): readonly NPC[] {
  const query = npcSearch.value.trim().toLocaleLowerCase();
  return session.world.npcs.filter((npc) => [npc.name, npc.occupation, npc.personality, npcSettlement(npc), npc.status, ...(npc.tags ?? [])]
    .join(' ').toLocaleLowerCase().includes(query));
}

function renderNPCList(): void {
  const filtered = filteredNpcs();
  renderNpcRosterView({
    count: npcCount,
    rosterSize: npcRosterSize,
    list: npcList,
    exportSelected: npcExportSelected,
    exportGroup: npcExportGroup,
  }, {
    totalCount: session.world.npcs.length,
    filteredNpcs: filtered,
    selectedKey: session.selectedNpcKey,
    hasSelectedNpc: npcController.selectedNpc() !== undefined,
  }, {
    describeNpc: (npc) => {
      const currentEntry = currentNpcScheduleEntry(npc);
      const dynamic = session.simulation?.state().npcs.entriesByNpcId[npc.id];
      const currentActivity = dynamic?.activity ?? currentEntry?.locationLabel ?? 'Unknown location';
      const movementLabel = dynamic !== undefined && dynamic.state !== 'at-location' ? ` · ${dynamic.state.replace('-', ' ')}` : '';
      return `${npc.age} · ${npc.occupation} · ${npcSettlement(npc)} · ${currentActivity}${movementLabel}`;
    },
    statusLabel: (npc) => npcStatusLabel(npc.status),
    editNpc: (key) => selectNpcForEditing(key),
    focusNpc: (npc) => focusMapPoint(npc.x, npc.y),
    useTravelEndpoint: (endpoint, npc) => {
      travelPlanner.selectEndpoint(endpoint, `npc:${npc.key}`);
      setWorkspace('dm');
    },
  });
}

function regenerateNpcRoster(): void {
  const requested = Math.max(1, Math.min(200, Math.round(Number(npcRosterSize.value) || 36)));
  const generated = generateNPCPopulation(session.world, new SeededRandom(session.world.seed).fork(`npc-ui-${requested}`), requested);
  session.world.npcs = applyNpcLocationAuthoring({ ...session.world, npcs: generated } as World, session.npcLocationAuthoring);
  session.simulation?.replaceWorld(session.world);
  session.simulation?.setNpcLocationAuthoring(session.npcLocationAuthoring);
  session.simulation?.tick(Date.now(), true);
  renderNPCList();
  travelPlanner.refreshLocations();
  campaignStudio?.refreshExternalReferences();
  requestRender();
  updateStats(stats, session.world);
  scheduleAutosave();
  setStatus(`Generated ${session.world.npcs.length} NPCs.`, 'success');
}

function refreshWorldUi(fitAfter = false, regeneratedFromStage?: string): void {
  if (session.pendingImportedSimulation !== undefined || session.simulation === null) {
    session.simulation = new WorldSimulation(session.world, session.pendingImportedSimulation);
    session.pendingImportedSimulation = undefined;
  } else {
    session.simulation.replaceWorld(session.world);
  }
  session.simulation.setNpcLocationAuthoring(session.npcLocationAuthoring);
  const simulationState = session.simulation.tick(Date.now(), true);
  session.activeNpcSchedulePeriod = npcSchedulePeriodForTimestamp(simulationState.time.campaignTimestampMs, simulationState.time.timezone);
  if (regeneratedFromStage === undefined) renderer.rebuildCache(session.world);
  else renderer.rebuildCache(session.world, rasterCacheLayersForStage(regeneratedFromStage));
  syncRendererCustomization();
  updateStats(stats, session.world);
  updateMapHeader();
  nameEditor.render();
  renderAnchorList();
  renderStoryList();
  renderStoryRuleEditor();
  renderCustomStoryList();
  renderNPCList();
  simulationPanel.render();
  travelPlanner.resetForWorld();
  updateZoneEditorUi();
  assetLibrary.renderPlacements();
  renderAuthoringLists();
  updatePerformancePanel();
  campaignStudio?.ensureWorldReference(currentCampaignWorldRef());
  campaignStudio?.refreshExternalReferences();
  playerPreview?.refresh();
  if (regeneratedFromStage === undefined) {
    mapInspector.rebuildMinimapBase();
    recordRecentProject();
  }
  mapInspector.renderInspector();
  scheduleAutosave();
  if (fitAfter) fitCamera();
}

function generate(
  candidateCustom: readonly CustomAnchorDefinition[] = session.customAnchors,
  candidateBuiltIns: readonly BuiltInAnchorOverride[] = session.builtInOverrides,
  fitAfter = true,
  clearEditorHistory = false,
): boolean {
  setStatus('Generating terrain, town, and story layer…', 'working');
  const signature = worldSignature();
  const names = loadNameState(signature);
  let mapCustomization = loadMapCustomization(signature);
  const recoveredOverrides: string[] = [];

  try {
    let nextWorld: World | undefined;
    const maximumAttempts = mapCustomization.anchorPositions.length + mapCustomization.settlementPositions.length + mapCustomization.storyPositions.length + 1;

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      try {
        nextWorld = pipeline.generate(seedInput.value, {
          ...generationOptions(
            candidateCustom,
            candidateBuiltIns,
            mapCustomization.anchorPositions,
            mapCustomization.settlementPositions,
            mapCustomization.storyPositions,
          ),
          roadNameOverrides: names.roads,
          blockNameOverrides: names.blocks,
          storyRuleOverrides: mapCustomization.storyRules,
          zoneOverrides: mapCustomization.zoneOverrides,
          islandOverrides: mapCustomization.islandOverrides,
          bridgeOverrides: mapCustomization.bridgeOverrides,
          customBridges: mapCustomization.customBridges,
          portOverrides: mapCustomization.portOverrides,
          customPorts: mapCustomization.customPorts,
          authoredSettlements: mapCustomization.authoringLayer.authoredSettlements,
          settlementAuthoringOverrides: mapCustomization.authoringLayer.settlementOverrides,
          terrainOverrides: mapCustomization.authoringLayer.terrainOverrides,
          generatedFeatureOverrides: mapCustomization.authoringLayer.generatedFeatureOverrides,
          authoredFeatures: mapCustomization.authoringLayer.features,
        });
        break;
      } catch (error) {
        if (!(error instanceof InvalidPositionOverrideError)) throw error;
        const recovered = recoverPositionOverrides(
          mapCustomization.anchorPositions,
          mapCustomization.settlementPositions,
          mapCustomization.storyPositions,
          error,
        );
        if (!recovered.removed) throw error;
        mapCustomization = {
          ...mapCustomization,
          anchorPositions: recovered.anchorPositions,
          settlementPositions: recovered.settlementPositions,
          storyPositions: recovered.storyPositions,
        };
        recoveredOverrides.push(`${error.kind} “${error.displayName}”`);
      }
    }

    if (nextWorld === undefined) {
      throw new Error('World generation could not recover from its saved position overrides. Reset moved objects and try again.');
    }

    session.world = nextWorld;
    session.activeWorldSignature = signature;
    session.roadNameOverrides = [...names.roads];
    session.blockNameOverrides = [...names.blocks];
    session.anchorPositionOverrides = [...mapCustomization.anchorPositions];
    session.settlementPositionOverrides = [...mapCustomization.settlementPositions];
    session.storyPositionOverrides = [...mapCustomization.storyPositions];
    session.storyRuleOverrides = [...mapCustomization.storyRules];
    session.zoneOverrides = [...mapCustomization.zoneOverrides];
    session.placedImages = [...mapCustomization.placedImages];
    session.islandOverrides = [...mapCustomization.islandOverrides];
    session.bridgeOverrides = [...mapCustomization.bridgeOverrides];
    session.customBridges = [...mapCustomization.customBridges];
    session.portOverrides = [...mapCustomization.portOverrides];
    session.customPorts = [...mapCustomization.customPorts];
    session.authoringLayer = structuredClone(mapCustomization.authoringLayer);
    session.npcLocationAuthoring = structuredClone(mapCustomization.npcLocationAuthoring);
    session.world.npcs = applyNpcLocationAuthoring(session.world, session.npcLocationAuthoring);

    // Persist the repaired state so the same stale override cannot block the
    // next load. Only invalid position records are removed; names, zoning,
    // assets, transport authoring, and every valid moved object are preserved.
    if (recoveredOverrides.length > 0) saveMapCustomization(signature, mapCustomization);

    refreshWorldUi(fitAfter);
    saveProfile({ terrainSize: selectedTerrainSize(), townScale: selectedTownScale(), terrainShape: selectedTerrainShape(), climatePreset: selectedClimatePreset(), islandCount: selectedIslandCount(), islandSpacingKilometers: selectedIslandSpacing(), satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT });
    if (clearEditorHistory) historyController.clear();
    const duration = Object.values(session.world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
    const recoveryMessage = recoveredOverrides.length === 0
      ? ''
      : ` Reset ${recoveredOverrides.length} stale saved position${recoveredOverrides.length === 1 ? '' : 's'}: ${recoveredOverrides.join(', ')}.`;
    setStatus(`Generated ${session.world.width}×${session.world.height} world in ${duration.toFixed(0)} ms.${recoveryMessage}`, recoveredOverrides.length === 0 ? 'success' : 'warning');
    return true;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
    return false;
  }
}

async function generateResponsive(
  candidateCustom: readonly CustomAnchorDefinition[] = session.customAnchors,
  candidateBuiltIns: readonly BuiltInAnchorOverride[] = session.builtInOverrides,
  fitAfter = true,
  clearEditorHistory = false,
  preserveActiveAuthoring = false,
): Promise<boolean> {
  activeGenerationController?.abort();
  const controller = new AbortController();
  activeGenerationController = controller;
  const runId = ++generationSequence;
  setGenerationRunning(true);
  setStatus('Generating deterministic world in scheduled stages…', 'working');
  generationProgressStage.textContent = 'Preparing generation…';

  const signature = worldSignature();
  const names = loadNameState(signature);
  let mapCustomization = preserveActiveAuthoring && session.activeWorldSignature.length > 0
    ? currentMapCustomization()
    : loadMapCustomization(signature);
  const recoveredOverrides: string[] = [];

  try {
    let nextWorld: World | undefined;
    const maximumAttempts = mapCustomization.anchorPositions.length + mapCustomization.settlementPositions.length + mapCustomization.storyPositions.length + 1;

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      try {
        nextWorld = await generationWorker.generate(seedInput.value, {
          ...generationOptions(
            candidateCustom,
            candidateBuiltIns,
            mapCustomization.anchorPositions,
            mapCustomization.settlementPositions,
            mapCustomization.storyPositions,
          ),
          roadNameOverrides: names.roads,
          blockNameOverrides: names.blocks,
          storyRuleOverrides: mapCustomization.storyRules,
          zoneOverrides: mapCustomization.zoneOverrides,
          islandOverrides: mapCustomization.islandOverrides,
          bridgeOverrides: mapCustomization.bridgeOverrides,
          customBridges: mapCustomization.customBridges,
          portOverrides: mapCustomization.portOverrides,
          customPorts: mapCustomization.customPorts,
          authoredSettlements: mapCustomization.authoringLayer.authoredSettlements,
          settlementAuthoringOverrides: mapCustomization.authoringLayer.settlementOverrides,
          terrainOverrides: mapCustomization.authoringLayer.terrainOverrides,
          generatedFeatureOverrides: mapCustomization.authoringLayer.generatedFeatureOverrides,
          authoredFeatures: mapCustomization.authoringLayer.features,
        }, {
          signal: controller.signal,
          onProgress: updateGenerationProgress,
          yieldBetweenStages: true,
        });
        break;
      } catch (error) {
        if (error instanceof GenerationCancelledError) throw error;
        if (!(error instanceof InvalidPositionOverrideError)) throw error;
        const recovered = recoverPositionOverrides(
          mapCustomization.anchorPositions,
          mapCustomization.settlementPositions,
          mapCustomization.storyPositions,
          error,
        );
        if (!recovered.removed) throw error;
        mapCustomization = {
          ...mapCustomization,
          anchorPositions: recovered.anchorPositions,
          settlementPositions: recovered.settlementPositions,
          storyPositions: recovered.storyPositions,
        };
        recoveredOverrides.push(`${error.kind} “${error.displayName}”`);
        generationProgressStage.textContent = `Recovering stale ${error.kind} position…`;
      }
    }

    if (runId !== generationSequence || controller.signal.aborted) throw new GenerationCancelledError();
    if (nextWorld === undefined) {
      throw new Error('World generation could not recover from its saved position overrides. Reset moved objects and try again.');
    }

    session.world = nextWorld;
    session.activeWorldSignature = signature;
    session.roadNameOverrides = [...names.roads];
    session.blockNameOverrides = [...names.blocks];
    session.anchorPositionOverrides = [...mapCustomization.anchorPositions];
    session.settlementPositionOverrides = [...mapCustomization.settlementPositions];
    session.storyPositionOverrides = [...mapCustomization.storyPositions];
    session.storyRuleOverrides = [...mapCustomization.storyRules];
    session.zoneOverrides = [...mapCustomization.zoneOverrides];
    session.placedImages = [...mapCustomization.placedImages];
    session.islandOverrides = [...mapCustomization.islandOverrides];
    session.bridgeOverrides = [...mapCustomization.bridgeOverrides];
    session.customBridges = [...mapCustomization.customBridges];
    session.portOverrides = [...mapCustomization.portOverrides];
    session.customPorts = [...mapCustomization.customPorts];
    session.authoringLayer = structuredClone(mapCustomization.authoringLayer);
    session.npcLocationAuthoring = structuredClone(mapCustomization.npcLocationAuthoring);
    session.world.npcs = applyNpcLocationAuthoring(session.world, session.npcLocationAuthoring);

    if (recoveredOverrides.length > 0 || preserveActiveAuthoring) saveMapCustomization(signature, mapCustomization);
    refreshWorldUi(fitAfter);
    saveProfile({
      terrainSize: selectedTerrainSize(),
      townScale: selectedTownScale(),
      terrainShape: selectedTerrainShape(),
      climatePreset: selectedClimatePreset(),
      islandCount: selectedIslandCount(),
      islandSpacingKilometers: selectedIslandSpacing(),
      satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT,
    });
    if (clearEditorHistory) historyController.clear();
    const duration = Object.values(session.world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
    const recoveryMessage = recoveredOverrides.length === 0
      ? ''
      : ` Reset ${recoveredOverrides.length} stale saved position${recoveredOverrides.length === 1 ? '' : 's'}: ${recoveredOverrides.join(', ')}.`;
    setStatus(`Generated ${session.world.width}×${session.world.height} world in ${duration.toFixed(0)} ms without locking the editor between stages.${recoveryMessage}`, recoveredOverrides.length === 0 ? 'success' : 'warning');
    return true;
  } catch (error) {
    if (error instanceof GenerationCancelledError) {
      setStatus('Generation cancelled. The previous world remains active.', 'warning');
      return false;
    }
    setStatus(error instanceof Error ? error.message : String(error), 'error');
    return false;
  } finally {
    if (runId === generationSequence) {
      activeGenerationController = null;
      setGenerationRunning(false);
    }
  }
}

function regenerateFrom(stageId: string, successMessage: string): boolean {
  setStatus('Updating authored world…', 'working');
  try {
    pipeline.regenerateFrom(session.world, stageId, generationOptions());
    refreshWorldUi(false, stageId);
    const duration = Object.entries(session.world.diagnostics.stageTimingsMs)
      .filter(([id]) => id === stageId || id === 'story-layer' || id === 'buildings' || id === 'vegetation')
      .reduce((sum, [, value]) => sum + value, 0);
    setStatus(`${successMessage} (${duration.toFixed(0)} ms partial regeneration)`, 'success');
    return true;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
    return false;
  }
}

function readAnchorSettings(): AnchorRuleSettings {
  const target = anchorTarget.value.length === 0 ? null : anchorTarget.value as BuiltInAnchorType;
  return {
    name: anchorName.value.trim(),
    region: anchorRegion.value as AnchorRegionPreference,
    terrain: anchorTerrain.value as AnchorTerrainPreference,
    targetAnchor: target,
    proximity: target === null ? AnchorProximityBand.None : anchorProximity.value as AnchorProximityBand,
    radius: Number(anchorRadius.value),
    minimumDistance: Number(anchorSpacing.value),
    zoneType: anchorZone.value.length === 0 ? null : anchorZone.value as ZoneType,
  };
}

function replaceAnchorPosition(values: readonly AnchorPositionOverride[], key: string, x: number, y: number): AnchorPositionOverride[] {
  return [...values.filter((value) => value.key !== key), { key, x, y }].sort((left, right) => left.key.localeCompare(right.key));
}


function replaceStoryPosition(values: readonly StoryPositionOverride[], key: string, id: number, x: number, y: number): StoryPositionOverride[] {
  return [
    ...values.filter((value) => value.key !== key && !(value.key === undefined && value.id === id)),
    { id, key, x, y },
  ].sort((left, right) => left.id - right.id || (left.key ?? '').localeCompare(right.key ?? ''));
}

function resetAnchorPosition(key: string): void {
  const snapshot = captureEditorSnapshot();
  const previous = session.anchorPositionOverrides;
  session.anchorPositionOverrides = session.anchorPositionOverrides.filter((position) => position.key !== key);
  persistMapCustomization();
  if (regenerateFrom('anchor-placement', 'Reset anchor position.')) {
    recordHistory(snapshot, 'reset anchor position');
    return;
  }
  session.anchorPositionOverrides = previous;
  persistMapCustomization();
  regenerateFrom('anchor-placement', 'Restored anchor position.');
}

function resetAllObjectPositions(): void {
  if (session.anchorPositionOverrides.length === 0 && session.settlementPositionOverrides.length === 0 && session.storyPositionOverrides.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousAnchors = session.anchorPositionOverrides;
  const previousSettlements = session.settlementPositionOverrides;
  const previousStories = session.storyPositionOverrides;
  session.anchorPositionOverrides = [];
  session.settlementPositionOverrides = [];
  session.storyPositionOverrides = [];
  persistMapCustomization();
  if (regenerateFrom('settlements', 'Reset moved anchors, community anchors, and story sites.')) {
    recordHistory(snapshot, 'reset moved objects');
    return;
  }
  session.anchorPositionOverrides = previousAnchors;
  session.settlementPositionOverrides = previousSettlements;
  session.storyPositionOverrides = previousStories;
  persistMapCustomization();
  regenerateFrom('settlements', 'Restored moved objects.');
}

function resetBuiltInAnchor(type: BuiltInAnchorType): void {
  const snapshot = captureEditorSnapshot();
  const candidate = session.builtInOverrides.filter((definition) => definition.type !== type);
  if (!generate(session.customAnchors, candidate, false)) return;
  session.builtInOverrides = candidate;
  saveAnchorState(session.customAnchors, session.builtInOverrides);
  recordHistory(snapshot, `reset ${ANCHOR_LABELS[type]} rules`);
  resetAnchorForm();
  renderAnchorList();
}

function removeCustomAnchor(id: string): void {
  const definition = session.customAnchors.find((item) => item.id === id);
  const snapshot = captureEditorSnapshot();
  const candidate = session.customAnchors.filter((item) => item.id !== id);
  if (!generate(candidate, session.builtInOverrides, false)) return;
  session.customAnchors = candidate;
  saveAnchorState(session.customAnchors, session.builtInOverrides);
  recordHistory(snapshot, `remove anchor ${definition?.name ?? id}`);
  resetAnchorForm();
  renderAnchorList();
}

function persistNames(): void {
  saveNameState(session.activeWorldSignature, { roads: session.roadNameOverrides, blocks: session.blockNameOverrides });
}

function setLayer(layer: RenderLayer, visible: boolean): void {
  renderer.layers.setVisible(layer, visible);
  layerElements[layer].checked = visible;
  if (layer === RenderLayer.RoadLabels) {
    session.setLabelSettings({ ...session.labelSettings, road: { ...session.labelSettings.road, visible } });
    saveLabelSettings(session.labelSettings);
  } else if (layer === RenderLayer.BlockLabels) {
    session.setLabelSettings({ ...session.labelSettings, block: { ...session.labelSettings.block, visible } });
    saveLabelSettings(session.labelSettings);
  }
  if (layer === RenderLayer.NPCs) {
    for (const peer of document.querySelectorAll<HTMLInputElement>('[data-layer-target="npc-layer"]')) peer.checked = visible;
    syncNpcViewToggle();
  }
}

function applyViewPreset(name: string): void {
  const visible = GM_MAP_VIEW_PRESETS[name];
  if (visible === undefined) return;
  const selected = new Set(visible);
  for (const layer of Object.values(RenderLayer)) setLayer(layer, selected.has(layer));
  studioShell.syncLayerManager();
  requestRender();
}

function setEditMode(enabled: boolean): void {
  if (enabled && session.authoringTool !== 'select') setAuthoringTool('select');
  if (enabled && zoneEditMode) setZoneEditMode(false);
  editMode = enabled;
  editModeButton.textContent = enabled ? 'On' : 'Off';
  editModeButton.dataset.active = String(enabled);
  toolbarEditButton.textContent = enabled ? 'Edit: on' : 'Edit: off';
  toolbarEditButton.dataset.active = String(enabled);
  canvas.classList.toggle('edit-mode', enabled);
  if (!enabled) {
    dragPreview = null;
    draggedImageId = null;
    canvas.classList.remove('entity-dragging');
  }
  syncRendererCustomization();
}

function worldPositionFromPointer(event: PointerEvent | DragEvent): { x: number; y: number } {
  const rectangle = canvas.getBoundingClientRect();
  return camera.screenToWorld(event.clientX - rectangle.left, event.clientY - rectangle.top);
}

function pointInsidePlacement(x: number, y: number, placement: PlacedImage): boolean {
  const cosine = Math.cos(-placement.rotation);
  const sine = Math.sin(-placement.rotation);
  const deltaX = x - placement.x;
  const deltaY = y - placement.y;
  const localX = deltaX * cosine - deltaY * sine;
  const localY = deltaX * sine + deltaY * cosine;
  return Math.abs(localX) <= placement.width * 0.5 && Math.abs(localY) <= placement.height * 0.5;
}

function hitMovableObject(x: number, y: number): { kind: 'anchor' | 'settlement' | 'story' | 'image'; key: string } | null {
  const markerRadius = Math.max(1.4, 10 / Math.max(1, camera.zoom));
  for (const item of session.world.storyObjects) {
    if (Math.hypot(x - (item.x + 0.5), y - (item.y + 0.5)) <= markerRadius) {
      return { kind: 'story', key: item.key };
    }
  }
  for (const anchor of session.world.anchors) {
    if (Math.hypot(x - (anchor.x + 0.5), y - (anchor.y + 0.5)) <= markerRadius) {
      return { kind: 'anchor', key: anchor.key };
    }
  }
  for (const settlement of session.world.settlements) {
    if (settlement.isPrimary) continue;
    if (Math.hypot(x - (settlement.x + 0.5), y - (settlement.y + 0.5)) <= markerRadius) {
      return { kind: 'settlement', key: settlement.key };
    }
  }
  const reversed = [...session.placedImages].sort((left, right) => right.zIndex - left.zIndex);
  for (const placement of reversed) {
    if (pointInsidePlacement(x, y, placement)) return { kind: 'image', key: placement.id };
  }
  return null;
}

function nearestDryTile(x: number, y: number, maximumRadius = 14): { x: number; y: number } | undefined {
  const centerX = Math.round(x);
  const centerY = Math.round(y);
  let best: { x: number; y: number; distance: number } | undefined;
  for (let offsetY = -maximumRadius; offsetY <= maximumRadius; offsetY += 1) {
    for (let offsetX = -maximumRadius; offsetX <= maximumRadius; offsetX += 1) {
      const tile = session.world.getTile(centerX + offsetX, centerY + offsetY);
      if (tile === undefined || tile.water !== WaterType.Land || tile.river) continue;
      const distance = Math.hypot(tile.x - x, tile.y - y);
      if (best === undefined || distance < best.distance) best = { x: tile.x, y: tile.y, distance };
    }
  }
  return best;
}

function commitAnchorMove(key: string, x: number, y: number): void {
  const tile = nearestDryTile(x, y);
  if (tile === undefined) {
    setStatus('Drop anchors on dry land.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = session.anchorPositionOverrides;
  session.anchorPositionOverrides = replaceAnchorPosition(session.anchorPositionOverrides, key, tile.x, tile.y);
  persistMapCustomization();
  if (regenerateFrom('anchor-placement', 'Moved anchor and rebuilt connected town systems.')) {
    recordHistory(snapshot, 'move anchor');
    return;
  }
  const error = statusMessage.textContent ?? 'The anchor could not be moved there.';
  session.anchorPositionOverrides = previous;
  persistMapCustomization();
  regenerateFrom('anchor-placement', 'Restored previous anchor position.');
  setStatus(`${error} The previous position was restored.`, 'error');
}

function commitSettlementMove(key: string, x: number, y: number): void {
  const settlement = session.world.settlements.find((item) => item.key === key);
  if (settlement === undefined || settlement.isPrimary) return;
  const tile = findNearestValidSettlementTile(session.world, key, x, y);
  if (tile === undefined) {
    setStatus('The selected community anchor is locked or the destination is outside the map.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previousLayer = session.authoringLayer;
  const previousSettlementPositions = session.settlementPositionOverrides;
  const existing = session.authoringLayer.settlementOverrides.find((override) => override.key === key);
  upsertSettlementAuthoringOverride({ ...existing, key, x: tile.x, y: tile.y });
  // Keep the portable position override in sync so older save readers retain
  // the destination island identity while the authoring layer remains canonical.
  session.moveSettlement(key, tile.x, tile.y, tile.islandKey);
  persistMapCustomization();
  const warning = tile.warning === undefined ? '' : ` Warning: ${tile.warning}.`;
  if (regenerateFrom('settlements', `Moved ${settlement.name}.${warning}`)) {
    recordHistory(snapshot, `move settlement ${settlement.name}`);
    return;
  }
  const error = statusMessage.textContent ?? 'The community anchor could not be moved there.';
  session.authoringLayer = previousLayer;
  session.settlementPositionOverrides = previousSettlementPositions;
  persistMapCustomization();
  regenerateFrom('settlements', 'Restored previous settlement position.');
  setStatus(`${error} The previous position was restored.`, 'error');
}

function commitStoryMove(key: string, id: number, x: number, y: number): void {
  const tile = nearestDryTile(x, y);
  if (tile === undefined) {
    setStatus('Drop story locations on dry land.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = session.storyPositionOverrides;
  session.storyPositionOverrides = replaceStoryPosition(session.storyPositionOverrides, key, id, tile.x, tile.y);
  persistMapCustomization();
  if (regenerateFrom('story-layer', 'Moved story location.')) {
    recordHistory(snapshot, 'move story point');
    return;
  }
  const error = statusMessage.textContent ?? 'The story location could not be moved there.';
  session.storyPositionOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Restored previous story position.');
  setStatus(`${error} The previous position was restored.`, 'error');
}

async function handleCanvasDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  viewportShell.dataset.dropActive = 'false';
  const position = worldPositionFromPointer(event);
  const existingAssetId = event.dataTransfer?.getData('application/x-payaw-asset-id') ?? '';
  if (existingAssetId.length > 0) {
    assetLibrary.placeAt(existingAssetId, position.x, position.y);
    setLayer(RenderLayer.CustomImages, true);
    return;
  }

  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
  if (files.length === 0) return;
  const snapshot = captureEditorSnapshot();
  setStatus(`Importing ${files.length} image${files.length === 1 ? '' : 's'}…`, 'working');
  try {
    const imported = await assetLibrary.importFiles(files, AssetTargetCategory.Map, null);
    imported.forEach((asset, index) => {
      session.placedImages = [...session.placedImages, assetLibrary.createPlacement(asset, position.x + index * 1.5, position.y + index * 1.5)];
    });
    persistMapCustomization();
    setLayer(RenderLayer.CustomImages, true);
    assetLibrary.renderPlacements();
    syncRendererCustomization();
    recordHistory(snapshot, `place ${imported.length} dropped image${imported.length === 1 ? '' : 's'}`);
    setStatus(`Imported and placed ${imported.length} image${imported.length === 1 ? '' : 's'}.`, 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

function animationFrame(): void {
  simulationPanel.updateRealtimeClock();
  if (renderRequested) {
    renderer.render(session.world, camera);
    renderRequested = false;
    updatePerformancePanel();
  }
  mapInspector.renderMinimap();
  mapInspector.updateStatusBar();
  window.requestAnimationFrame(animationFrame);
}

studioShell.restore();
renderRecentProjects();
updateRecoveryUi();
labelDisplay.apply(session.labelSettings);
updateProfileHint();
syncNpcViewToggle();
simulationPanel.updateRealtimeClock();

realtimeClock.addEventListener('click', () => {
  clockDisplayFormat = clockDisplayFormat === '12h' ? '24h' : '12h';
  localStorage.setItem(CLOCK_FORMAT_STORAGE_KEY, clockDisplayFormat);
  simulationPanel.invalidateClock();
  simulationPanel.updateRealtimeClock();
});
simulationClockMode.addEventListener('change', () => {
  session.simulation?.setClockMode(simulationClockMode.value as SimulationClockMode);
  simulationPanel.invalidateClock();
  simulationPanel.render();
  scheduleAutosave();
});
simulationSpeed.addEventListener('change', () => {
  session.simulation?.setSpeed(Number(simulationSpeed.value) as SimulationSpeed);
  simulationPanel.invalidateClock();
  simulationPanel.render();
  scheduleAutosave();
});
simulationApplyTime.addEventListener('click', () => {
  const timezone = session.simulation?.state().time.timezone ?? 'Asia/Manila';
  const timestamp = timestampFromZonedLocal(simulationDatetime.value, timezone);
  if (!Number.isFinite(timestamp)) {
    setStatus('Choose a valid campaign date and time.', 'error');
    return;
  }
  session.simulation?.setTimestamp(timestamp);
  session.simulation?.setClockMode(simulationClockMode.value as SimulationClockMode);
  simulationPanel.invalidateClock();
  simulationPanel.render();
  scheduleAutosave();
  setStatus('Applied the world date and time.', 'success');
});
simulationAdvance15.addEventListener('click', () => { session.simulation?.advanceMinutes(15); simulationPanel.invalidateClock(); simulationPanel.render(); scheduleAutosave(); });
simulationAdvanceHour.addEventListener('click', () => { session.simulation?.advanceMinutes(60); simulationPanel.invalidateClock(); simulationPanel.render(); scheduleAutosave(); });
simulationAdvanceDay.addEventListener('click', () => { session.simulation?.advanceMinutes(1440); simulationPanel.invalidateClock(); simulationPanel.render(); scheduleAutosave(); });
simulationWeather.addEventListener('change', () => {
  const value = simulationWeather.value;
  session.simulation?.setWeatherOverride(value === 'auto' ? null : value as WeatherCondition);
  simulationPanel.invalidateClock();
  simulationPanel.render();
  scheduleAutosave();
  travelPlanner.recalculateIfContextual();
});
simulationInfrastructureKind.addEventListener('change', () => simulationPanel.renderInfrastructureTargets());
simulationInfrastructureTarget.addEventListener('change', () => simulationPanel.renderInfrastructureTargets());
simulationEventFilter.addEventListener('change', () => simulationPanel.render());
simulationEventClear.addEventListener('click', () => {
  session.simulation?.clearEventLog();
  simulationPanel.render();
  scheduleAutosave();
  setStatus('Cleared the simulation event timeline.', 'success');
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-simulation-preset]')) {
  button.addEventListener('click', () => {
    if (session.simulation === null) return;
    const preset = button.dataset.simulationPreset;
    const state = session.simulation.state();
    if (preset === 'typhoon') {
      session.simulation.setWeatherOverride('typhoon');
      simulationWeather.value = 'typhoon';
      setStatus('Applied the typhoon scenario.', 'success');
    } else {
      const currentLocal = datetimeLocalValue(state.time.campaignTimestampMs, state.time.timezone);
      const date = currentLocal.slice(0, 10);
      const localTime = preset === 'morning' ? '08:00' : preset === 'rush' ? '18:00' : '03:00';
      const timestamp = timestampFromZonedLocal(`${date}T${localTime}`, state.time.timezone);
      session.simulation.setTimestamp(timestamp);
      session.simulation.setClockMode('manual');
      simulationClockMode.value = 'manual';
      setStatus(`Applied the ${preset === 'rush' ? 'evening rush' : preset === 'witching' ? '3 AM manifestation' : 'morning'} scenario.`, 'success');
    }
    simulationPanel.invalidateClock();
    simulationPanel.render();
    scheduleAutosave();
    travelPlanner.recalculateIfContextual();
  });
}
simulationInfrastructureApply.addEventListener('click', () => {
  const id = Number(simulationInfrastructureTarget.value);
  if (!Number.isInteger(id)) return;
  session.simulation?.setInfrastructureOverride(
    simulationInfrastructureKind.value as 'road' | 'bridge' | 'port',
    id,
    simulationInfrastructureStatus.value as InfrastructureOperationalState,
  );
  simulationPanel.invalidateClock();
  simulationPanel.render();
  scheduleAutosave();
  travelPlanner.recalculateIfContextual();
});
simulationInfrastructureClear.addEventListener('click', () => {
  const id = Number(simulationInfrastructureTarget.value);
  if (!Number.isInteger(id)) return;
  session.simulation?.setInfrastructureOverride(
    simulationInfrastructureKind.value as 'road' | 'bridge' | 'port',
    id,
    null,
  );
  simulationPanel.invalidateClock();
  simulationPanel.render();
  scheduleAutosave();
  travelPlanner.recalculateIfContextual();
});
function currentCampaignWorldRef(): string {
  return `world:${session.activeWorldSignature.length > 0 ? session.activeWorldSignature : session.world?.seed ?? seedInput.value.trim()}`;
}

function campaignNpcOptions(): readonly CampaignStudioOption[] {
  if (session.world === undefined) return [];
  return session.world.npcs.map((npc) => ({ id: npc.key, label: npc.name, subtitle: npc.occupation }));
}

function campaignStudioLocationOptions(): readonly CampaignStudioOption[] {
  if (session.world === undefined) return [];
  return collectCampaignLocations(session.world, session.authoringLayer).filter((location) => location.kind !== 'building').map((location) => ({
    id: location.ref,
    label: location.label,
    subtitle: location.kind.replaceAll('-', ' '),
  }));
}

function campaignCharacterOptions(): readonly CampaignStudioOption[] {
  return session.playerViewState.players
    .filter((player) => player.active)
    .map((player) => {
      const character = session.playerViewState.characters.find((candidate) => candidate.id === player.characterId);
      return { id: player.characterId, label: character?.name ?? player.displayName, subtitle: player.displayName };
    });
}

function campaignAssetOptions(): readonly CampaignStudioOption[] {
  return session.importedAssets.map((asset) => ({ id: asset.id, label: asset.name, subtitle: asset.mimeType }));
}

function focusCampaignLocation(locationRef: string): void {
  if (session.world === undefined) return;
  const location = collectCampaignLocations(session.world, session.authoringLayer).find((candidate) => candidate.ref === locationRef);
  if (location === undefined) {
    showToast('That campaign location is no longer available on the current world.', 'warning');
    return;
  }
  const tile = session.world.tiles[location.tileIndex];
  if (tile !== undefined) focusMapPoint(tile.x, tile.y);
}

function syncCampaignScenePlacement(scene: import('./campaign/CampaignSystem').CampaignScene | null): void {
  if (session.world === undefined) return;
  const campaignPlacementPrefix = 'campaign-scene:';
  const retained = session.npcLocationAuthoring.scenePlacements.filter((placement) => !placement.id.startsWith(campaignPlacementPrefix));
  const additions: NPCScenePlacement[] = [];
  if (scene !== null && scene.locationRef !== null) {
    const location = scheduleLocationFromRef(session.world, session.authoringLayer, scene.locationRef, scene.name);
    if (location !== undefined) {
      for (const participant of scene.participants) {
        if (participant.type !== 'npc') continue;
        additions.push({
          id: `${campaignPlacementPrefix}${scene.id}:${participant.id}`,
          sceneId: scene.id,
          npcKey: participant.id,
          location,
          activity: `Present in ${scene.name}`,
          visibleToPlayers: !participant.hidden,
        });
      }
    }
  }
  const next = normalizeNpcLocationAuthoring({
    ...session.npcLocationAuthoring,
    activeSceneId: scene?.id ?? null,
    scenePlacements: [...retained, ...additions],
  });
  const beforeKey = JSON.stringify({ activeSceneId: session.npcLocationAuthoring.activeSceneId, placements: session.npcLocationAuthoring.scenePlacements.filter((placement) => placement.id.startsWith(campaignPlacementPrefix)) });
  const afterKey = JSON.stringify({ activeSceneId: next.activeSceneId, placements: next.scenePlacements.filter((placement) => placement.id.startsWith(campaignPlacementPrefix)) });
  if (beforeKey === afterKey) return;
  session.npcLocationAuthoring = next;
  session.world.npcs = applyNpcLocationAuthoring(session.world, session.npcLocationAuthoring);
  session.simulation?.setNpcLocationAuthoring(session.npcLocationAuthoring);
  renderNPCList();
  requestRender();
}

function createCampaignStudio(): CampaignStudio {
  return new CampaignStudio(session.campaignState, {
    hostingEnabled: readNetcodeConfig().enabled,
    getWorldRef: currentCampaignWorldRef,
    getNpcOptions: campaignNpcOptions,
    getLocationOptions: campaignStudioLocationOptions,
    getCharacterOptions: campaignCharacterOptions,
    getAssetOptions: campaignAssetOptions,
    getExternalAssetIds: () => new Set(session.importedAssets.map((asset) => asset.id)),
    onChange: (state) => {
      session.campaignState = state;
      scheduleAutosave();
      playerPreview?.refresh();
      document.dispatchEvent(new CustomEvent('payaw:campaign-state-changed'));
    },
    onTimeChange: (timestamp, timezone) => {
      const value = Date.parse(timestamp);
      if (Number.isFinite(value)) {
        session.simulation?.setClockMode('manual');
        session.simulation?.setTimestamp(value);
        session.simulation?.setTimezone(timezone);
      }
      simulationPanel.render();
      requestRender();
    },
    onWeatherChange: (weather) => {
      session.simulation?.setWeatherOverride(weather === 'auto' ? null : weather as WeatherCondition);
      simulationPanel.render();
      requestRender();
    },
    onActiveSceneChange: syncCampaignScenePlacement,
    onFocusLocation: focusCampaignLocation,
    notify: (message, kind = 'success') => showToast(message, kind),
  });
}

function syncSimulationToCampaignClock(): void {
  const timestamp = Date.parse(session.campaignState.runState.campaignTime);
  if (!Number.isFinite(timestamp) || session.simulation === null) return;
  session.simulation.setClockMode('manual');
  session.simulation.setTimestamp(timestamp);
  session.simulation.setTimezone(session.campaignState.runState.timezone);
}

if (!generate(session.customAnchors, session.builtInOverrides, true, true)) throw new Error('The initial PAYAW world could not be generated.');
session.campaignState = normalizeCampaignState(session.campaignState, currentCampaignWorldRef());
campaignStudio = createCampaignStudio();
campaignStudio.refreshExternalReferences();
session.playerViewState = normalizePlayerViewState(session.playerViewState, session.playerViewState.players.length || 6);
playerPreview = new GmPlayerPreview({
  getContext: () => ({ campaign: session.campaignState, world: session.world, authoringLayer: session.authoringLayer, npcLocationAuthoring: session.npcLocationAuthoring, generationOptions: generationOptions() }),
  getState: () => session.playerViewState,
  setState: (state) => {
    session.playerViewState = state;
    campaignStudio?.refreshExternalReferences();
    scheduleAutosave();
    document.dispatchEvent(new CustomEvent('payaw:player-state-changed'));
  },
  notify: (message, kind = 'success') => showToast(message, kind),
});
let netcodePanelLoaded = false;
function loadNetcodePanel(): void {
  if (netcodePanelLoaded) return;
  netcodePanelLoaded = true;
  void import('./netcode/GmNetcodePanel').then(({ GmNetcodePanel }) => {
    new GmNetcodePanel({
      getContext: () => ({ campaign: session.campaignState, world: session.world, authoringLayer: session.authoringLayer, npcLocationAuthoring: session.npcLocationAuthoring, generationOptions: generationOptions() }),
      getState: () => session.playerViewState,
      getAuthorityDocument: () => createHostedCampaignPayload(),
      loadAuthorityDocument: async (authorityDocument) => {
        await loadHostedAuthorityDocument(authorityDocument);
        scheduleAutosave();
        document.dispatchEvent(new CustomEvent('payaw:project-state-changed'));
      },
      getAssetData: (assetId) => {
        const asset = session.importedAssets.find((candidate) => candidate.id === assetId);
        return asset === undefined ? null : { dataUrl: asset.dataUrl, mimeType: asset.mimeType };
      },
      notify: (message, kind = 'success') => showToast(message, kind),
    });
  }).catch((error: unknown) => showToast(error instanceof Error ? error.message : String(error), 'error'));
}
document.addEventListener('payaw:panel-change', (event) => {
  const detail = (event as CustomEvent<{ readonly workspace?: string; readonly key?: string }>).detail;
  if (detail.workspace === 'dm' && detail.key === 'players') loadNetcodePanel();
});
if (readNetcodeConfig().enabled) loadNetcodePanel();
syncSimulationToCampaignClock();
authoringController.initialize();
renderAuthoringLists();
setEditMode(false);
setZoneEditMode(false);
setWorkspace(session.activeWorkspace, session.activeWorkspace === 'dm');
if (session.activeWorkspace === 'dm') workspaceDmButton.click();
else workspaceEditorButton.click();
renderDmSessionLog();
assetLibrary.renderAssets();
void assetLibrary.refresh().catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : String(error), 'error');
});
window.requestAnimationFrame(animationFrame);

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const editingText = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLocaleLowerCase();
  if (commandPalette.handleKeyDown(event)) return;
  if (modifier && !event.altKey && key === 'p') { event.preventDefault(); commandPalette.open(); return; }
  if (modifier && !event.altKey && key === 's') { event.preventDefault(); downloadWorld(); return; }
  if (modifier && !event.altKey && key === 'o') { event.preventDefault(); projectImportFile.click(); return; }
  if (modifier && !event.altKey && event.key === '[') { event.preventDefault(); studioShell.toggleLeftPanel(); return; }
  if (modifier && !event.altKey && event.key === ']') { event.preventDefault(); studioShell.toggleStudioDock(); return; }
  if (editingText) return;
  if (modifier && !event.altKey && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  else if (modifier && !event.altKey && key === 'y') { event.preventDefault(); redo(); }
  else if (!modifier && key === 'f') { event.preventDefault(); mapInspector.focusSelection(); }
  else if (!modifier && key === 'g') { event.preventDefault(); void generateResponsive(session.customAnchors, session.builtInOverrides, true, true, true); }
  else if (!modifier && key === 'n') { event.preventDefault(); toggleNpcView(); }
  else if (event.key === 'Escape') { mapInspector.clearSelection(); }
});
window.addEventListener('resize', fitCamera);
for (const control of document.querySelectorAll<HTMLInputElement>('[data-layer-target]')) {
  const targetId = control.dataset.layerTarget;
  const target = targetId === undefined ? null : document.getElementById(targetId) as HTMLInputElement | null;
  if (target === null) continue;
  control.checked = target.checked;
  control.addEventListener('change', () => {
    target.checked = control.checked;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    for (const peer of document.querySelectorAll<HTMLInputElement>(`[data-layer-target="${targetId}"]`)) peer.checked = target.checked;
  });
  target.addEventListener('change', () => {
    for (const peer of document.querySelectorAll<HTMLInputElement>(`[data-layer-target="${targetId}"]`)) peer.checked = target.checked;
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-open-workspace="dm"]')) button.addEventListener('click', () => setWorkspace('dm'));
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-open-panel="npc"]')) button.addEventListener('click', () => {
  setWorkspace('editor');
  document.querySelector('.npc-studio-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
window.setInterval(scheduleAutosave, 30_000);
window.addEventListener('beforeunload', () => {
  if (session.world === undefined) return;
  try {
    writeAutosavedProject(createAutosavePayload());
    saveBrowserMapView();
    markSessionResumeAvailable();
  } catch { /* best effort */ }
});
workspaceEditorButton.addEventListener('click', () => setWorkspace('editor'));
workspaceDmButton.addEventListener('click', () => setWorkspace('dm'));
dmViewPreset.addEventListener('change', () => {
  applyViewPreset(dmViewPreset.value);
  viewPreset.value = dmViewPreset.value;
});
dmStorySearch.addEventListener('input', filterDmStoryCards);
restoreRemovedStoryPoints.addEventListener('click', restoreAllSuppressedStoryPoints);
dmRandomEncounterButton.addEventListener('click', () => rollDmEncounter());
dmClearLog.addEventListener('click', () => {
  session.dmSessionEntries = [];
  renderDmSessionLog();
});
fitMapButton.addEventListener('click', fitCamera);
viewPreset.addEventListener('change', () => {
  applyViewPreset(viewPreset.value);
  if (viewPreset.value !== 'custom') dmViewPreset.value = viewPreset.value;
});
editModeButton.addEventListener('click', () => { if (!editMode) setZoneEditMode(false); setEditMode(!editMode); });
toolbarEditButton.addEventListener('click', () => { if (!editMode) setZoneEditMode(false); setEditMode(!editMode); });
resetObjectPositionsButton.addEventListener('click', resetAllObjectPositions);
assetTargetCategory.addEventListener('change', () => assetLibrary.updateImportTargetOptions());
assetForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const files = Array.from(assetFiles.files ?? []);
  if (files.length === 0) {
    setStatus('Choose at least one image file.', 'error');
    return;
  }
  const category = assetTargetCategory.value as AssetTargetCategory;
  const targetType = category === AssetTargetCategory.Map || assetTargetType.value.length === 0 ? null : assetTargetType.value;
  setStatus(`Importing ${files.length} asset${files.length === 1 ? '' : 's'}…`, 'working');
  void assetLibrary.importFiles(files, category, targetType).then((assets) => {
    assetFiles.value = '';
    setStatus(`Imported ${assets.length} asset${assets.length === 1 ? '' : 's'} for ${describeAssetTarget(category, targetType)}.`, 'success');
  }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
});

customStoryCancel.addEventListener('click', resetCustomStoryForm);
customStoryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = customStoryName.value.trim();
  if (name.length === 0) {
    setStatus('Enter a story point name.', 'error');
    return;
  }
  const editingId = customStoryEditId.value;
  if (editingId.length === 0 && session.customStoryDefinitions.length >= MAX_CUSTOM_STORY_POINTS) {
    setStatus(`The editor supports up to ${MAX_CUSTOM_STORY_POINTS} custom story points.`, 'error');
    return;
  }
  if (session.customStoryDefinitions.some((item) => item.id !== editingId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    setStatus('Story point names must be unique.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = session.customStoryDefinitions;
  const definition = readCustomStoryDefinition(editingId.length === 0 ? undefined : editingId);
  session.customStoryDefinitions = editingId.length === 0
    ? [...session.customStoryDefinitions, definition]
    : session.customStoryDefinitions.map((item) => item.id === editingId ? definition : item);
  saveCustomStoryDefinitions(session.customStoryDefinitions);
  if (regenerateFrom('story-layer', `${editingId.length === 0 ? 'Added' : 'Updated'} ${definition.name}.`)) {
    recordHistory(snapshot, `${editingId.length === 0 ? 'add' : 'edit'} story point ${definition.name}`);
    resetCustomStoryForm();
    return;
  }
  session.customStoryDefinitions = previous;
  saveCustomStoryDefinitions(session.customStoryDefinitions);
  regenerateFrom('story-layer', 'Restored previous story points.');
});

storyRuleTarget.addEventListener('change', syncStoryRuleEditor);
storyRuleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const item = storyFromEditorSelection();
  if (item === undefined) return;
  const snapshot = captureEditorSnapshot();
  const allowedZones = selectedZoneValues(storyAllowedZones);
  const disallowedZones = selectedZoneValues(storyDisallowedZones).filter((zone) => !allowedZones.includes(zone));
  const customName = storyRuleName.value.trim();
  const encounters = parseEncounterLines(storyRuleEncounters.value);
  const rule: StoryRuleOverride = {
    id: item.id,
    key: item.key,
    ...(customName.length > 0 ? { name: customName } : {}),
    preferredZone: storyPreferredZone.value.length === 0 ? null : storyPreferredZone.value as ZoneType,
    allowedZones,
    disallowedZones,
    influenceRadius: Math.max(2, Math.min(40, Number(storyInfluenceRadius.value) || 10)),
    ...(storyRuleWish.value.trim().length > 0 ? { wish: storyRuleWish.value.trim() } : {}),
    ...(storyRuleManifestation.value.trim().length > 0 ? { manifestation: storyRuleManifestation.value.trim() } : {}),
    ...(encounters.length > 0 ? { encounters } : {}),
    ...(storyRuleFor(item.id, item.key)?.suppressed === true ? { suppressed: true } : {}),
  };
  const previous = session.storyRuleOverrides;
  session.storyRuleOverrides = [
    ...session.storyRuleOverrides.filter((candidate) => candidate.key !== item.key && !(candidate.key === undefined && candidate.id === item.id)),
    rule,
  ].sort((left, right) => left.id - right.id || (left.key ?? '').localeCompare(right.key ?? ''));
  persistMapCustomization();
  if (regenerateFrom('story-layer', 'Story rules and encounter table updated.')) {
    recordHistory(snapshot, `edit story point ${item.name}`);
    return;
  }
  session.storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Restored previous story rules.');
});
storyRuleReset.addEventListener('click', () => {
  const item = storyFromEditorSelection();
  if (item === undefined) return;
  const snapshot = captureEditorSnapshot();
  const previous = session.storyRuleOverrides;
  session.storyRuleOverrides = session.storyRuleOverrides.filter((candidate) => candidate.key !== item.key && !(candidate.key === undefined && candidate.id === item.id));
  persistMapCustomization();
  if (regenerateFrom('story-layer', 'Story rules reset to generated defaults.')) {
    recordHistory(snapshot, `reset story rules for ${item.name}`);
    return;
  }
  session.storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Restored previous story rules.');
});

zoneEditModeButton.addEventListener('click', () => setZoneEditMode(!zoneEditMode));
zoneBrushSize.addEventListener('input', () => { updateZoneEditorUi(); syncRendererCustomization(); });
zoneToolSelect.addEventListener('change', updateZoneEditorUi);
zoneDisplayMode.addEventListener('change', () => { setLayer(RenderLayer.Zones, true); syncRendererCustomization(); });
zoneResetAll.addEventListener('click', () => {
  if (session.zoneOverrides.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previous = [...session.zoneOverrides];
  session.zoneOverrides = [];
  persistAndRegenerateZoneOverrides(previous, snapshot, 'Reset all zone overrides.');
});

bridgeFromIsland.addEventListener('change', () => {
  if (bridgeToIsland.value === bridgeFromIsland.value) {
    bridgeToIsland.value = session.world.islands.find((island) => island.key !== bridgeFromIsland.value && island.allowBridges)?.key ?? '';
  }
});

bridgeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (bridgeFromIsland.value.length === 0 || bridgeToIsland.value.length === 0 || bridgeFromIsland.value === bridgeToIsland.value) {
    setStatus('Choose two different bridge-enabled islands.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const definition: CustomBridgeDefinition = {
    key: `bridge:custom:${createRuleId()}`,
    name: bridgeName.value.trim(),
    fromIslandKey: bridgeFromIsland.value,
    toIslandKey: bridgeToIsland.value,
    type: bridgeType.value as BridgeType,
    roadClass: bridgeRoadClass.value as RoadType,
    deckWidth: Number(bridgeWidth.value),
    clearance: Number(bridgeClearance.value),
    locked: false,
  };
  const previous = [...session.customBridges];
  session.customBridges = [...session.customBridges, definition];
  persistMapCustomization();
  if (!regenerateFrom('bridges', `Added ${definition.name}.`) || !session.world.bridges.some((bridge) => bridge.key === definition.key)) {
    session.customBridges = previous;
    persistMapCustomization();
    regenerateFrom('bridges', 'Restored the previous bridge network.');
    setStatus('No valid coast-to-coast crossing was found for that island pair. Try another pair or draw a manual crossing as an authored infrastructure feature.', 'error');
    return;
  }
  bridgeName.value = '';
  recordHistory(snapshot, `add bridge ${definition.name}`);
});

bridgeResetAll.addEventListener('click', () => {
  if (session.bridgeOverrides.length === 0 && session.customBridges.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousOverrides = [...session.bridgeOverrides];
  const previousCustom = [...session.customBridges];
  session.bridgeOverrides = [];
  session.customBridges = [];
  persistMapCustomization();
  if (regenerateFrom('bridges', 'Reset bridge authoring to generated defaults.')) {
    recordHistory(snapshot, 'reset bridge authoring');
    return;
  }
  session.bridgeOverrides = previousOverrides;
  session.customBridges = previousCustom;
  persistMapCustomization();
  regenerateFrom('bridges', 'Restored previous bridge authoring.');
});

portForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (portIsland.value.length === 0) {
    setStatus('Choose a port-enabled island.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const definition: CustomPortDefinition = {
    key: `port:custom:${createRuleId()}`,
    name: portName.value.trim(),
    islandKey: portIsland.value,
    type: portType.value as PortType,
    capacity: Math.max(20, Math.min(5000, Number(portCapacity.value) || 300)),
    locked: true,
  };
  const previous = [...session.customPorts];
  session.customPorts = [...session.customPorts, definition];
  persistMapCustomization();
  if (!regenerateFrom('ports', `Added ${definition.name}.`) || !session.world.ports.some((port) => port.key === definition.key)) {
    session.customPorts = previous;
    persistMapCustomization();
    regenerateFrom('ports', 'Restored the previous port network.');
    setStatus('No valid coastline site was found on that island. Try another coastline or place a manual dock as an authored infrastructure feature.', 'error');
    return;
  }
  portName.value = '';
  recordHistory(snapshot, `add port ${definition.name}`);
});

portResetAll.addEventListener('click', () => {
  if (session.portOverrides.length === 0 && session.customPorts.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousOverrides = [...session.portOverrides];
  const previousCustom = [...session.customPorts];
  session.portOverrides = [];
  session.customPorts = [];
  persistMapCustomization();
  if (regenerateFrom('ports', 'Reset port authoring to generated defaults.')) {
    recordHistory(snapshot, 'reset port authoring');
    return;
  }
  session.portOverrides = previousOverrides;
  session.customPorts = previousCustom;
  persistMapCustomization();
  regenerateFrom('ports', 'Restored previous port authoring.');
});

for (const layer of Object.values(RenderLayer)) {
  const checkbox = layerElements[layer];
  checkbox.addEventListener('change', () => {
    renderer.layers.setVisible(layer, checkbox.checked);
    if (layer === RenderLayer.RoadLabels || layer === RenderLayer.BlockLabels) {
      labelDisplay.commitFromControls();
    }
    if (layer === RenderLayer.NPCs) syncNpcViewToggle();
    viewPreset.value = 'custom';
    requestRender();
  });
}

anchorTarget.addEventListener('change', () => {
  const hasTarget = anchorTarget.value.length > 0;
  anchorProximity.disabled = !hasTarget;
  anchorProximity.value = hasTarget ? AnchorProximityBand.Near : AnchorProximityBand.None;
});
anchorCancelButton.addEventListener('click', resetAnchorForm);
anchorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const settings = readAnchorSettings();
  if (settings.name.length === 0) {
    setStatus('Enter an anchor name.', 'error');
    return;
  }
  const editing = anchorEditKey.value;
  const existingNames = [
    ...BUILT_IN_ANCHOR_TYPES.map((type) => ({ key: `builtin:${type}`, name: mergedBuiltInDefinition(type).name })),
    ...session.customAnchors.map((definition) => ({ key: `custom:${definition.id}`, name: definition.name })),
  ];
  if (existingNames.some((item) => item.key !== editing && item.name.toLocaleLowerCase() === settings.name.toLocaleLowerCase())) {
    setStatus('Anchor names must be unique.', 'error');
    return;
  }

  const snapshot = captureEditorSnapshot();
  if (editing.startsWith('builtin:')) {
    const type = editing.slice('builtin:'.length) as BuiltInAnchorType;
    const candidate = [...session.builtInOverrides.filter((definition) => definition.type !== type), { type, ...settings }];
    if (!generate(session.customAnchors, candidate, false)) return;
    session.builtInOverrides = candidate;
  } else if (editing.startsWith('custom:')) {
    const id = editing.slice('custom:'.length);
    const candidate = session.customAnchors.map((definition) => definition.id === id ? { id, ...settings } : definition);
    if (!generate(candidate, session.builtInOverrides, false)) return;
    session.customAnchors = candidate;
  } else {
    if (session.customAnchors.length >= MAX_CUSTOM_ANCHORS) {
      setStatus(`The editor supports up to ${MAX_CUSTOM_ANCHORS} custom anchors.`, 'error');
      return;
    }
    const candidate = [...session.customAnchors, { id: createRuleId(), ...settings }];
    if (!generate(candidate, session.builtInOverrides, false)) return;
    session.customAnchors = candidate;
  }
  saveAnchorState(session.customAnchors, session.builtInOverrides);
  recordHistory(snapshot, editing.length === 0 ? 'add custom anchor' : 'edit anchor rules');
  resetAnchorForm();
  renderAnchorList();
});

function beginAuthoringTerrainStroke(event: PointerEvent, position: AuthoringPoint): void {
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);
  if (!session.world.contains(x, y)) return;
  session.authoringTerrainStrokeActive = true;
  session.authoringTerrainStroke.clear();
  const indices = brushIndices(session.world, position.x, position.y, Number(authoringTerrainSize.value));
  for (const index of indices) session.authoringTerrainStroke.add(index);
  zoneBrushPreview = [...session.authoringTerrainStroke];
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('entity-dragging');
  syncRendererCustomization();
}

function endAuthoringTerrainStroke(event: PointerEvent, cancelled = false): void {
  if (!session.authoringTerrainStrokeActive) return;
  session.authoringTerrainStrokeActive = false;
  const indices = [...session.authoringTerrainStroke];
  session.authoringTerrainStroke.clear();
  zoneBrushPreview = [];
  canvas.classList.remove('entity-dragging');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  syncRendererCustomization();
  if (!cancelled) commitAuthoringTerrain(indices);
}

function beginAuthoredFeatureDrag(event: PointerEvent, feature: AuthoredMapFeature, position: AuthoringPoint): void {
  loadFeatureIntoForm(feature.id);
  if (feature.locked) {
    setAuthoringStatus(`${feature.name} is locked. Unlock it in the anchor list before moving it.`, 'warning');
    return;
  }
  session.authoredFeatureOriginal = structuredClone(feature);
  authoredFeatureHistorySnapshot = captureEditorSnapshot();
  session.authoredFeaturePointerStart = position;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('entity-dragging');
}

function endAuthoredFeatureDrag(event: PointerEvent, cancelled = false): void {
  if (session.authoredFeatureOriginal === null) return;
  const original = session.authoredFeatureOriginal;
  const snapshot = authoredFeatureHistorySnapshot;
  session.authoredFeatureOriginal = null;
  authoredFeatureHistorySnapshot = null;
  session.authoredFeaturePointerStart = null;
  canvas.classList.remove('entity-dragging');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  if (cancelled || pointerTravel <= 1) {
    session.authoringLayer = {
      ...session.authoringLayer,
      features: session.authoringLayer.features.map((feature) => feature.id === original.id ? original : feature),
    };
    renderAuthoringLists();
    syncRendererCustomization();
    return;
  }

  persistMapCustomization();
  const updated = session.authoringLayer.features.find((feature) => feature.id === original.id);
  const stage = updated === undefined ? null : featureRegenerationStage(updated);
  if (stage !== null) regenerateFrom(stage, `Moved ${updated?.name ?? original.name}.`);
  else {
    renderAuthoringLists();
    syncRendererCustomization();
    setStatus(`Moved ${updated?.name ?? original.name}.`, 'success');
  }
  if (snapshot !== null) recordHistory(snapshot, `move authored ${original.category}`);
}

function handleCanvasPointerDown(event: PointerEvent): void {
  pointerTravel = 0;
  const position = worldPositionFromPointer(event);
  if (session.authoringTool === 'terrain-brush') {
    beginAuthoringTerrainStroke(event, position);
    return;
  }
  if (zoneEditMode) {
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    if (!session.world.contains(x, y)) return;
    const tileIndex = y * session.world.width + x;
    const tool = zoneToolSelect.value as ZoneTool;
    if (tool === 'fill') {
      commitZoneIndices(floodFillIndices(session.world, tileIndex), tool);
      return;
    }
    if (tool === 'eyedropper') {
      commitZoneIndices([tileIndex], tool);
      return;
    }
    zoneStrokeActive = true;
    zoneStrokeStart = { x: position.x, y: position.y };
    zoneStrokeIndices.clear();
    const indices = tool === 'rectangle'
      ? rectangleIndices(session.world, position.x, position.y, position.x, position.y)
      : brushIndices(session.world, position.x, position.y, Number(zoneBrushSize.value));
    for (const index of indices) zoneStrokeIndices.add(index);
    zoneBrushPreview = [...zoneStrokeIndices];
    canvas.setPointerCapture(event.pointerId);
    syncRendererCustomization();
    return;
  }
  if (session.authoringTool === 'select') {
    const feature = hitAuthoredFeature(position.x, position.y);
    if (feature !== undefined) {
      beginAuthoredFeatureDrag(event, feature, position);
      return;
    }
    const markerRadius = Math.max(1.4, 10 / Math.max(1, camera.zoom));
    const settlement = [...session.world.settlements].reverse().find((candidate) => !candidate.isPrimary
      && candidate.hidden !== true
      && Math.hypot(position.x - (candidate.x + 0.5), position.y - (candidate.y + 0.5)) <= markerRadius);
    if (settlement !== undefined) {
      loadSettlementIntoForm(settlement.key);
      if (settlement.locked === true) {
        setAuthoringStatus(`${settlement.name} is locked. Unlock it before moving this community anchor.`, 'warning');
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('entity-dragging');
      dragPreview = { kind: 'settlement', key: settlement.key, x: settlement.x, y: settlement.y };
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      syncRendererCustomization();
      return;
    }
  }
  if (editMode) {
    const target = hitMovableObject(position.x, position.y);
    if (target !== null) {
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('entity-dragging');
      if (target.kind === 'image') {
        const placement = session.placedImages.find((item) => item.id === target.key);
        if (placement !== undefined) {
          draggedImageId = placement.id;
          draggedImageOriginal = placement;
          draggedImageHistorySnapshot = captureEditorSnapshot();
          draggedImageOffsetX = position.x - placement.x;
          draggedImageOffsetY = position.y - placement.y;
        }
      } else {
        const settlement = target.kind === 'settlement'
          ? session.world.settlements.find((item) => item.key === target.key)
          : undefined;
        dragPreview = {
          kind: target.kind,
          key: target.key,
          x: settlement?.x ?? position.x - 0.5,
          y: settlement?.y ?? position.y - 0.5,
        };
      }
      syncRendererCustomization();
      return;
    }
  }

  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
}

function handleCanvasPointerMove(event: PointerEvent): void {
  const position = worldPositionFromPointer(event);
  const tile = session.world.getTile(Math.floor(position.x), Math.floor(position.y));
  if (tile === undefined) {
    cursorReadout.textContent = 'x — · y —';
  } else {
    const index = tile.y * session.world.width + tile.x;
    const anchor = session.world.anchors.find((candidate) => candidate.tileIndex === index);
    const story = session.world.storyObjects.find((candidate) => candidate.tileIndex === index);
    const road = tile.roadId === null ? undefined : session.world.roads[tile.roadId];
    const block = tile.blockId === null ? undefined : session.world.blocks[tile.blockId];
    const customImage = [...session.placedImages].reverse().find((placement) => pointInsidePlacement(position.x, position.y, placement));
    const island = tile.islandId === null ? undefined : session.world.islands[tile.islandId];
    const settlement = tile.settlementId === null ? undefined : session.world.settlements[tile.settlementId];
    cursorReadout.textContent = [
      `x ${tile.x}`, `y ${tile.y}`, `h ${tile.elevation.toFixed(3)}`,
      tile.river ? `river ${tile.riverWidth.toFixed(2)}w` : '',
      road === undefined ? '' : road.name,
      block === undefined ? '' : block.name,
      anchor === undefined ? '' : `anchor ${anchor.name}`,
      story === undefined ? '' : `story ${story.name}`,
      customImage === undefined ? '' : `image ${customImage.name}`,
      island === undefined ? '' : `island ${island.name}`,
      settlement === undefined ? '' : `community ${settlement.name}`,
      tile.zoneType ?? '', tile.terrain,
    ].filter((value) => value.length > 0).join(' · ');
  }

  if (zoneEditMode) {
    const tool = zoneToolSelect.value as ZoneTool;
    if (zoneStrokeActive && zoneStrokeStart !== null) {
      const indices = tool === 'rectangle'
        ? rectangleIndices(session.world, zoneStrokeStart.x, zoneStrokeStart.y, position.x, position.y)
        : brushIndices(session.world, position.x, position.y, Number(zoneBrushSize.value));
      if (tool === 'rectangle') zoneStrokeIndices = new Set(indices);
      else for (const index of indices) zoneStrokeIndices.add(index);
      zoneBrushPreview = [...zoneStrokeIndices];
    } else if (tool !== 'fill' && tool !== 'eyedropper') {
      zoneBrushPreview = brushIndices(session.world, position.x, position.y, Number(zoneBrushSize.value));
    } else {
      const x = Math.floor(position.x);
      const y = Math.floor(position.y);
      zoneBrushPreview = session.world.contains(x, y) ? [y * session.world.width + x] : [];
    }
    syncRendererCustomization();
    return;
  }

  if (session.authoringTool === 'terrain-brush') {
    const indices = brushIndices(session.world, position.x, position.y, Number(authoringTerrainSize.value));
    if (session.authoringTerrainStrokeActive) {
      for (const index of indices) session.authoringTerrainStroke.add(index);
      zoneBrushPreview = [...session.authoringTerrainStroke];
    } else {
      zoneBrushPreview = indices;
    }
    syncRendererCustomization();
    return;
  }

  if (session.authoredFeatureOriginal !== null && session.authoredFeaturePointerStart !== null) {
    pointerTravel += Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    const deltaX = position.x - session.authoredFeaturePointerStart.x;
    const deltaY = position.y - session.authoredFeaturePointerStart.y;
    const translated = {
      ...session.authoredFeatureOriginal,
      geometry: translateAuthoringGeometry(session.authoredFeatureOriginal.geometry, deltaX, deltaY),
      updatedAt: new Date().toISOString(),
    };
    session.authoringLayer = {
      ...session.authoringLayer,
      features: session.authoringLayer.features.map((feature) => feature.id === translated.id ? translated : feature),
    };
    syncRendererCustomization();
    return;
  }

  if (dragPreview !== null) {
    pointerTravel += Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if (dragPreview.kind === 'settlement') {
      const constrained = findNearestValidSettlementTile(session.world, dragPreview.key, position.x - 0.5, position.y - 0.5, 8);
      if (constrained !== undefined) {
        dragPreview = { ...dragPreview, x: constrained.x, y: constrained.y };
        canvas.classList.remove('entity-drag-invalid');
      } else {
        canvas.classList.add('entity-drag-invalid');
      }
    } else {
      dragPreview = { ...dragPreview, x: position.x - 0.5, y: position.y - 0.5 };
    }
    syncRendererCustomization();
    return;
  }
  if (draggedImageId !== null) {
    session.placedImages = session.placedImages.map((placement) => placement.id === draggedImageId
      ? { ...placement, x: position.x - draggedImageOffsetX, y: position.y - draggedImageOffsetY }
      : placement);
    syncRendererCustomization();
    return;
  }
  if (!dragging) return;
  pointerTravel += Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
  camera.pan(event.clientX - lastPointerX, event.clientY - lastPointerY);
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  requestRender();
}

function endPointerInteraction(event: PointerEvent, cancelled = false): void {
  const preview = dragPreview;
  const imageId = draggedImageId;
  dragPreview = null;
  draggedImageId = null;
  dragging = false;
  canvas.classList.remove('dragging', 'entity-dragging', 'entity-drag-invalid');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  if (cancelled && imageId !== null && draggedImageOriginal !== null) {
    session.placedImages = session.placedImages.map((placement) => placement.id === imageId ? draggedImageOriginal as PlacedImage : placement);
  }
  const originalImage = draggedImageOriginal;
  draggedImageOriginal = null;
  const imageHistorySnapshot = draggedImageHistorySnapshot;
  draggedImageHistorySnapshot = null;
  syncRendererCustomization();

  if (cancelled) return;
  if (preview?.kind === 'anchor') {
    commitAnchorMove(preview.key, preview.x, preview.y);
  } else if (preview?.kind === 'settlement') {
    commitSettlementMove(preview.key, preview.x, preview.y);
  } else if (preview?.kind === 'story') {
    const story = session.world.storyObjects.find((item) => item.key === preview.key);
    if (story !== undefined) commitStoryMove(story.key, story.id, preview.x, preview.y);
  } else if (imageId !== null && originalImage !== null) {
    persistMapCustomization();
    assetLibrary.renderPlacements();
    updateStats(stats, session.world);
    if (imageHistorySnapshot !== null) recordHistory(imageHistorySnapshot, 'move map image');
    setStatus('Moved map image.', 'success');
  }
}

function endZoneStroke(event: PointerEvent, cancelled = false): void {
  if (!zoneStrokeActive) return;
  zoneStrokeActive = false;
  zoneStrokeStart = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  const indices = [...zoneStrokeIndices];
  zoneStrokeIndices.clear();
  zoneBrushPreview = [];
  syncRendererCustomization();
  if (!cancelled) commitZoneIndices(indices, zoneToolSelect.value as ZoneTool);
}

function handleCanvasPointerEnd(event: PointerEvent, cancelled: boolean): void {
  if (session.authoringTerrainStrokeActive) endAuthoringTerrainStroke(event, cancelled);
  else if (session.authoredFeatureOriginal !== null) endAuthoredFeatureDrag(event, cancelled);
  else if (zoneEditMode && zoneStrokeActive) endZoneStroke(event, cancelled);
  else endPointerInteraction(event, cancelled);
}

if (hasSessionResumeMarker() && readAutosavedProject() !== null) {
  void restoreAutosave(false).catch((error: unknown) => {
    setStatus(`The previous browser session could not be resumed: ${error instanceof Error ? error.message : String(error)}`, 'warning');
  });
}
}
