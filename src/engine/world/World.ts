import type { Block } from '../blocks/Block';
import type { Building } from '../buildings/Building';
import type { GenerationConfig } from '../config/GenerationConfig';
import type { Landmass } from '../geography/Landmass';
import type { Island } from '../regional/Island';
import type { Settlement } from '../regional/Settlement';
import type { ClimatePreset, TerrainShape, TerrainSize, TownScale } from '../generation/GenerationOptions';
import type { River } from '../hydrology/River';
import type { Road } from '../infrastructure/Road';
import type { Bridge } from '../infrastructure/Bridge';
import type { Port } from '../infrastructure/Port';
import type { WaterRoute } from '../infrastructure/WaterRoute';
import type { Anchor } from '../settlement/Anchor';
import type { VegetationInstance } from '../vegetation/Vegetation';
import type { Zone } from '../zoning/Zone';
import type { StoryObject } from '../../story/StoryObject';
import { createTile, type Tile } from './Tile';

export interface WorldMetadata {
  readonly schemaVersion: number;
  readonly generationVersion: string;
  readonly terrainSize: TerrainSize;
  readonly townScale: TownScale;
  readonly terrainShape: TerrainShape;
  readonly climatePreset: ClimatePreset;
}

export interface WorldDiagnostics {
  readonly generatedAt: string;
  readonly stageTimingsMs: Readonly<Record<string, number>>;
}

export interface SerializedWorld {
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  readonly metadata: WorldMetadata;
  readonly landmasses: readonly Landmass[];
  readonly islands: readonly Island[];
  readonly settlements: readonly Settlement[];
  readonly rivers: readonly River[];
  readonly anchors: readonly Anchor[];
  readonly roads: readonly Road[];
  readonly bridges: readonly Bridge[];
  readonly ports: readonly Port[];
  readonly waterRoutes: readonly WaterRoute[];
  readonly blocks: readonly Block[];
  readonly zones: readonly Zone[];
  readonly buildings: readonly Building[];
  readonly vegetation: readonly VegetationInstance[];
  readonly storyObjects: readonly StoryObject[];
  readonly tiles: readonly Tile[];
}

export class World {
  public readonly seed: string;
  public readonly width: number;
  public readonly height: number;
  public readonly tiles: Tile[];
  public landmasses: Landmass[];
  public islands: Island[];
  public settlements: Settlement[];
  public rivers: River[];
  public anchors: Anchor[];
  public roads: Road[];
  public bridges: Bridge[];
  public ports: Port[];
  public waterRoutes: WaterRoute[];
  public blocks: Block[];
  public zones: Zone[];
  public buildings: Building[];
  public vegetation: VegetationInstance[];
  public storyObjects: StoryObject[];
  public readonly metadata: WorldMetadata;
  public diagnostics: WorldDiagnostics;

  public constructor(
    seed: string,
    config: GenerationConfig,
    profile: { readonly terrainSize: TerrainSize; readonly townScale: TownScale; readonly terrainShape: TerrainShape; readonly climatePreset: ClimatePreset },
  ) {
    this.seed = seed;
    this.width = config.world.width;
    this.height = config.world.height;
    this.tiles = new Array<Tile>(this.width * this.height);
    this.landmasses = [];
    this.islands = [];
    this.settlements = [];
    this.rivers = [];
    this.anchors = [];
    this.roads = [];
    this.bridges = [];
    this.ports = [];
    this.waterRoutes = [];
    this.blocks = [];
    this.zones = [];
    this.buildings = [];
    this.vegetation = [];
    this.storyObjects = [];

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.tiles[this.indexOf(x, y)] = createTile(x, y);
      }
    }

    this.metadata = {
      schemaVersion: 11,
      generationVersion: config.version,
      terrainSize: profile.terrainSize,
      townScale: profile.townScale,
      terrainShape: profile.terrainShape,
      climatePreset: profile.climatePreset,
    };
    this.diagnostics = {
      generatedAt: new Date(0).toISOString(),
      stageTimingsMs: {},
    };
  }

  public indexOf(x: number, y: number): number {
    if (!this.contains(x, y)) {
      throw new RangeError(`Tile coordinate (${x}, ${y}) is outside ${this.width}×${this.height}.`);
    }

    return y * this.width + x;
  }

  public contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  public getTile(x: number, y: number): Tile | undefined {
    if (!this.contains(x, y)) {
      return undefined;
    }

    return this.tiles[y * this.width + x];
  }

  public getTileOrThrow(x: number, y: number): Tile {
    const tile = this.getTile(x, y);
    if (tile === undefined) {
      throw new RangeError(`Tile coordinate (${x}, ${y}) is outside ${this.width}×${this.height}.`);
    }

    return tile;
  }

  public toJSON(): SerializedWorld {
    return {
      seed: this.seed,
      width: this.width,
      height: this.height,
      metadata: this.metadata,
      landmasses: this.landmasses,
      islands: this.islands,
      settlements: this.settlements,
      rivers: this.rivers,
      anchors: this.anchors,
      roads: this.roads,
      bridges: this.bridges,
      ports: this.ports,
      waterRoutes: this.waterRoutes,
      blocks: this.blocks,
      zones: this.zones,
      buildings: this.buildings,
      vegetation: this.vegetation,
      storyObjects: this.storyObjects,
      tiles: this.tiles,
    };
  }
}
