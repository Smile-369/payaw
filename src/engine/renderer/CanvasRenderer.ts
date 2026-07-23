import type { GridPoint } from '../blocks/Block';
import type { AuthoredMapFeature, AuthoringFeatureCategory, AuthoringRealityLayer } from '../../authoring/AuthoringLayer';
import { transformAuthoringGeometry } from '../../authoring/AuthoringGeometry';
import { AssetTargetCategory, EMPTY_RENDER_CUSTOMIZATION, type RenderCustomization, type RuntimeImageAsset } from '../../customization/Customization';
import { AnchorSource, AnchorType } from '../settlement/Anchor';
import { BuildingCondition, BuildingType } from '../buildings/Building';
import { RoadType } from '../infrastructure/Road';
import { PortType } from '../infrastructure/Port';
import { RiverCourse, WaterType } from '../world/Tile';
import { VegetationType } from '../vegetation/Vegetation';
import type { World } from '../world/World';
import { StoryObjectType } from '../../story/StoryObject';
import { NPCStatus } from '../npc/NPC';
import type { InfrastructureOperationalState, VenueOperationalState, WorldSimulationState } from '../simulation/SimulationTypes';
import { Camera } from './Camera';
import { LayerVisibility, RenderLayer } from './Layers';
import { SpatialGridIndex } from './SpatialGridIndex';
import {
  accessibilityColor,
  elevationColor,
  floodRiskColor,
  landValueColor,
  moistureColor,
  temperatureColor,
  terrainColor,
  zoneColor,
  type Rgba,
} from './Palette';

export type RasterCacheLayer =
  | 'terrainCanvas'
  | 'elevationCanvas'
  | 'moistureCanvas'
  | 'temperatureCanvas'
  | 'accessibilityCanvas'
  | 'landValueCanvas'
  | 'zonesCanvas'
  | 'generatedZonesCanvas'
  | 'zoneOverridesCanvas'
  | 'floodplainCanvas';

export const ALL_RASTER_CACHE_LAYERS: readonly RasterCacheLayer[] = [
  'terrainCanvas', 'elevationCanvas', 'moistureCanvas', 'temperatureCanvas',
  'accessibilityCanvas', 'landValueCanvas', 'zonesCanvas', 'generatedZonesCanvas',
  'zoneOverridesCanvas', 'floodplainCanvas',
];

export function rasterCacheLayersForStage(stageId: string): readonly RasterCacheLayer[] {
  switch (stageId) {
    case 'place-naming':
    case 'buildings':
    case 'vegetation':
    case 'story-layer':
      return [];
    case 'zone-overrides':
      return ['zonesCanvas', 'zoneOverridesCanvas'];
    case 'zoning':
      return ['zonesCanvas', 'generatedZonesCanvas', 'zoneOverridesCanvas'];
    case 'land-value':
    case 'blocks':
      return ['landValueCanvas', 'zonesCanvas', 'generatedZonesCanvas', 'zoneOverridesCanvas'];
    case 'accessibility':
    case 'ports':
    case 'bridges':
    case 'road-network':
    case 'anchor-placement':
    case 'settlements':
    case 'islands':
    case 'landmasses':
      return ['accessibilityCanvas', 'landValueCanvas', 'zonesCanvas', 'generatedZonesCanvas', 'zoneOverridesCanvas'];
    default:
      return ALL_RASTER_CACHE_LAYERS;
  }
}

export interface RendererDiagnostics {
  readonly cacheBuildMs: number;
  readonly lastRenderMs: number;
  readonly visibleBuildings: number;
  readonly visibleVegetation: number;
}

interface CachedWorldLayers {
  readonly cacheKey: string;
  readonly width: number;
  readonly height: number;
  readonly terrainCanvas: HTMLCanvasElement;
  readonly elevationCanvas: HTMLCanvasElement;
  readonly moistureCanvas: HTMLCanvasElement;
  readonly temperatureCanvas: HTMLCanvasElement;
  readonly accessibilityCanvas: HTMLCanvasElement;
  readonly landValueCanvas: HTMLCanvasElement;
  readonly zonesCanvas: HTMLCanvasElement;
  readonly generatedZonesCanvas: HTMLCanvasElement;
  readonly zoneOverridesCanvas: HTMLCanvasElement;
  readonly floodplainCanvas: HTMLCanvasElement;
}

export interface ImageExportOptions {
  readonly pixelsPerTile: number;
  readonly padding: number;
  readonly includeEditorOverlays?: boolean;
  readonly hiddenLayers?: readonly RenderLayer[];
}

interface LabelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface WorldBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stableLabelSample(id: number, salt: number): number {
  let value = (id + 1) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}

function pointInBounds(x: number, y: number, bounds: WorldBounds, margin = 0): boolean {
  return x >= bounds.left - margin
    && x <= bounds.right + margin
    && y >= bounds.top - margin
    && y <= bounds.bottom + margin;
}

function boundsOverlap(left: LabelBounds, right: LabelBounds): boolean {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

function normalizeReadableAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  if (normalized > Math.PI / 2) normalized -= Math.PI;
  if (normalized < -Math.PI / 2) normalized += Math.PI;
  return normalized;
}

function putColor(data: Uint8ClampedArray, pixelIndex: number, color: Rgba): void {
  const offset = pixelIndex * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = color[3];
}

function createLayerCanvas(world: World, colorForIndex: (index: number) => Rgba): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = world.width;
  canvas.height = world.height;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Unable to create an offscreen canvas context.');
  }

  const image = context.createImageData(world.width, world.height);
  for (let index = 0; index < world.tiles.length; index += 1) {
    putColor(image.data, index, colorForIndex(index));
  }
  context.putImageData(image, 0, 0);

  return canvas;
}

function traceLoop(context: CanvasRenderingContext2D, points: readonly GridPoint[]): void {
  const first = points[0];
  if (first === undefined) return;
  context.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (point !== undefined) context.lineTo(point.x, point.y);
  }
  context.closePath();
}

export class CanvasRenderer {
  public readonly layers = new LayerVisibility();

  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private cache?: CachedWorldLayers;
  private customization: RenderCustomization = EMPTY_RENDER_CUSTOMIZATION;
  private simulationState: WorldSimulationState | null = null;
  private assetDefinitionsReference: readonly RuntimeImageAsset[] = [];
  private readonly assetLookup = new Map<string, RuntimeImageAsset[]>();
  private readonly buildingIndex = new SpatialGridIndex(24);
  private readonly vegetationIndex = new SpatialGridIndex(24);
  private diagnostics: RendererDiagnostics = { cacheBuildMs: 0, lastRenderMs: 0, visibleBuildings: 0, visibleVegetation: 0 };

  public getDiagnostics(): RendererDiagnostics { return { ...this.diagnostics }; }

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (context === null) {
      throw new Error('Canvas 2D rendering is not available in this browser.');
    }

    this.context = context;
  }

  public setSimulationState(state: WorldSimulationState | null): void {
    this.simulationState = state;
  }

  public setCustomization(customization: RenderCustomization): void {
    this.customization = customization;
    if (this.assetDefinitionsReference !== customization.imageAssets) {
      this.assetDefinitionsReference = customization.imageAssets;
      this.assetLookup.clear();
      for (const asset of customization.imageAssets) {
        const targetType = asset.definition.targetType;
        if (targetType === null) continue;
        const key = `${asset.definition.targetCategory}:${targetType}`;
        const values = this.assetLookup.get(key) ?? [];
        values.push(asset);
        this.assetLookup.set(key, values);
      }
    }
  }

  public resize(viewport?: { readonly width: number; readonly height: number; readonly pixelRatio: number }): void {
    const devicePixelRatio = viewport?.pixelRatio ?? (window.devicePixelRatio || 1);
    const displayWidth = Math.max(1, Math.floor((viewport?.width ?? this.canvas.clientWidth) * devicePixelRatio));
    const displayHeight = Math.max(1, Math.floor((viewport?.height ?? this.canvas.clientHeight) * devicePixelRatio));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
  }

  public rebuildCache(
    world: World,
    invalidatedLayers: readonly RasterCacheLayer[] = ALL_RASTER_CACHE_LAYERS,
  ): void {
    const startedAt = performance.now();
    const previous = this.cache !== undefined
      && this.cache.width === world.width
      && this.cache.height === world.height
      ? this.cache
      : undefined;
    const invalidated = new Set(invalidatedLayers);
    const cached = <K extends RasterCacheLayer>(key: K, factory: () => HTMLCanvasElement): HTMLCanvasElement => {
      if (previous !== undefined && !invalidated.has(key)) return previous[key];
      return factory();
    };

    this.cache = {
      cacheKey: `${world.seed}::${world.metadata.generationVersion}`,
      width: world.width,
      height: world.height,
      terrainCanvas: cached('terrainCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Terrain renderer encountered an invalid tile index.');
        return terrainColor(tile.terrain);
      })),
      elevationCanvas: cached('elevationCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Elevation renderer encountered an invalid tile index.');
        return elevationColor(tile.elevation);
      })),
      moistureCanvas: cached('moistureCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Moisture renderer encountered an invalid tile index.');
        return moistureColor(tile.moisture);
      })),
      temperatureCanvas: cached('temperatureCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Temperature renderer encountered an invalid tile index.');
        return temperatureColor(tile.temperature);
      })),
      accessibilityCanvas: cached('accessibilityCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Accessibility renderer encountered an invalid tile index.');
        return accessibilityColor(tile.accessibility);
      })),
      landValueCanvas: cached('landValueCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Land-value renderer encountered an invalid tile index.');
        return landValueColor(tile.landValue);
      })),
      zonesCanvas: cached('zonesCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Zone renderer encountered an invalid tile index.');
        return zoneColor(tile.zoneType);
      })),
      generatedZonesCanvas: cached('generatedZonesCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Generated-zone renderer encountered an invalid tile index.');
        return zoneColor(tile.generatedZoneType);
      })),
      zoneOverridesCanvas: cached('zoneOverridesCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined || !tile.hasZoneOverride) return [0, 0, 0, 0];
        if (tile.zoneOverrideType === null) return [56, 52, 48, tile.zoneLocked ? 255 : 215];
        const color = zoneColor(tile.zoneOverrideType);
        return [color[0], color[1], color[2], tile.zoneLocked ? 255 : 220];
      })),
      floodplainCanvas: cached('floodplainCanvas', () => createLayerCanvas(world, (index) => {
        const tile = world.tiles[index];
        if (tile === undefined) throw new Error('Floodplain renderer encountered an invalid tile index.');
        return floodRiskColor(tile.floodRisk);
      })),
    };

    this.buildingIndex.clear();
    for (const building of world.buildings) {
      const tile = world.tiles[building.tileIndices[0] ?? -1];
      if (tile !== undefined) this.buildingIndex.insert(building.id, tile.x, tile.y);
    }
    this.vegetationIndex.clear();
    for (const plant of world.vegetation) this.vegetationIndex.insert(plant.id, plant.x, plant.y);
    this.diagnostics = { ...this.diagnostics, cacheBuildMs: performance.now() - startedAt };
  }

  public render(
    world: World,
    camera: Camera,
    viewport?: { readonly width: number; readonly height: number; readonly pixelRatio: number },
  ): void {
    const renderStartedAt = performance.now();
    this.resize(viewport);

    const expectedCacheKey = `${world.seed}::${world.metadata.generationVersion}`;
    if (
      this.cache === undefined
      || this.cache.cacheKey !== expectedCacheKey
      || this.cache.width !== world.width
      || this.cache.height !== world.height
    ) {
      this.rebuildCache(world);
    }

    const cache = this.cache;
    if (cache === undefined) throw new Error('Renderer cache could not be initialized.');

    const devicePixelRatio = viewport?.pixelRatio ?? (window.devicePixelRatio || 1);
    const viewportWidth = viewport?.width ?? this.canvas.width / devicePixelRatio;
    const viewportHeight = viewport?.height ?? this.canvas.height / devicePixelRatio;

    this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    this.context.fillStyle = '#31566f';
    this.context.fillRect(0, 0, viewportWidth, viewportHeight);
    this.context.imageSmoothingEnabled = false;

    const visibleBounds: WorldBounds = {
      left: -camera.x / camera.zoom,
      top: -camera.y / camera.zoom,
      right: (viewportWidth - camera.x) / camera.zoom,
      bottom: (viewportHeight - camera.y) / camera.zoom,
    };

    this.context.save();
    this.context.translate(camera.x, camera.y);
    this.context.scale(camera.zoom, camera.zoom);

    const baseVisible = this.layers.isVisible(RenderLayer.Terrain);
    if (baseVisible) this.drawRaster(cache.terrainCanvas, 1);
    if (this.layers.isVisible(RenderLayer.Elevation)) this.drawRaster(cache.elevationCanvas, baseVisible ? 0.74 : 1);
    if (this.layers.isVisible(RenderLayer.Moisture)) this.drawRaster(cache.moistureCanvas, baseVisible ? 0.74 : 1);
    if (this.layers.isVisible(RenderLayer.Temperature)) this.drawRaster(cache.temperatureCanvas, baseVisible ? 0.74 : 1);
    if (this.layers.isVisible(RenderLayer.Accessibility)) this.drawRaster(cache.accessibilityCanvas, baseVisible ? 0.76 : 1);
    if (this.layers.isVisible(RenderLayer.LandValue)) this.drawRaster(cache.landValueCanvas, baseVisible ? 0.78 : 1);
    if (this.layers.isVisible(RenderLayer.Zones)) {
      const zoneCanvas = this.customization.zoneDisplayMode === 'generated'
        ? cache.generatedZonesCanvas
        : this.customization.zoneDisplayMode === 'overrides' ? cache.zoneOverridesCanvas : cache.zonesCanvas;
      this.drawRaster(zoneCanvas, baseVisible ? 0.62 : 1);
      this.drawZoneBrushPreview(world);
    }
    if (this.layers.isVisible(RenderLayer.Floodplains)) this.drawRaster(cache.floodplainCanvas, 1);
    if (this.layers.isVisible(RenderLayer.Rivers)) this.drawRivers(world);
    if (this.layers.isVisible(RenderLayer.Islands)) this.drawIslandBoundaries(world);
    if (this.layers.isVisible(RenderLayer.Blocks)) this.drawBlockGeometry(world, camera.zoom);
    if (this.layers.isVisible(RenderLayer.Roads)) this.drawRoadGeometry(world);
    if (this.layers.isVisible(RenderLayer.Bridges)) this.drawBridgeGeometry(world);
    if (this.layers.isVisible(RenderLayer.Ports)) this.drawPorts(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.Bridges) || this.layers.isVisible(RenderLayer.Ports)) this.drawInfrastructureAssets(world);
    if (this.layers.isVisible(RenderLayer.Buildings)) this.drawBuildings(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.Vegetation)) this.drawVegetation(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.CustomImages)) this.drawPlacedImages(visibleBounds);
    if (this.layers.isVisible(RenderLayer.Authoring)) this.drawAuthoringFeatures('normal', camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.HiddenPayaw)) this.drawAuthoringFeatures('hidden-payaw', camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.SettlementActivity)) this.drawSettlementActivity(world, visibleBounds);
    if (this.layers.isVisible(RenderLayer.LiveInfrastructure)) this.drawLiveInfrastructure(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.VenueStatus)) this.drawVenueStatus(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.SupernaturalActivity)) this.drawSupernaturalActivity(world, camera.zoom, visibleBounds);

    const labelBounds: LabelBounds[] = [];
    if (this.layers.isVisible(RenderLayer.BridgeLabels)) this.drawBridgeLabels(world, camera.zoom, labelBounds, visibleBounds);
    if (this.layers.isVisible(RenderLayer.PortLabels)) this.drawPortLabels(world, camera.zoom, labelBounds, visibleBounds);
    if (this.layers.isVisible(RenderLayer.RoadLabels)) this.drawRoadLabels(world, camera.zoom, labelBounds, visibleBounds);
    if (this.layers.isVisible(RenderLayer.BlockLabels)) this.drawBlockLabels(world, camera.zoom, labelBounds, visibleBounds);
    if (this.layers.isVisible(RenderLayer.IslandLabels)) this.drawIslandLabels(world, camera.zoom, labelBounds, visibleBounds);
    if (this.layers.isVisible(RenderLayer.Settlements)) this.drawSettlements(world, camera.zoom, labelBounds, visibleBounds);

    if (this.layers.isVisible(RenderLayer.Anchors)) this.drawAnchors(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.Story)) this.drawStoryObjects(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.NPCs)) this.drawNPCs(world, camera.zoom, visibleBounds);
    if (this.layers.isVisible(RenderLayer.Travel)) this.drawTravelPath(world, camera.zoom);

    this.context.globalAlpha = 1;
    if (this.layers.isVisible(RenderLayer.Grid) && camera.zoom >= 5) this.drawGrid(world);
    this.context.restore();
    this.diagnostics = { ...this.diagnostics, lastRenderMs: performance.now() - renderStartedAt };
  }

  private renderExportCanvas(world: World, options: ImageExportOptions): HTMLCanvasElement {
    const pixelsPerTile = clamp(options.pixelsPerTile, 1, 16);
    const padding = Math.max(0, Math.floor(options.padding));
    const width = Math.ceil(world.width * pixelsPerTile + padding * 2);
    const height = Math.ceil(world.height * pixelsPerTile + padding * 2);
    if (width * height > 120_000_000) {
      throw new Error('The requested PNG is too large for a browser canvas. Choose a lower export scale.');
    }

    const target = document.createElement('canvas');
    const targetRenderer = new CanvasRenderer(target);
    targetRenderer.layers.copyFrom(this.layers);
    for (const layer of options.hiddenLayers ?? []) targetRenderer.layers.setVisible(layer, false);
    targetRenderer.setSimulationState(this.simulationState);
    targetRenderer.setCustomization({
      ...this.customization,
      editMode: options.includeEditorOverlays === true && this.customization.editMode,
      dragPreview: null,
      zoneBrushPreview: [],
    });
    targetRenderer.rebuildCache(world);
    const exportCamera = new Camera();
    exportCamera.zoom = pixelsPerTile;
    exportCamera.x = padding;
    exportCamera.y = padding;
    targetRenderer.render(world, exportCamera, { width, height, pixelRatio: 1 });
    return target;
  }

  public async exportPng(world: World, options: ImageExportOptions): Promise<Blob> {
    const target = this.renderExportCanvas(world, options);
    return await new Promise<Blob>((resolve, reject) => {
      target.toBlob((blob) => {
        if (blob === null) reject(new Error('The browser could not encode the map as PNG.'));
        else resolve(blob);
      }, 'image/png');
    });
  }

  public exportDataUrl(world: World, options: ImageExportOptions): string {
    return this.renderExportCanvas(world, options).toDataURL('image/png');
  }

  private drawRaster(canvas: HTMLCanvasElement, alpha: number): void {
    this.context.globalAlpha = alpha;
    this.context.drawImage(canvas, 0, 0);
    this.context.globalAlpha = 1;
  }

  private drawRivers(world: World): void {
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';

    for (const river of world.rivers) {
      for (let offset = 0; offset < river.centerline.length - 1; offset += 1) {
        const current = river.centerline[offset];
        const next = river.centerline[offset + 1];
        if (current === undefined || next === undefined) continue;
        this.context.strokeStyle = current.course === RiverCourse.Upper
          ? 'rgba(68, 151, 189, 0.98)'
          : current.course === RiverCourse.Middle
            ? 'rgba(46, 132, 178, 0.98)'
            : 'rgba(34, 116, 164, 0.98)';
        this.context.lineWidth = Math.max(0.38, current.width * 0.34);
        this.context.beginPath();
        this.context.moveTo(current.x, current.y);
        this.context.lineTo(next.x, next.y);
        this.context.stroke();
      }

      this.context.strokeStyle = 'rgba(55, 132, 157, 0.82)';
      for (const distributary of river.distributaries) {
        this.context.beginPath();
        let started = false;
        for (const tileIndex of distributary) {
          const tile = world.tiles[tileIndex];
          if (tile === undefined) continue;
          if (!started) {
            this.context.moveTo(tile.x + 0.5, tile.y + 0.5);
            started = true;
          } else {
            this.context.lineTo(tile.x + 0.5, tile.y + 0.5);
          }
        }
        this.context.lineWidth = Math.max(0.3, river.maximumWidth * 0.1);
        if (started) this.context.stroke();
      }
    }
  }


  private drawIslandBoundaries(world: World): void {
    this.context.lineWidth = 0.22;
    this.context.strokeStyle = 'rgba(242, 220, 158, 0.72)';
    this.context.beginPath();
    for (const island of world.islands) {
      const landmass = world.landmasses[island.landmassId];
      if (landmass === undefined) continue;
      for (const index of landmass.coastlineTileIndices) {
        const tile = world.tiles[index];
        if (tile === undefined) continue;
        const x = tile.x;
        const y = tile.y;
        const top = world.getTile(x, y - 1);
        const right = world.getTile(x + 1, y);
        const bottom = world.getTile(x, y + 1);
        const left = world.getTile(x - 1, y);
        if (top === undefined || top.water !== WaterType.Land) { this.context.moveTo(x, y); this.context.lineTo(x + 1, y); }
        if (right === undefined || right.water !== WaterType.Land) { this.context.moveTo(x + 1, y); this.context.lineTo(x + 1, y + 1); }
        if (bottom === undefined || bottom.water !== WaterType.Land) { this.context.moveTo(x + 1, y + 1); this.context.lineTo(x, y + 1); }
        if (left === undefined || left.water !== WaterType.Land) { this.context.moveTo(x, y + 1); this.context.lineTo(x, y); }
      }
    }
    this.context.stroke();
  }

  private drawIslandLabels(world: World, zoom: number, occupied: LabelBounds[], visibleBounds: WorldBounds): void {
    if (zoom < 1.15) return;
    const fontSize = Math.max(3, 11 / Math.max(1, zoom));
    this.context.font = `700 ${fontSize}px ui-sans-serif`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    for (const island of world.islands) {
      const landmass = world.landmasses[island.landmassId];
      if (landmass === undefined || !pointInBounds(landmass.centroid.x, landmass.centroid.y, visibleBounds, 18)) continue;
      const text = island.name;
      const width = this.context.measureText(text).width + fontSize;
      const bounds: LabelBounds = {
        left: landmass.centroid.x - width * 0.5,
        right: landmass.centroid.x + width * 0.5,
        top: landmass.centroid.y - fontSize,
        bottom: landmass.centroid.y + fontSize,
      };
      if (occupied.some((item) => boundsOverlap(item, bounds))) continue;
      this.context.lineWidth = Math.max(0.18, 1.8 / Math.max(1, zoom));
      this.context.strokeStyle = 'rgba(8, 12, 10, 0.88)';
      this.context.fillStyle = 'rgba(255, 236, 190, 0.94)';
      this.context.strokeText(text, landmass.centroid.x, landmass.centroid.y);
      this.context.fillText(text, landmass.centroid.x, landmass.centroid.y);
      occupied.push(bounds);
    }
  }

  private drawSettlements(world: World, zoom: number, occupied: LabelBounds[], visibleBounds: WorldBounds): void {
    const radius = Math.max(0.75, 2.6 / Math.sqrt(Math.max(1, zoom)));
    const fontSize = Math.max(2.5, 8 / Math.max(1, zoom));
    this.context.font = `600 ${fontSize}px ui-sans-serif`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'bottom';
    for (const settlement of world.settlements) {
      if (settlement.hidden === true) continue;
      const preview = this.customization.dragPreview?.kind === 'settlement' && this.customization.dragPreview.key === settlement.key
        ? this.customization.dragPreview
        : null;
      const settlementX = preview?.x ?? settlement.x;
      const settlementY = preview?.y ?? settlement.y;
      if (!pointInBounds(settlementX, settlementY, visibleBounds, Math.max(12, settlement.influenceRadius))) continue;
      if (settlement.source === 'authored' && zoom >= 1.25) {
        this.context.save();
        this.context.beginPath();
        this.context.fillStyle = 'rgba(80, 184, 160, 0.08)';
        this.context.strokeStyle = settlement.locked === true ? 'rgba(244, 190, 92, 0.82)' : 'rgba(109, 206, 184, 0.45)';
        this.context.lineWidth = Math.max(0.2, 0.9 / Math.max(1, zoom));
        this.context.setLineDash([2 / Math.max(1, zoom), 1.6 / Math.max(1, zoom)]);
        this.context.arc(settlementX + 0.5, settlementY + 0.5, Math.max(2, settlement.influenceRadius), 0, Math.PI * 2);
        this.context.fill();
        this.context.stroke();
        this.context.restore();
      }
      this.context.beginPath();
      this.context.fillStyle = settlement.isPrimary
        ? 'rgba(255, 199, 92, 0.98)'
        : settlement.source === 'authored'
          ? 'rgba(118, 225, 190, 0.98)'
          : 'rgba(109, 206, 184, 0.96)';
      this.context.strokeStyle = preview === null ? 'rgba(248, 250, 239, 0.94)' : 'rgba(255, 222, 128, 1)';
      this.context.lineWidth = Math.max(0.25, (preview === null ? 0.9 : 1.6) / Math.max(1, zoom));
      if (settlement.locked === true) this.context.setLineDash([1.2 / Math.max(1, zoom), 0.8 / Math.max(1, zoom)]);
      this.context.arc(settlementX + 0.5, settlementY + 0.5, settlement.source === 'authored' ? radius * 1.25 : radius, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
      this.context.setLineDash([]);
      if (zoom < 2) continue;
      const typeLabel = settlement.kind?.replaceAll('-', ' ') ?? settlement.type.replaceAll('-', ' ');
      const displayName = settlement.source === 'authored' ? `${settlement.name} · ${typeLabel}` : settlement.name;
      const width = this.context.measureText(displayName).width + fontSize;
      const bounds: LabelBounds = {
        left: settlementX + 0.5 - width * 0.5,
        right: settlementX + 0.5 + width * 0.5,
        top: settlementY - radius - fontSize * 1.6,
        bottom: settlementY - radius,
      };
      if (occupied.some((item) => boundsOverlap(item, bounds))) continue;
      this.context.lineWidth = Math.max(0.16, 1.5 / Math.max(1, zoom));
      this.context.strokeStyle = 'rgba(10, 13, 11, 0.82)';
      this.context.fillStyle = 'rgba(236, 255, 248, 0.96)';
      this.context.strokeText(displayName, settlementX + 0.5, settlementY - radius - 0.4);
      this.context.fillText(displayName, settlementX + 0.5, settlementY - radius - 0.4);
      occupied.push(bounds);
    }
  }

  private drawBlockGeometry(world: World, zoom: number): void {
    this.context.strokeStyle = 'rgba(245, 238, 210, 0.72)';
    this.context.lineWidth = Math.max(0.18, 0.72 / Math.max(1, zoom));
    this.context.lineJoin = 'round';

    for (const block of world.blocks) {
      this.context.beginPath();
      traceLoop(this.context, block.boundary);
      for (const hole of block.holes) traceLoop(this.context, hole);
      this.context.stroke();
    }
  }

  private drawBlockLabels(world: World, zoom: number, occupied: LabelBounds[], visibleBounds: WorldBounds): void {
    const settings = this.customization.labels.block;
    if (zoom < settings.minZoom || settings.opacity <= 0 || settings.density <= 0) return;

    const fontSize = clamp(settings.fontSizePx, 4, 24) / Math.max(0.1, zoom);
    this.context.font = `600 ${fontSize}px ui-monospace`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';

    for (const block of world.blocks) {
      if (!pointInBounds(block.centroid.x, block.centroid.y, visibleBounds, 8)) continue;
      if (block.name.length === 0 || stableLabelSample(block.id, 0x2c1b3c6d) > settings.density) continue;
      const metrics = this.context.measureText(block.name);
      const width = metrics.width + fontSize * 0.8;
      const height = fontSize * 1.35;
      const bounds: LabelBounds = {
        left: block.centroid.x - width * 0.5,
        right: block.centroid.x + width * 0.5,
        top: block.centroid.y - height * 0.5,
        bottom: block.centroid.y + height * 0.5,
      };
      if (this.customization.labels.avoidCollisions && occupied.some((item) => boundsOverlap(item, bounds))) continue;

      this.context.globalAlpha = clamp(settings.opacity, 0, 1);
      if (settings.outline) {
        this.context.lineWidth = Math.max(0.16, 1.7 / Math.max(1, zoom));
        this.context.strokeStyle = 'rgba(25, 24, 20, 0.8)';
        this.context.strokeText(block.name, block.centroid.x, block.centroid.y);
      }
      this.context.fillStyle = 'rgba(248, 242, 218, 0.96)';
      this.context.fillText(block.name, block.centroid.x, block.centroid.y);
      this.context.globalAlpha = 1;
      occupied.push(bounds);
    }
  }

    private drawPorts(world: World, zoom: number, visibleBounds: WorldBounds): void {
    for (const port of world.ports) {
      if (!pointInBounds(port.position.x, port.position.y, visibleBounds, 8)) continue;
      const radius = Math.max(0.38, 1.5 / Math.max(1, zoom));
      this.context.save();
      this.context.translate(port.position.x, port.position.y);
      const angle = Math.atan2(port.waterPosition.y - port.position.y, port.waterPosition.x - port.position.x);
      this.context.rotate(angle);
      this.context.strokeStyle = 'rgba(10, 27, 34, 0.96)';
      this.context.fillStyle = port.type === PortType.IndustrialPort
        ? 'rgba(232, 170, 79, 0.98)'
        : port.type === PortType.FishingDock
          ? 'rgba(124, 216, 179, 0.98)'
          : 'rgba(116, 207, 244, 0.98)';
      this.context.lineWidth = Math.max(0.12, 1.4 / Math.max(1, zoom));
      this.context.fillRect(-radius * 0.65, -radius * 0.65, radius * 1.3, radius * 1.3);
      this.context.strokeRect(-radius * 0.65, -radius * 0.65, radius * 1.3, radius * 1.3);
      this.context.beginPath();
      this.context.moveTo(radius * 0.65, 0);
      this.context.lineTo(radius * 2.1, 0);
      this.context.stroke();
      this.context.restore();
    }
  }

  private drawPortLabels(world: World, zoom: number, occupied: LabelBounds[], visibleBounds: WorldBounds): void {
    if (zoom < 2.1) return;
    const fontSize = Math.max(2.2, 7.5 / Math.max(1, zoom));
    this.context.font = `700 ${fontSize}px ui-sans-serif`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'bottom';
    for (const port of world.ports) {
      if (!pointInBounds(port.position.x, port.position.y, visibleBounds, 12)) continue;
      const width = this.context.measureText(port.name).width + fontSize;
      const bounds: LabelBounds = {
        left: port.position.x - width * 0.5,
        right: port.position.x + width * 0.5,
        top: port.position.y - fontSize * 2.1,
        bottom: port.position.y - fontSize * 0.35,
      };
      if (this.customization.labels.avoidCollisions && occupied.some((item) => boundsOverlap(item, bounds))) continue;
      this.context.lineWidth = Math.max(0.14, 1.7 / Math.max(1, zoom));
      this.context.strokeStyle = 'rgba(7, 24, 31, 0.90)';
      this.context.fillStyle = 'rgba(215, 249, 255, 0.98)';
      this.context.strokeText(port.name, port.position.x, port.position.y - 0.9);
      this.context.fillText(port.name, port.position.x, port.position.y - 0.9);
      occupied.push(bounds);
    }
  }

    private drawBridgeGeometry(world: World): void {
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    for (const bridge of world.bridges) {
      const first = bridge.centerline[0];
      if (first === undefined) continue;
      this.context.beginPath();
      this.context.moveTo(first.x, first.y);
      for (let index = 1; index < bridge.centerline.length; index += 1) {
        const point = bridge.centerline[index];
        if (point !== undefined) this.context.lineTo(point.x, point.y);
      }
      this.context.strokeStyle = 'rgba(38, 43, 43, 0.96)';
      this.context.lineWidth = bridge.deckWidth + 0.55;
      this.context.stroke();
      this.context.strokeStyle = bridge.type === 'causeway'
        ? 'rgba(195, 177, 132, 0.98)'
        : bridge.type === 'footbridge'
          ? 'rgba(185, 151, 105, 0.98)'
          : 'rgba(224, 216, 192, 0.98)';
      this.context.lineWidth = bridge.deckWidth;
      this.context.stroke();
      if (bridge.supportPoints.length > 0) {
        this.context.fillStyle = 'rgba(55, 59, 58, 0.9)';
        for (const support of bridge.supportPoints) {
          this.context.beginPath();
          this.context.arc(support.x, support.y, Math.max(0.12, bridge.deckWidth * 0.16), 0, Math.PI * 2);
          this.context.fill();
        }
      }
    }
  }

  private drawBridgeLabels(world: World, zoom: number, occupied: LabelBounds[], visibleBounds: WorldBounds): void {
    if (zoom < 1.75) return;
    const fontSize = Math.max(2.4, 8 / Math.max(1, zoom));
    this.context.font = `700 ${fontSize}px ui-sans-serif`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    for (const bridge of world.bridges) {
      const midpointIndex = Math.floor(bridge.centerline.length * 0.5);
      const midpoint = bridge.centerline[midpointIndex];
      if (midpoint === undefined || !pointInBounds(midpoint.x, midpoint.y, visibleBounds, 16)) continue;
      const before = bridge.centerline[Math.max(0, midpointIndex - 2)] ?? midpoint;
      const after = bridge.centerline[Math.min(bridge.centerline.length - 1, midpointIndex + 2)] ?? midpoint;
      const angle = normalizeReadableAngle(Math.atan2(after.y - before.y, after.x - before.x));
      const width = this.context.measureText(bridge.name).width + fontSize;
      const height = fontSize * 1.5;
      const bounds: LabelBounds = {
        left: midpoint.x - width * 0.5,
        right: midpoint.x + width * 0.5,
        top: midpoint.y - height * 0.5,
        bottom: midpoint.y + height * 0.5,
      };
      if (this.customization.labels.avoidCollisions && occupied.some((item) => boundsOverlap(item, bounds))) continue;
      this.context.save();
      this.context.translate(midpoint.x, midpoint.y - 0.7);
      this.context.rotate(angle);
      this.context.lineWidth = Math.max(0.16, 1.8 / Math.max(1, zoom));
      this.context.strokeStyle = 'rgba(14, 18, 18, 0.88)';
      this.context.fillStyle = 'rgba(255, 244, 210, 0.98)';
      this.context.strokeText(bridge.name, 0, 0);
      this.context.fillText(bridge.name, 0, 0);
      this.context.restore();
      occupied.push(bounds);
    }
  }

  private drawRoadGeometry(world: World): void {
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';

    for (const road of world.roads) {
      if (road.bridgeId !== null && road.bridgeTiles.length > 0) continue;
      if (road.type === RoadType.Main) {
        this.context.strokeStyle = 'rgba(235, 210, 146, 0.98)';
        this.context.lineWidth = 1.35;
      } else if (road.type === RoadType.Secondary) {
        this.context.strokeStyle = 'rgba(190, 166, 112, 0.9)';
        this.context.lineWidth = 0.74;
      } else {
        this.context.strokeStyle = 'rgba(164, 144, 104, 0.82)';
        this.context.lineWidth = 0.52;
      }
      this.context.beginPath();

      let started = false;
      for (const index of road.path) {
        const tile = world.tiles[index];
        if (tile === undefined) continue;
        if (!started) {
          this.context.moveTo(tile.x + 0.5, tile.y + 0.5);
          started = true;
        } else {
          this.context.lineTo(tile.x + 0.5, tile.y + 0.5);
        }
      }
      if (started) this.context.stroke();

      if (road.bridgeTiles.length > 0) {
        this.context.fillStyle = 'rgba(246, 238, 207, 0.98)';
        for (const index of road.bridgeTiles) {
          const tile = world.tiles[index];
          if (tile !== undefined) this.context.fillRect(tile.x + 0.12, tile.y + 0.12, 0.76, 0.76);
        }
      }
    }
  }

  private drawRoadLabels(world: World, zoom: number, occupied: LabelBounds[], visibleBounds: WorldBounds): void {
    const settings = this.customization.labels.road;
    if (settings.opacity <= 0 || settings.density <= 0) return;

    const roads = [...world.roads].sort((left, right) => {
      const priority = (type: RoadType): number => type === RoadType.Main ? 0 : type === RoadType.Secondary ? 1 : 2;
      return priority(left.type) - priority(right.type) || left.id - right.id;
    });

    for (const road of roads) {
      if (road.bridgeId !== null) continue;
      const typeEnabled = road.type === RoadType.Main
        ? settings.showMain
        : road.type === RoadType.Secondary ? settings.showSecondary : settings.showLocal;
      const minimumZoom = road.type === RoadType.Main
        ? settings.mainMinZoom
        : road.type === RoadType.Secondary ? settings.secondaryMinZoom : settings.localMinZoom;
      if (!typeEnabled || zoom < minimumZoom || road.name.length === 0 || road.path.length === 0) continue;
      if (stableLabelSample(road.id, 0x71e19b4d) > settings.density) continue;

      const midpointIndex = Math.floor(road.path.length * 0.5);
      const midpoint = world.tiles[road.path[midpointIndex] ?? -1];
      if (midpoint === undefined || !pointInBounds(midpoint.x, midpoint.y, visibleBounds, 12)) continue;
      const before = world.tiles[road.path[Math.max(0, midpointIndex - 2)] ?? -1] ?? midpoint;
      const after = world.tiles[road.path[Math.min(road.path.length - 1, midpointIndex + 2)] ?? -1] ?? midpoint;
      const angle = settings.rotateAlongRoad
        ? normalizeReadableAngle(Math.atan2(after.y - before.y, after.x - before.x))
        : 0;
      const fontSize = clamp(settings.fontSizePx, 4, 24) / Math.max(0.1, zoom);
      this.context.font = `600 ${fontSize}px ui-sans-serif`;
      const metrics = this.context.measureText(road.name);
      const width = metrics.width + fontSize;
      const height = fontSize * 1.5;
      const halfWidth = width * 0.5;
      const halfHeight = height * 0.5;
      const cosine = Math.abs(Math.cos(angle));
      const sine = Math.abs(Math.sin(angle));
      const extentX = cosine * halfWidth + sine * halfHeight;
      const extentY = sine * halfWidth + cosine * halfHeight;
      const centerX = midpoint.x + 0.5;
      const centerY = midpoint.y - 0.42;
      const bounds: LabelBounds = {
        left: centerX - extentX,
        right: centerX + extentX,
        top: centerY - extentY,
        bottom: centerY + extentY,
      };
      if (this.customization.labels.avoidCollisions && occupied.some((item) => boundsOverlap(item, bounds))) continue;

      this.context.save();
      this.context.translate(centerX, centerY);
      this.context.rotate(angle);
      this.context.globalAlpha = clamp(settings.opacity, 0, 1);
      this.context.textAlign = 'center';
      this.context.textBaseline = 'bottom';
      if (settings.outline) {
        this.context.lineWidth = Math.max(0.14, 1.8 / Math.max(1, zoom));
        this.context.strokeStyle = 'rgba(24, 22, 17, 0.78)';
        this.context.strokeText(road.name, 0, 0);
      }
      this.context.fillStyle = 'rgba(255, 244, 210, 0.94)';
      this.context.fillText(road.name, 0, 0);
      this.context.restore();
      this.context.globalAlpha = 1;
      occupied.push(bounds);
    }
  }

  private drawBuildings(world: World, zoom: number, visibleBounds: WorldBounds): void {
    const typeColor: Readonly<Partial<Record<BuildingType, string>>> = {
      [BuildingType.Church]: '#e7d6b2',
      [BuildingType.School]: '#c98f6b',
      [BuildingType.Hospital]: '#d8d8d5',
      [BuildingType.PublicMarket]: '#d29b52',
      [BuildingType.BarangayHall]: '#bc6d61',
      [BuildingType.Warehouse]: '#7f7d78',
      [BuildingType.RiceField]: '#a6a85a',
      [BuildingType.BasketballCourt]: '#ba8158',
      [BuildingType.FishingVillage]: '#8e725b',
      [BuildingType.AirportTerminal]: '#a6aaae',
      [BuildingType.PortFacility]: '#777d82',
    };
    this.context.lineJoin = 'round';
    this.context.lineWidth = Math.max(0.12, 0.65 / Math.max(1, zoom));
    const visibleBuildingIds = this.buildingIndex.query(visibleBounds, 10);
    this.diagnostics = { ...this.diagnostics, visibleBuildings: visibleBuildingIds.length };
    for (const buildingId of visibleBuildingIds) {
      const building = world.buildings[buildingId];
      if (building === undefined) continue;
      const locationTile = world.tiles[building.tileIndices[0] ?? -1];
      if (locationTile !== undefined && !pointInBounds(locationTile.x, locationTile.y, visibleBounds, 10)) continue;
      const first = building.footprint[0];
      if (first === undefined) continue;
      const conditionAlpha = building.condition === BuildingCondition.Dilapidated
        ? 0.68
        : building.condition === BuildingCondition.Weathered
          ? 0.82
          : 0.96;
      this.context.beginPath();
      this.context.moveTo(first.x, first.y);
      for (let index = 1; index < building.footprint.length; index += 1) {
        const point = building.footprint[index];
        if (point !== undefined) this.context.lineTo(point.x, point.y);
      }
      this.context.closePath();
      const assets = this.assetsFor(AssetTargetCategory.Building, building.type);
      const asset = assets.length === 0 ? undefined : assets[building.id % assets.length];
      this.context.globalAlpha = conditionAlpha;
      this.context.strokeStyle = 'rgba(42, 31, 25, 0.9)';
      if (asset === undefined) {
        this.context.fillStyle = typeColor[building.type] ?? '#9c7962';
        this.context.fill();
      } else {
        let minimumX = Number.POSITIVE_INFINITY;
        let maximumX = Number.NEGATIVE_INFINITY;
        let minimumY = Number.POSITIVE_INFINITY;
        let maximumY = Number.NEGATIVE_INFINITY;
        for (const point of building.footprint) {
          minimumX = Math.min(minimumX, point.x);
          maximumX = Math.max(maximumX, point.x);
          minimumY = Math.min(minimumY, point.y);
          maximumY = Math.max(maximumY, point.y);
        }
        this.context.save();
        this.context.clip();
        this.context.drawImage(
          asset.image,
          minimumX,
          minimumY,
          Math.max(0.5, maximumX - minimumX),
          Math.max(0.5, maximumY - minimumY),
        );
        this.context.restore();
      }
      this.context.stroke();
      this.context.globalAlpha = 1;

      if (zoom >= 6) {
        this.context.fillStyle = 'rgba(252, 230, 170, 0.96)';
        this.context.beginPath();
        this.context.arc(building.entrance.x, building.entrance.y, 0.13, 0, Math.PI * 2);
        this.context.fill();
      }
    }
  }

  private assetsFor(category: AssetTargetCategory, targetType: string): RuntimeImageAsset[] {
    return this.assetLookup.get(`${category}:${targetType}`) ?? [];
  }

  private drawTargetAsset(asset: RuntimeImageAsset, x: number, y: number, width: number, height: number, opacity = 1): void {
    this.context.save();
    this.context.globalAlpha = opacity;
    this.context.drawImage(asset.image, x - width * 0.5, y - height * 0.5, width, height);
    this.context.restore();
  }

  private drawInfrastructureAssets(world: World): void {
    const drawAtRoadIndex = (roadId: number, pathIndex: number, target: string, size: number): void => {
      const road = world.roads[roadId];
      if (road === undefined || road.path.length === 0) return;
      const assets = this.assetsFor(AssetTargetCategory.Infrastructure, target);
      if (assets.length === 0) return;
      const tile = world.tiles[road.path[Math.max(0, Math.min(road.path.length - 1, pathIndex))] ?? -1];
      const asset = assets[(road.id + pathIndex) % assets.length];
      if (tile !== undefined && asset !== undefined) this.drawTargetAsset(asset, tile.x + 0.5, tile.y + 0.5, size, size, 0.94);
    };

    for (const road of world.roads) {
      drawAtRoadIndex(road.id, Math.floor(road.path.length / 2), `road-${road.type}`, 2.4);
      drawAtRoadIndex(road.id, 0, 'road-sign', 1.25);
      if (road.type !== RoadType.Local) {
        const lightAssets = this.assetsFor(AssetTargetCategory.Infrastructure, 'street-light');
        for (let offset = 10; offset < road.path.length; offset += 18) {
          const tile = world.tiles[road.path[offset] ?? -1];
          const asset = lightAssets[(road.id + offset) % Math.max(1, lightAssets.length)];
          if (tile !== undefined && asset !== undefined) this.drawTargetAsset(asset, tile.x + 0.5, tile.y + 0.5, 0.9, 1.35, 0.92);
        }
      }
      const poleAssets = this.assetsFor(AssetTargetCategory.Infrastructure, 'power-pole');
      for (let offset = 16; offset < road.path.length; offset += 30) {
        const tile = world.tiles[road.path[offset] ?? -1];
        const asset = poleAssets[(road.id + offset) % Math.max(1, poleAssets.length)];
        if (tile !== undefined && asset !== undefined) this.drawTargetAsset(asset, tile.x + 0.5, tile.y + 0.5, 0.9, 1.4, 0.9);
      }
      if (road.type === RoadType.Main) {
        drawAtRoadIndex(road.id, Math.floor(road.path.length * 0.35), 'bus-stop', 1.8);
        drawAtRoadIndex(road.id, Math.floor(road.path.length * 0.68), 'waiting-shed', 1.8);
      }
    }

    const bridgeAssets = this.assetsFor(AssetTargetCategory.Infrastructure, 'bridge');
    for (const bridge of world.bridges) {
      const asset = bridgeAssets[bridge.id % Math.max(1, bridgeAssets.length)];
      const midpoint = bridge.centerline[Math.floor(bridge.centerline.length * 0.5)];
      if (midpoint !== undefined && asset !== undefined) {
        this.drawTargetAsset(asset, midpoint.x, midpoint.y, Math.max(2, bridge.deckWidth * 2.4), Math.max(2, bridge.deckWidth * 1.8), 0.95);
      }
    }

    const portAssets = this.assetsFor(AssetTargetCategory.Infrastructure, 'port');
    for (const port of world.ports) {
      const asset = portAssets[port.id % Math.max(1, portAssets.length)];
      if (asset !== undefined) this.drawTargetAsset(asset, port.position.x, port.position.y, 2.8, 2.8, 0.96);
    }

    const benchAssets = this.assetsFor(AssetTargetCategory.Infrastructure, 'bench');
    const plaza = world.anchors.find((anchor) => anchor.type === AnchorType.TownPlaza);
    if (plaza !== undefined) {
      for (let index = 0; index < Math.min(4, benchAssets.length * 2); index += 1) {
        const asset = benchAssets[index % Math.max(1, benchAssets.length)];
        const angle = (Math.PI * 2 * index) / 4;
        if (asset !== undefined) this.drawTargetAsset(asset, plaza.x + 0.5 + Math.cos(angle) * 2.2, plaza.y + 0.5 + Math.sin(angle) * 2.2, 1.1, 0.8, 0.94);
      }
    }

    const fenceAssets = this.assetsFor(AssetTargetCategory.Infrastructure, 'fence');
    if (fenceAssets.length > 0) {
      for (const block of world.blocks.slice(0, 18)) {
        for (let offset = 0; offset < block.boundary.length; offset += 10) {
          const point = block.boundary[offset];
          const asset = fenceAssets[(block.id + offset) % fenceAssets.length];
          if (point !== undefined && asset !== undefined) this.drawTargetAsset(asset, point.x, point.y, 1.15, 0.7, 0.84);
        }
      }
    }
  }

  private drawZoneBrushPreview(world: World): void {
    if (this.customization.zoneBrushPreview.length === 0) return;
    this.context.save();
    this.context.fillStyle = 'rgba(255, 239, 158, 0.30)';
    this.context.strokeStyle = 'rgba(255, 239, 158, 0.92)';
    this.context.lineWidth = 0.16;
    for (const index of this.customization.zoneBrushPreview) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      this.context.fillRect(tile.x, tile.y, 1, 1);
      this.context.strokeRect(tile.x + 0.05, tile.y + 0.05, 0.9, 0.9);
    }
    this.context.restore();
  }

  private drawPlacedImages(visibleBounds: WorldBounds): void {
    if (this.customization.placedImages.length === 0) return;
    const assets = new Map(this.customization.imageAssets.map((asset) => [asset.definition.id, asset]));
    const placements = [...this.customization.placedImages].sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id));
    for (const placement of placements) {
      if (!pointInBounds(placement.x, placement.y, visibleBounds, Math.max(placement.width, placement.height))) continue;
      const asset = assets.get(placement.assetId);
      if (asset === undefined) continue;
      this.context.save();
      this.context.translate(placement.x, placement.y);
      this.context.rotate(placement.rotation);
      this.context.globalAlpha = placement.opacity;
      this.context.drawImage(
        asset.image,
        -placement.width * 0.5,
        -placement.height * 0.5,
        placement.width,
        placement.height,
      );
      if (this.customization.editMode) {
        this.context.globalAlpha = 0.9;
        this.context.strokeStyle = 'rgba(255, 221, 143, 0.95)';
        this.context.lineWidth = 0.28;
        this.context.setLineDash([0.8, 0.5]);
        this.context.strokeRect(
          -placement.width * 0.5,
          -placement.height * 0.5,
          placement.width,
          placement.height,
        );
        this.context.setLineDash([]);
      }
      this.context.restore();
    }
    this.context.globalAlpha = 1;
  }

  private drawVegetation(world: World, zoom: number, visibleBounds: WorldBounds): void {
    if (zoom < 1.25) return;
    const colors: Readonly<Record<VegetationType, string>> = {
      [VegetationType.CoconutPalm]: '#4f884e',
      [VegetationType.MangoTree]: '#426f3d',
      [VegetationType.Acacia]: '#527545',
      [VegetationType.Banana]: '#68a24b',
      [VegetationType.Bamboo]: '#5e8f54',
      [VegetationType.Mangrove]: '#386b54',
      [VegetationType.RiceCrop]: '#a5b85b',
      [VegetationType.Sugarcane]: '#849e4c',
      [VegetationType.ForestTree]: '#315f3d',
      [VegetationType.Scrub]: '#738257',
    };
    const visibleVegetationIds = this.vegetationIndex.query(visibleBounds, 2);
    this.diagnostics = { ...this.diagnostics, visibleVegetation: visibleVegetationIds.length };
    for (const vegetationId of visibleVegetationIds) {
      const plant = world.vegetation[vegetationId];
      if (plant === undefined || !pointInBounds(plant.x, plant.y, visibleBounds, 2)) continue;
      const assets = this.assetsFor(AssetTargetCategory.Vegetation, plant.type);
      const asset = assets.length === 0 ? undefined : assets[plant.id % assets.length];
      if (asset !== undefined) {
        const size = Math.max(0.55, 0.9 * plant.scale);
        this.drawTargetAsset(asset, plant.x, plant.y, size, size, 0.96);
        continue;
      }
      const radius = Math.max(0.09, 0.24 * plant.scale);
      this.context.fillStyle = colors[plant.type];
      this.context.beginPath();
      this.context.arc(plant.x, plant.y, radius, 0, Math.PI * 2);
      this.context.fill();
    }
  }

  private drawAnchors(world: World, zoom: number, visibleBounds: WorldBounds): void {
    const radius = Math.max(1.35, 4.5 / Math.sqrt(Math.max(1, zoom)));
    this.context.textAlign = 'center';
    this.context.textBaseline = 'bottom';
    this.context.font = `${Math.max(2.5, 11 / Math.max(1, zoom))}px ui-sans-serif`;

    for (const anchor of world.anchors) {
      const preview = this.customization.dragPreview?.kind === 'anchor' && this.customization.dragPreview.key === anchor.key
        ? this.customization.dragPreview
        : null;
      const anchorX = preview?.x ?? anchor.x;
      const anchorY = preview?.y ?? anchor.y;
      if (!pointInBounds(anchorX, anchorY, visibleBounds, 8)) continue;
      const assets = this.assetsFor(AssetTargetCategory.Anchor, anchor.type);
      const asset = assets.length === 0 ? undefined : assets[anchor.id % assets.length];
      if (asset !== undefined) {
        this.drawTargetAsset(asset, anchorX + 0.5, anchorY + 0.5, radius * 2.1, radius * 2.1, 0.98);
        if (zoom >= 2.5) {
          this.context.fillStyle = 'rgba(255, 250, 235, 0.96)';
          this.context.fillText(anchor.name, anchorX + 0.5, anchorY - radius - 0.8);
        }
        continue;
      }
      this.context.beginPath();
      this.context.fillStyle = anchor.source === AnchorSource.Custom
        ? 'rgba(226, 163, 72, 0.98)'
        : 'rgba(224, 89, 85, 0.96)';
      this.context.strokeStyle = 'rgba(255, 244, 220, 0.95)';
      this.context.lineWidth = Math.max(0.35, 1.1 / Math.max(1, zoom));
      this.context.arc(anchorX + 0.5, anchorY + 0.5, radius, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
      if (zoom >= 2.5) {
        this.context.fillStyle = 'rgba(255, 250, 235, 0.96)';
        this.context.fillText(anchor.name, anchorX + 0.5, anchorY - radius - 0.8);
      }
    }
  }

  private drawStoryObjects(world: World, zoom: number, visibleBounds: WorldBounds): void {
    const colors: Readonly<Record<StoryObjectType, string>> = {
      [StoryObjectType.BaleteTree]: 'rgba(128, 75, 151, 0.98)',
      [StoryObjectType.OldSchool]: 'rgba(105, 166, 189, 0.98)',
      [StoryObjectType.AbandonedCinema]: 'rgba(204, 93, 116, 0.98)',
      [StoryObjectType.OldCemetery]: 'rgba(174, 178, 163, 0.98)',
      [StoryObjectType.HauntedHouse]: 'rgba(180, 104, 93, 0.98)',
      [StoryObjectType.Shrine]: 'rgba(211, 171, 89, 0.98)',
      [StoryObjectType.Ruins]: 'rgba(137, 133, 125, 0.98)',
      [StoryObjectType.ForestHaunt]: 'rgba(78, 132, 93, 0.98)',
      [StoryObjectType.WatersideHaunt]: 'rgba(70, 137, 166, 0.98)',
      [StoryObjectType.Custom]: 'rgba(205, 126, 184, 0.98)',
    };
    const radius = Math.max(1.1, 3.8 / Math.sqrt(Math.max(1, zoom)));
    this.context.textAlign = 'center';
    this.context.textBaseline = 'bottom';
    this.context.font = `${Math.max(2.4, 10 / Math.max(1, zoom))}px ui-sans-serif`;

    for (const item of world.storyObjects) {
      const preview = this.customization.dragPreview?.kind === 'story' && this.customization.dragPreview.key === item.key
        ? this.customization.dragPreview
        : null;
      const itemX = preview?.x ?? item.x;
      const itemY = preview?.y ?? item.y;
      if (!pointInBounds(itemX, itemY, visibleBounds, 8)) continue;
      const assets = this.assetsFor(AssetTargetCategory.Story, item.type);
      const asset = assets.length === 0 ? undefined : assets[item.id % assets.length];
      if (asset !== undefined) {
        this.drawTargetAsset(asset, itemX + 0.5, itemY + 0.5, radius * 2.4, radius * 2.4, 0.98);
        if (zoom >= 2.25) {
          this.context.fillStyle = 'rgba(255, 245, 234, 0.98)';
          this.context.fillText(item.name, itemX + 0.5, itemY - radius - 0.75);
        }
        continue;
      }
      this.context.save();
      this.context.translate(itemX + 0.5, itemY + 0.5);
      this.context.rotate(Math.PI / 4);
      this.context.fillStyle = colors[item.type];
      this.context.strokeStyle = 'rgba(255, 240, 224, 0.95)';
      this.context.lineWidth = Math.max(0.3, 1 / Math.max(1, zoom));
      this.context.fillRect(-radius * 0.6, -radius * 0.6, radius * 1.2, radius * 1.2);
      this.context.strokeRect(-radius * 0.6, -radius * 0.6, radius * 1.2, radius * 1.2);
      this.context.restore();
      if (zoom >= 2.25) {
        this.context.fillStyle = 'rgba(255, 245, 234, 0.98)';
        this.context.fillText(item.name, itemX + 0.5, itemY - radius - 0.75);
      }
    }
  }


  private authoringColor(category: AuthoringFeatureCategory, requested: string | null): string {
    if (requested !== null) return requested;
    const colors: Readonly<Record<AuthoringFeatureCategory, string>> = {
      terrain: '#b5b06a',
      river: '#4ba4cf',
      road: '#d1aa72',
      building: '#e5d8bc',
      district: '#73c7b0',
      landmark: '#f2c05e',
      infrastructure: '#df855f',
      natural: '#6cb778',
      label: '#f2efe4',
      'hidden-payaw': '#bb79dd',
    };
    return colors[category];
  }

  private featureVisible(feature: AuthoredMapFeature, bounds: WorldBounds): boolean {
    const geometry = transformAuthoringGeometry(feature.geometry, feature.rotation, feature.scale);
    if (geometry.kind === 'point') return pointInBounds(geometry.point.x, geometry.point.y, bounds, 8);
    if (geometry.kind === 'circle') return !(
      geometry.center.x + geometry.radius < bounds.left
      || geometry.center.x - geometry.radius > bounds.right
      || geometry.center.y + geometry.radius < bounds.top
      || geometry.center.y - geometry.radius > bounds.bottom
    );
    return geometry.points.some((point) => pointInBounds(point.x, point.y, bounds, 12));
  }

  private drawAuthoredFeature(feature: AuthoredMapFeature, zoom: number, selected: boolean): void {
    const color = this.authoringColor(feature.category, feature.color);
    const lineWidth = Math.max(0.25, feature.lineWidth / Math.max(1, zoom));
    const geometry = transformAuthoringGeometry(feature.geometry, feature.rotation, feature.scale);
    this.context.save();
    this.context.globalAlpha = clamp(feature.opacity, 0.08, 1);
    this.context.strokeStyle = color;
    this.context.fillStyle = color;
    this.context.lineWidth = selected ? lineWidth * 1.8 : lineWidth;
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.setLineDash(feature.realityLayer === 'hidden-payaw' ? [2.4 / Math.max(1, zoom), 1.5 / Math.max(1, zoom)] : []);
    if (selected) {
      this.context.shadowColor = 'rgba(255,255,255,0.85)';
      this.context.shadowBlur = 5 / Math.max(1, zoom);
    }

    if (geometry.kind === 'point') {
      const radius = Math.max(0.9, 3.4 * feature.scale / Math.sqrt(Math.max(1, zoom)));
      this.context.translate(geometry.point.x + 0.5, geometry.point.y + 0.5);
      this.context.rotate(feature.rotation);
      this.context.beginPath();
      if (feature.category === 'building' || feature.category === 'landmark' || feature.category === 'infrastructure') {
        this.context.rect(-radius, -radius, radius * 2, radius * 2);
      } else {
        this.context.arc(0, 0, radius, 0, Math.PI * 2);
      }
      this.context.globalAlpha = clamp(feature.fillOpacity, 0.08, 1);
      this.context.fill();
      this.context.globalAlpha = clamp(feature.opacity, 0.08, 1);
      this.context.stroke();
    } else if (geometry.kind === 'circle') {
      this.context.beginPath();
      this.context.arc(geometry.center.x + 0.5, geometry.center.y + 0.5, Math.max(0.5, geometry.radius), 0, Math.PI * 2);
      this.context.globalAlpha = clamp(feature.fillOpacity, 0, 0.7);
      this.context.fill();
      this.context.globalAlpha = clamp(feature.opacity, 0.08, 1);
      this.context.stroke();
    } else if (geometry.points.length > 0) {
      const first = geometry.points[0];
      if (first !== undefined) {
        this.context.beginPath();
        this.context.moveTo(first.x + 0.5, first.y + 0.5);
        for (let index = 1; index < geometry.points.length; index += 1) {
          const point = geometry.points[index];
          if (point !== undefined) this.context.lineTo(point.x + 0.5, point.y + 0.5);
        }
        if (geometry.kind === 'polygon') this.context.closePath();
        if (geometry.kind === 'polygon') {
          this.context.globalAlpha = clamp(feature.fillOpacity, 0, 0.65);
          this.context.fill();
          this.context.globalAlpha = clamp(feature.opacity, 0.08, 1);
        }
        this.context.stroke();
      }
    }
    this.context.restore();

    if (zoom >= 2.3 && feature.name.trim().length > 0) {
      let x = 0;
      let y = 0;
      if (geometry.kind === 'point') { x = geometry.point.x; y = geometry.point.y; }
      else if (geometry.kind === 'circle') { x = geometry.center.x; y = geometry.center.y - geometry.radius; }
      else {
        const first = geometry.points[0];
        if (first === undefined) return;
        x = geometry.points.reduce((sum, point) => sum + point.x, 0) / geometry.points.length;
        y = geometry.points.reduce((sum, point) => sum + point.y, 0) / geometry.points.length;
      }
      const fontSize = Math.max(2.3, 8 / Math.max(1, zoom));
      this.context.save();
      this.context.font = `700 ${fontSize}px ui-sans-serif`;
      this.context.textAlign = 'center';
      this.context.textBaseline = 'bottom';
      this.context.lineWidth = Math.max(0.18, 1.5 / Math.max(1, zoom));
      this.context.strokeStyle = 'rgba(10,13,11,0.82)';
      this.context.fillStyle = color;
      this.context.strokeText(feature.name, x + 0.5, y - 0.8);
      this.context.fillText(feature.name, x + 0.5, y - 0.8);
      this.context.restore();
    }
  }

  private drawAuthoringFeatures(layer: AuthoringRealityLayer, zoom: number, visibleBounds: WorldBounds): void {
    for (const feature of this.customization.authoringLayer.features) {
      if (feature.realityLayer !== layer || feature.hidden || !this.featureVisible(feature, visibleBounds)) continue;
      this.drawAuthoredFeature(feature, zoom, feature.id === this.customization.activeAuthoringFeatureId);
    }
    if (layer !== 'normal' || this.customization.authoringDraftPoints.length === 0) return;
    const points = this.customization.authoringDraftPoints;
    const first = points[0];
    if (first === undefined) return;
    this.context.save();
    this.context.beginPath();
    this.context.moveTo(first.x + 0.5, first.y + 0.5);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      if (point !== undefined) this.context.lineTo(point.x + 0.5, point.y + 0.5);
    }
    this.context.strokeStyle = 'rgba(255, 220, 112, 0.98)';
    this.context.lineWidth = Math.max(0.4, 2.2 / Math.max(1, zoom));
    this.context.setLineDash([2 / Math.max(1, zoom), 1.1 / Math.max(1, zoom)]);
    this.context.stroke();
    for (const point of points) {
      this.context.beginPath();
      this.context.fillStyle = 'rgba(255, 220, 112, 1)';
      this.context.arc(point.x + 0.5, point.y + 0.5, Math.max(0.55, 2.2 / Math.sqrt(Math.max(1, zoom))), 0, Math.PI * 2);
      this.context.fill();
    }
    this.context.restore();
  }


  private operationalColor(status: InfrastructureOperationalState): string {
    if (status === 'restricted' || status === 'under-repair') return 'rgba(244, 180, 73, 0.96)';
    if (status === 'flooded') return 'rgba(76, 177, 229, 0.98)';
    if (status === 'damaged') return 'rgba(225, 89, 78, 0.98)';
    if (status === 'closed') return 'rgba(240, 82, 82, 0.98)';
    return 'rgba(101, 205, 147, 0.9)';
  }

  private venueColor(status: VenueOperationalState): string {
    if (status === 'open') return 'rgba(101, 205, 147, 0.92)';
    if (status === 'closing-soon') return 'rgba(244, 180, 73, 0.96)';
    if (status === 'emergency-only') return 'rgba(229, 122, 75, 0.98)';
    if (status === 'evacuated') return 'rgba(225, 89, 78, 0.98)';
    if (status === 'abandoned') return 'rgba(174, 112, 196, 0.98)';
    return 'rgba(143, 151, 151, 0.95)';
  }

  private traceTilePath(world: World, indices: readonly number[]): boolean {
    const firstIndex = indices[0];
    const first = firstIndex === undefined ? undefined : world.tiles[firstIndex];
    if (first === undefined) return false;
    this.context.beginPath();
    this.context.moveTo(first.x + 0.5, first.y + 0.5);
    for (let index = 1; index < indices.length; index += 1) {
      const tileIndex = indices[index];
      const tile = tileIndex === undefined ? undefined : world.tiles[tileIndex];
      if (tile !== undefined) this.context.lineTo(tile.x + 0.5, tile.y + 0.5);
    }
    return true;
  }

  private drawLiveInfrastructure(world: World, zoom: number, visibleBounds: WorldBounds): void {
    const state = this.simulationState?.infrastructure;
    if (state === undefined) return;

    // The regional view is an exception map, not a network-wide warning carpet.
    // Manual GM statuses are always authoritative. Weather-derived exceptions
    // only appear as the camera moves closer to the affected infrastructure.
    const manualRoadStatusById = state.manualRoadStatusById;
    const manualBridgeStatusById = state.manualBridgeStatusById;
    const manualPortStatusById = state.manualPortStatusById;
    const regionalOverview = zoom < 2.25;
    const localOverview = zoom < 3.2;

    this.context.save();
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';

    if (!regionalOverview) {
      for (const road of world.roads) {
        const manual = manualRoadStatusById[road.id];
        const status = manual ?? state.roadStatusById[road.id] ?? 'open';
        const derivedVisible = !localOverview && status !== 'open' && (road.type !== RoadType.Local || zoom >= 4.5);
        if (status === 'open' || (manual === undefined && !derivedVisible)) continue;
        if (!this.traceTilePath(world, [...road.path, ...road.bridgeTiles])) continue;
        this.context.globalAlpha = manual === undefined ? 0.46 : 0.98;
        this.context.strokeStyle = this.operationalColor(status);
        this.context.lineWidth = Math.max(0.65, (manual === undefined ? 2.6 : 3.8) / Math.max(1, zoom));
        this.context.setLineDash(status === 'restricted' || status === 'under-repair' ? [1.8, 1.15] : []);
        this.context.stroke();
      }
    }

    for (const bridge of world.bridges) {
      const manual = manualBridgeStatusById[bridge.id];
      const status = manual ?? state.bridgeStatusById[bridge.id] ?? 'open';
      if (status === 'open' || (manual === undefined && regionalOverview)) continue;
      if (!this.traceTilePath(world, bridge.deckTileIndices)) continue;
      this.context.globalAlpha = manual === undefined ? 0.56 : 1;
      this.context.strokeStyle = this.operationalColor(status);
      this.context.lineWidth = Math.max(0.95, (manual === undefined ? 3.4 : 4.7) / Math.max(1, zoom));
      this.context.setLineDash(status === 'restricted' || status === 'under-repair' ? [2.2, 1.25] : []);
      this.context.stroke();
    }

    this.context.setLineDash([]);
    for (const port of world.ports) {
      if (!pointInBounds(port.position.x, port.position.y, visibleBounds, 5)) continue;
      const manual = manualPortStatusById[port.id];
      const status = manual ?? state.portStatusById[port.id] ?? 'open';
      if (status === 'open' || (manual === undefined && regionalOverview)) continue;
      this.context.globalAlpha = manual === undefined ? 0.58 : 1;
      this.context.beginPath();
      this.context.strokeStyle = this.operationalColor(status);
      this.context.lineWidth = Math.max(0.7, (manual === undefined ? 2.2 : 3) / Math.max(1, zoom));
      this.context.arc(port.position.x + 0.5, port.position.y + 0.5, Math.max(1, 4.6 / Math.sqrt(Math.max(1, zoom))), 0, Math.PI * 2);
      this.context.stroke();
    }
    this.context.restore();
  }

  private drawVenueStatus(world: World, zoom: number, visibleBounds: WorldBounds): void {
    const state = this.simulationState?.venues;
    if (state === undefined) return;
    const radius = Math.max(0.7, 2.8 / Math.sqrt(Math.max(1, zoom)));
    this.context.save();
    this.context.textAlign = 'center';
    this.context.textBaseline = 'top';
    this.context.font = `700 ${Math.max(2.2, 8 / Math.max(1, zoom))}px ui-sans-serif`;
    for (const anchor of world.anchors) {
      if (!pointInBounds(anchor.x, anchor.y, visibleBounds, 5)) continue;
      const status = state.anchorStatusById[anchor.id] ?? 'open';
      this.context.beginPath();
      this.context.fillStyle = this.venueColor(status);
      this.context.strokeStyle = 'rgba(12, 16, 13, 0.88)';
      this.context.lineWidth = Math.max(0.2, 0.8 / Math.max(1, zoom));
      this.context.arc(anchor.x + 0.5 + radius * 0.85, anchor.y + 0.5 - radius * 0.85, radius * 0.62, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
      if (status !== 'open' && zoom >= 3.5) {
        this.context.fillStyle = this.venueColor(status);
        this.context.fillText(status.replace('-', ' '), anchor.x + 0.5, anchor.y + radius + 0.7);
      }
    }
    this.context.restore();
  }

  private drawSettlementActivity(world: World, visibleBounds: WorldBounds): void {
    const state = this.simulationState?.settlements;
    if (state === undefined) return;
    const alphaByLevel = { asleep: 0.06, quiet: 0.09, normal: 0.12, busy: 0.17, rush: 0.23 } as const;
    this.context.save();
    for (const settlement of world.settlements) {
      if (!pointInBounds(settlement.x, settlement.y, visibleBounds, settlement.influenceRadius)) continue;
      const level = state.levelBySettlementId[settlement.id] ?? 'normal';
      const alpha = alphaByLevel[level];
      const radius = Math.max(2, settlement.influenceRadius * (level === 'rush' ? 0.7 : 0.55));
      const gradient = this.context.createRadialGradient(settlement.x + 0.5, settlement.y + 0.5, 0, settlement.x + 0.5, settlement.y + 0.5, radius);
      gradient.addColorStop(0, `rgba(246, 190, 90, ${alpha})`);
      gradient.addColorStop(1, 'rgba(246, 190, 90, 0)');
      this.context.fillStyle = gradient;
      this.context.beginPath();
      this.context.arc(settlement.x + 0.5, settlement.y + 0.5, radius, 0, Math.PI * 2);
      this.context.fill();
    }
    this.context.restore();
  }

  private drawSupernaturalActivity(world: World, zoom: number, visibleBounds: WorldBounds): void {
    const state = this.simulationState?.supernatural;
    if (state === undefined || !state.active) return;
    const intensity = state.level === 'peak' ? 1 : state.level === 'manifesting' ? 0.72 : 0.42;
    this.context.save();
    this.context.setLineDash([1.5, 1.3]);
    for (const story of world.storyObjects) {
      if (!pointInBounds(story.x, story.y, visibleBounds, 12)) continue;
      const radius = Math.max(2, story.influenceRadius * (0.35 + intensity * 0.25));
      this.context.beginPath();
      this.context.strokeStyle = `rgba(181, 103, 211, ${0.25 + intensity * 0.45})`;
      this.context.lineWidth = Math.max(0.35, 1.5 / Math.max(1, zoom));
      this.context.arc(story.x + 0.5, story.y + 0.5, radius, 0, Math.PI * 2);
      this.context.stroke();
    }
    this.context.setLineDash([]);
    this.context.restore();
  }


  private drawNPCs(world: World, zoom: number, visibleBounds: WorldBounds): void {
    if (zoom < 1.7) return;
    const radius = Math.max(0.65, 2.5 / Math.sqrt(Math.max(1, zoom)));
    this.context.textAlign = 'center';
    this.context.textBaseline = 'bottom';
    this.context.font = `600 ${Math.max(2.2, 8 / Math.max(1, zoom))}px ui-sans-serif`;
    const colors: Readonly<Record<NPCStatus, string>> = {
      [NPCStatus.Alive]: 'rgba(117, 214, 171, 0.98)',
      [NPCStatus.Missing]: 'rgba(247, 195, 92, 0.98)',
      [NPCStatus.Injured]: 'rgba(238, 126, 100, 0.98)',
      [NPCStatus.Possessed]: 'rgba(191, 115, 221, 0.98)',
      [NPCStatus.Dead]: 'rgba(157, 165, 165, 0.98)',
    };
    for (const npc of world.npcs) {
      if (!pointInBounds(npc.x, npc.y, visibleBounds, 4)) continue;
      this.context.beginPath();
      this.context.fillStyle = colors[npc.status];
      this.context.strokeStyle = 'rgba(247, 249, 238, 0.95)';
      this.context.lineWidth = Math.max(0.2, 0.8 / Math.max(1, zoom));
      this.context.arc(npc.x + 0.5, npc.y + 0.5, radius, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
      if (zoom >= 4.2) {
        this.context.fillStyle = 'rgba(238, 255, 247, 0.96)';
        this.context.fillText(npc.name, npc.x + 0.5, npc.y - radius - 0.35);
      }
    }
  }


  private drawTravelPath(world: World, zoom: number): void {
    const overlay = this.customization.travelPath;
    if (overlay === null || overlay.segments.length === 0) return;
    this.context.save();
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    for (const segment of overlay.segments) {
      const firstIndex = segment.tileIndices[0];
      const first = firstIndex === undefined ? undefined : world.tiles[firstIndex];
      if (first === undefined) continue;
      this.context.beginPath();
      this.context.moveTo(first.x + 0.5, first.y + 0.5);
      for (let index = 1; index < segment.tileIndices.length; index += 1) {
        const tileIndex = segment.tileIndices[index];
        const tile = tileIndex === undefined ? undefined : world.tiles[tileIndex];
        if (tile !== undefined) this.context.lineTo(tile.x + 0.5, tile.y + 0.5);
      }
      this.context.lineWidth = Math.max(0.85, 3.2 / Math.max(1, zoom));
      if (segment.mode === 'walk') {
        this.context.strokeStyle = 'rgba(255, 247, 173, 0.96)';
        this.context.setLineDash([1.1, 1.1]);
      } else if (segment.mode === 'public-transport') {
        this.context.strokeStyle = 'rgba(191, 255, 173, 0.98)';
        this.context.setLineDash([3.4, 1.1]);
      } else {
        this.context.strokeStyle = 'rgba(255, 173, 104, 0.98)';
        this.context.setLineDash([]);
      }
      this.context.stroke();
    }
    this.context.setLineDash([]);
    this.context.restore();
  }

  private drawGrid(world: World): void {
    this.context.beginPath();
    this.context.lineWidth = 1 / 8;
    this.context.strokeStyle = 'rgba(255, 255, 255, 0.19)';

    for (let x = 0; x <= world.width; x += 1) {
      this.context.moveTo(x, 0);
      this.context.lineTo(x, world.height);
    }
    for (let y = 0; y <= world.height; y += 1) {
      this.context.moveTo(0, y);
      this.context.lineTo(world.width, y);
    }
    this.context.stroke();
  }
}
