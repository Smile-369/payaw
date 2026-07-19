import { TerrainType } from '../world/Tile';
import { ZoneType } from '../zoning/Zone';

export type Rgb = readonly [red: number, green: number, blue: number];
export type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

const TERRAIN_COLORS: Readonly<Record<TerrainType, Rgb>> = {
  [TerrainType.DeepWater]: [16, 37, 58],
  [TerrainType.ShallowWater]: [35, 78, 100],
  [TerrainType.Lake]: [45, 92, 108],
  [TerrainType.Beach]: [194, 177, 124],
  [TerrainType.RiverChannel]: [43, 112, 145],
  [TerrainType.Delta]: [91, 137, 100],
  [TerrainType.Floodplain]: [103, 133, 83],
  [TerrainType.Plain]: [105, 132, 78],
  [TerrainType.Forest]: [47, 88, 58],
  [TerrainType.Hill]: [78, 99, 66],
  [TerrainType.Mountain]: [91, 86, 77],
};

const ZONE_COLORS: Readonly<Record<ZoneType, Rgb>> = {
  [ZoneType.Commercial]: [218, 166, 74],
  [ZoneType.Residential]: [113, 159, 104],
  [ZoneType.Industrial]: [139, 118, 155],
  [ZoneType.Agricultural]: [160, 151, 73],
  [ZoneType.Institutional]: [78, 142, 180],
  [ZoneType.Government]: [186, 91, 84],
  [ZoneType.Forest]: [39, 100, 63],
  [ZoneType.Mixed]: [187, 117, 151],
};

function interpolateColor(start: Rgb, end: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return [
    Math.round(start[0] + (end[0] - start[0]) * t),
    Math.round(start[1] + (end[1] - start[1]) * t),
    Math.round(start[2] + (end[2] - start[2]) * t),
  ];
}

function threeStopColor(start: Rgb, middle: Rgb, end: Rgb, amount: number): Rgb {
  return amount <= 0.5
    ? interpolateColor(start, middle, amount * 2)
    : interpolateColor(middle, end, (amount - 0.5) * 2);
}

export function terrainColor(terrain: TerrainType): Rgba {
  const color = TERRAIN_COLORS[terrain];
  return [color[0], color[1], color[2], 255];
}

export function elevationColor(elevation: number): Rgba {
  const clamped = Math.min(1, Math.max(0, elevation));
  const shade = Math.round(clamped * 255);
  return [shade, shade, shade, 255];
}

export function moistureColor(moisture: number): Rgba {
  const color = interpolateColor([157, 112, 67], [40, 114, 151], moisture);
  return [color[0], color[1], color[2], 255];
}

export function temperatureColor(temperature: number): Rgba {
  const color = threeStopColor([52, 92, 156], [216, 198, 105], [178, 63, 47], temperature);
  return [color[0], color[1], color[2], 255];
}

export function accessibilityColor(accessibility: number): Rgba {
  const color = threeStopColor([68, 48, 92], [174, 123, 75], [117, 190, 126], accessibility);
  return [color[0], color[1], color[2], 255];
}

export function landValueColor(landValue: number): Rgba {
  const color = threeStopColor([41, 66, 91], [145, 126, 73], [232, 191, 91], landValue);
  return [color[0], color[1], color[2], 255];
}

export function zoneColor(zoneType: ZoneType | null): Rgba {
  if (zoneType === null) return [0, 0, 0, 0];
  const color = ZONE_COLORS[zoneType];
  return [color[0], color[1], color[2], 220];
}

export function floodRiskColor(floodRisk: number): Rgba {
  if (floodRisk <= 0.05) {
    return [0, 0, 0, 0];
  }

  const alpha = Math.round(Math.min(0.72, floodRisk * 0.72) * 255);
  return [105, 173, 178, alpha];
}
