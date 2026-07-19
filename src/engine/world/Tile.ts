import type { ZoneType } from '../zoning/Zone';

export enum Biome {
  Ocean = 'ocean',
  Coast = 'coast',
  Lake = 'lake',
  Wetland = 'wetland',
  Lowland = 'lowland',
  LowlandForest = 'lowland-forest',
  Upland = 'upland',
  UplandForest = 'upland-forest',
  Mountain = 'mountain',
}

export enum TerrainType {
  DeepWater = 'deep-water',
  ShallowWater = 'shallow-water',
  Lake = 'lake',
  Beach = 'beach',
  RiverChannel = 'river-channel',
  Delta = 'delta',
  Floodplain = 'floodplain',
  Plain = 'plain',
  Forest = 'forest',
  Hill = 'hill',
  Mountain = 'mountain',
}

export enum WaterType {
  Land = 'land',
  Ocean = 'ocean',
  Lake = 'lake',
}

export enum RiverCourse {
  None = 'none',
  Upper = 'upper',
  Middle = 'middle',
  Lower = 'lower',
  Delta = 'delta',
}

export interface Tile {
  readonly x: number;
  readonly y: number;
  elevation: number;
  bedElevation: number;
  moisture: number;
  temperature: number;
  forestDensity: number;
  slope: number;
  biome: Biome;
  terrain: TerrainType;
  water: WaterType;
  waterDepth: number;
  coast: boolean;
  coastDistance: number;
  road: boolean;
  roadId: number | null;
  bridge: boolean;
  river: boolean;
  riverId: number | null;
  riverCourse: RiverCourse;
  riverWidth: number;
  riverDepth: number;
  discharge: number;
  flowTo: number;
  flowAccumulation: number;
  sediment: number;
  erosion: number;
  deposition: number;
  floodRisk: number;
  delta: boolean;
  roadDistance: number;
  accessibility: number;
  landValue: number;
  buildingId: number | null;
  vegetationId: number | null;
  blockId: number | null;
  zoneId: number | null;
  zoneType: ZoneType | null;
  /** Procedural zoning before manual authoring overrides. */
  generatedZoneType: ZoneType | null;
  /** Explicit authoring override. null can mean either no override or cleared zone; use hasZoneOverride. */
  zoneOverrideType: ZoneType | null;
  hasZoneOverride: boolean;
  zoneLocked: boolean;
  /** Physical connected land component assigned after terrain classification. */
  landmassId: number | null;
  /** Gameplay island entity. Tiny rocks may have a landmass but no island. */
  islandId: number | null;
  /** Nearest generated settlement within its influence radius. */
  settlementId: number | null;
}

export function createTile(x: number, y: number): Tile {
  return {
    x,
    y,
    elevation: 0,
    bedElevation: 0,
    moisture: 0,
    temperature: 0,
    forestDensity: 0,
    slope: 0,
    biome: Biome.Ocean,
    terrain: TerrainType.DeepWater,
    water: WaterType.Ocean,
    waterDepth: 0,
    coast: false,
    coastDistance: 0,
    road: false,
    roadId: null,
    bridge: false,
    river: false,
    riverId: null,
    riverCourse: RiverCourse.None,
    riverWidth: 0,
    riverDepth: 0,
    discharge: 0,
    flowTo: -1,
    flowAccumulation: 0,
    sediment: 0,
    erosion: 0,
    deposition: 0,
    floodRisk: 0,
    delta: false,
    roadDistance: -1,
    accessibility: 0,
    landValue: 0,
    buildingId: null,
    vegetationId: null,
    blockId: null,
    zoneId: null,
    zoneType: null,
    generatedZoneType: null,
    zoneOverrideType: null,
    hasZoneOverride: false,
    zoneLocked: false,
    landmassId: null,
    islandId: null,
    settlementId: null,
  };
}
