import type { AnchorConfig } from '../config/GenerationConfig';
import { clamp01 } from '../math/Scalar';
import { TerrainType, WaterType } from '../world/Tile';
import type { Tile } from '../world/Tile';
import type { World } from '../world/World';
import { ZoneType } from '../zoning/Zone';
import {
  ANCHOR_LABELS,
  AnchorProximityBand,
  AnchorRegionPreference,
  AnchorSource,
  AnchorTerrainPreference,
  AnchorType,
  type Anchor,
  type AnchorRuleSettings,
  type BuiltInAnchorOverride,
  type BuiltInAnchorType,
  type CustomAnchorDefinition,
} from './Anchor';

export interface AnchorPlacementContext {
  readonly world: World;
  readonly config: AnchorConfig;
  readonly placed: readonly Anchor[];
}

export interface AnchorRule {
  readonly key: string;
  readonly type: AnchorType;
  readonly name: string;
  readonly source: AnchorSource;
  readonly radius: number;
  readonly minimumDistance: number;
  readonly zoneType: ZoneType | null;
  readonly customRule: CustomAnchorDefinition | null;
  readonly builtInOverride: BuiltInAnchorOverride | null;
  score(tile: Tile, context: AnchorPlacementContext): number;
}

function distanceTo(tile: Tile, anchor: Anchor): number {
  return Math.hypot(tile.x - anchor.x, tile.y - anchor.y);
}

function getAnchor(placed: readonly Anchor[], type: AnchorType): Anchor | undefined {
  return placed.find((anchor) => anchor.type === type);
}

function closeness(distance: number, ideal: number, tolerance: number): number {
  return clamp01(1 - Math.abs(distance - ideal) / Math.max(1, tolerance));
}

function flatness(tile: Tile, maximumSlope: number): number {
  return clamp01(1 - tile.slope / Math.max(0.0001, maximumSlope));
}

function safeLand(tile: Tile, context: AnchorPlacementContext): number {
  if (tile.water !== WaterType.Land || tile.terrain === TerrainType.Mountain) {
    return Number.NEGATIVE_INFINITY;
  }
  if (tile.floodRisk > context.config.maximumFloodRisk) {
    return Number.NEGATIVE_INFINITY;
  }
  return 0;
}

function centerScore(tile: Tile, world: World): number {
  const centerX = world.width * 0.5;
  const centerY = world.height * 0.53;
  const distance = Math.hypot(tile.x - centerX, tile.y - centerY);
  return clamp01(1 - distance / Math.max(1, Math.min(world.width, world.height) * 0.43));
}

function regionScore(tile: Tile, world: World, targetX: number, targetY: number, spread = 0.42): number {
  const normalizedX = tile.x / Math.max(1, world.width - 1);
  const normalizedY = tile.y / Math.max(1, world.height - 1);
  return clamp01(1 - Math.hypot(normalizedX - targetX, normalizedY - targetY) / spread);
}

function coastAdjacency(tile: Tile, world: World): number {
  if (tile.water !== WaterType.Land) return Number.NEGATIVE_INFINITY;
  let oceanNeighbors = 0;
  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      const neighbor = world.getTile(tile.x + offsetX, tile.y + offsetY);
      if (neighbor?.water === WaterType.Ocean) oceanNeighbors += 1;
    }
  }
  return clamp01(oceanNeighbors / 8);
}

function localRelief(tile: Tile, world: World, radius: number): number {
  let minimum = tile.elevation;
  let maximum = tile.elevation;
  for (let y = tile.y - radius; y <= tile.y + radius; y += 1) {
    for (let x = tile.x - radius; x <= tile.x + radius; x += 1) {
      const sample = world.getTile(x, y);
      if (sample === undefined || sample.water !== WaterType.Land) return 1;
      minimum = Math.min(minimum, sample.elevation);
      maximum = Math.max(maximum, sample.elevation);
    }
  }
  return maximum - minimum;
}

function nearestRiverDistance(tile: Tile, world: World, radius = 10): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const sample = world.getTile(tile.x + offsetX, tile.y + offsetY);
      if (sample?.river !== true) continue;
      nearest = Math.min(nearest, Math.hypot(offsetX, offsetY));
    }
  }
  return nearest;
}

function scoreRegion(tile: Tile, world: World, preference: AnchorRegionPreference): number {
  switch (preference) {
    case AnchorRegionPreference.Anywhere:
      return 0.68;
    case AnchorRegionPreference.TownCenter:
      return centerScore(tile, world);
    case AnchorRegionPreference.North:
      return regionScore(tile, world, 0.5, 0.2, 0.52);
    case AnchorRegionPreference.South:
      return regionScore(tile, world, 0.5, 0.76, 0.52);
    case AnchorRegionPreference.East:
      return regionScore(tile, world, 0.79, 0.53, 0.5);
    case AnchorRegionPreference.West:
      return regionScore(tile, world, 0.2, 0.55, 0.5);
  }
}

function scoreTerrain(
  tile: Tile,
  context: AnchorPlacementContext,
  preference: AnchorTerrainPreference,
): number {
  if (!Number.isFinite(safeLand(tile, context)) || tile.river) return Number.NEGATIVE_INFINITY;

  switch (preference) {
    case AnchorTerrainPreference.SafeLand:
      return flatness(tile, context.config.maximumUrbanSlope * 1.35) * 0.45
        + (1 - tile.floodRisk) * 0.35
        + clamp01(tile.coastDistance / 8) * 0.2;
    case AnchorTerrainPreference.FlatLand:
      if (tile.slope > context.config.maximumUrbanSlope * 1.1) return Number.NEGATIVE_INFINITY;
      return flatness(tile, context.config.maximumUrbanSlope * 1.1) * 0.75
        + (1 - tile.floodRisk) * 0.25;
    case AnchorTerrainPreference.Coast:
      if (tile.coastDistance < 1 || tile.coastDistance > 9) return Number.NEGATIVE_INFINITY;
      return clamp01(1 - Math.abs(tile.coastDistance - 3) / 7) * 0.7
        + flatness(tile, context.config.maximumUrbanSlope * 1.5) * 0.3;
    case AnchorTerrainPreference.River: {
      const distance = nearestRiverDistance(tile, context.world);
      if (!Number.isFinite(distance) || distance < 1.5 || distance > 10) return Number.NEGATIVE_INFINITY;
      return closeness(distance, 4, 6) * 0.7
        + (1 - tile.floodRisk) * 0.18
        + flatness(tile, context.config.maximumUrbanSlope * 1.5) * 0.12;
    }
    case AnchorTerrainPreference.ForestEdge:
      if (tile.forestDensity < 0.28 || tile.forestDensity > 0.82) return Number.NEGATIVE_INFINITY;
      return closeness(tile.forestDensity, 0.58, 0.35) * 0.72
        + flatness(tile, context.config.maximumUrbanSlope * 1.6) * 0.28;
    case AnchorTerrainPreference.Farmland: {
      const normalizedX = tile.x / Math.max(1, context.world.width - 1);
      if (normalizedX > 0.58 || tile.slope > context.config.maximumUrbanSlope * 1.25) {
        return Number.NEGATIVE_INFINITY;
      }
      return (1 - normalizedX) * 0.3
        + tile.moisture * 0.25
        + flatness(tile, context.config.maximumUrbanSlope * 1.25) * 0.3
        + (1 - tile.forestDensity) * 0.15;
    }
    case AnchorTerrainPreference.HighGround:
      if (tile.elevation < 0.54 || tile.slope > context.config.maximumUrbanSlope * 1.8) {
        return Number.NEGATIVE_INFINITY;
      }
      return clamp01((tile.elevation - 0.52) / 0.32) * 0.58
        + (1 - tile.floodRisk) * 0.25
        + flatness(tile, context.config.maximumUrbanSlope * 1.8) * 0.17;
    case AnchorTerrainPreference.DryLand:
      if (tile.floodRisk > 0.28 || tile.coastDistance < 3) return Number.NEGATIVE_INFINITY;
      return (1 - tile.floodRisk) * 0.62
        + flatness(tile, context.config.maximumUrbanSlope * 1.45) * 0.25
        + clamp01(tile.coastDistance / 18) * 0.13;
  }
}

function proximityParameters(band: AnchorProximityBand): { ideal: number; tolerance: number } | null {
  switch (band) {
    case AnchorProximityBand.None:
      return null;
    case AnchorProximityBand.Adjacent:
      return { ideal: 6, tolerance: 7 };
    case AnchorProximityBand.Near:
      return { ideal: 15, tolerance: 13 };
    case AnchorProximityBand.Outskirts:
      return { ideal: 30, tolerance: 20 };
    case AnchorProximityBand.Far:
      return { ideal: 55, tolerance: 38 };
  }
}

function scoreSettings(tile: Tile, context: AnchorPlacementContext, settings: AnchorRuleSettings): number {
  const terrain = scoreTerrain(tile, context, settings.terrain);
  if (!Number.isFinite(terrain)) return Number.NEGATIVE_INFINITY;
  const region = scoreRegion(tile, context.world, settings.region);
  const proximity = proximityParameters(settings.proximity);
  if (proximity === null || settings.targetAnchor === null) {
    return terrain * 0.62 + region * 0.38;
  }
  const target = getAnchor(context.placed, settings.targetAnchor);
  if (target === undefined) return Number.NEGATIVE_INFINITY;
  const targetScore = closeness(distanceTo(tile, target), proximity.ideal, proximity.tolerance);
  return terrain * 0.5 + region * 0.28 + targetScore * 0.22;
}

export function createDefaultBuiltInAnchorDefinitions(config: AnchorConfig): readonly BuiltInAnchorOverride[] {
  return [
    {
      type: AnchorType.TownPlaza,
      name: ANCHOR_LABELS[AnchorType.TownPlaza],
      region: AnchorRegionPreference.TownCenter,
      terrain: AnchorTerrainPreference.SafeLand,
      targetAnchor: null,
      proximity: AnchorProximityBand.None,
      radius: config.plazaRadius,
      minimumDistance: config.minimumSpacing,
      zoneType: ZoneType.Government,
    },
    {
      type: AnchorType.Church,
      name: ANCHOR_LABELS[AnchorType.Church],
      region: AnchorRegionPreference.TownCenter,
      terrain: AnchorTerrainPreference.SafeLand,
      targetAnchor: AnchorType.TownPlaza,
      proximity: AnchorProximityBand.Adjacent,
      radius: config.churchRadius,
      minimumDistance: 6,
      zoneType: ZoneType.Institutional,
    },
    {
      type: AnchorType.Market,
      name: ANCHOR_LABELS[AnchorType.Market],
      region: AnchorRegionPreference.TownCenter,
      terrain: AnchorTerrainPreference.FlatLand,
      targetAnchor: AnchorType.TownPlaza,
      proximity: AnchorProximityBand.Near,
      radius: config.marketRadius,
      minimumDistance: 7,
      zoneType: ZoneType.Commercial,
    },
    {
      type: AnchorType.Hospital,
      name: ANCHOR_LABELS[AnchorType.Hospital],
      region: AnchorRegionPreference.TownCenter,
      terrain: AnchorTerrainPreference.DryLand,
      targetAnchor: AnchorType.TownPlaza,
      proximity: AnchorProximityBand.Outskirts,
      radius: config.hospitalRadius,
      minimumDistance: 10,
      zoneType: ZoneType.Institutional,
    },
    {
      type: AnchorType.School,
      name: ANCHOR_LABELS[AnchorType.School],
      region: AnchorRegionPreference.TownCenter,
      terrain: AnchorTerrainPreference.SafeLand,
      targetAnchor: AnchorType.TownPlaza,
      proximity: AnchorProximityBand.Outskirts,
      radius: config.schoolRadius,
      minimumDistance: 11,
      zoneType: ZoneType.Institutional,
    },
    {
      type: AnchorType.Port,
      name: ANCHOR_LABELS[AnchorType.Port],
      region: AnchorRegionPreference.South,
      terrain: AnchorTerrainPreference.Coast,
      targetAnchor: null,
      proximity: AnchorProximityBand.None,
      radius: config.portRadius,
      minimumDistance: 16,
      zoneType: ZoneType.Industrial,
    },
    {
      type: AnchorType.Airport,
      name: ANCHOR_LABELS[AnchorType.Airport],
      region: AnchorRegionPreference.East,
      terrain: AnchorTerrainPreference.FlatLand,
      targetAnchor: AnchorType.TownPlaza,
      proximity: AnchorProximityBand.Far,
      radius: config.airportRadius,
      minimumDistance: 22,
      zoneType: ZoneType.Industrial,
    },
    {
      type: AnchorType.RiceFields,
      name: ANCHOR_LABELS[AnchorType.RiceFields],
      region: AnchorRegionPreference.West,
      terrain: AnchorTerrainPreference.Farmland,
      targetAnchor: null,
      proximity: AnchorProximityBand.None,
      radius: config.riceFieldsRadius,
      minimumDistance: 18,
      zoneType: ZoneType.Agricultural,
    },
    {
      type: AnchorType.Hacienda,
      name: ANCHOR_LABELS[AnchorType.Hacienda],
      region: AnchorRegionPreference.West,
      terrain: AnchorTerrainPreference.HighGround,
      targetAnchor: AnchorType.RiceFields,
      proximity: AnchorProximityBand.Outskirts,
      radius: config.haciendaRadius,
      minimumDistance: 20,
      zoneType: ZoneType.Agricultural,
    },
  ];
}

function createBuiltInRule(
  type: BuiltInAnchorType,
  defaultSettings: BuiltInAnchorOverride,
  override: BuiltInAnchorOverride | undefined,
  baseScore: AnchorRule['score'],
): AnchorRule {
  const settings = override ?? defaultSettings;
  return {
    key: type,
    type,
    name: settings.name,
    source: AnchorSource.BuiltIn,
    radius: settings.radius,
    minimumDistance: settings.minimumDistance,
    zoneType: settings.zoneType,
    customRule: null,
    builtInOverride: override ?? null,
    score: override === undefined
      ? baseScore
      : (tile, context) => scoreSettings(tile, context, settings),
  };
}

function createCustomRule(definition: CustomAnchorDefinition): AnchorRule {
  return {
    key: `custom:${definition.id}`,
    type: AnchorType.Custom,
    name: definition.name,
    source: AnchorSource.Custom,
    radius: definition.radius,
    minimumDistance: definition.minimumDistance,
    zoneType: definition.zoneType,
    customRule: definition,
    builtInOverride: null,
    score: (tile, context) => scoreSettings(tile, context, definition),
  };
}

export function createAnchorRules(
  config: AnchorConfig,
  customAnchors: readonly CustomAnchorDefinition[] = [],
  builtInOverrides: readonly BuiltInAnchorOverride[] = [],
): readonly AnchorRule[] {
  const defaults = createDefaultBuiltInAnchorDefinitions(config);
  const defaultByType = new Map(defaults.map((definition) => [definition.type, definition]));
  const overrideByType = new Map(builtInOverrides.map((definition) => [definition.type, definition]));
  const make = (
    type: BuiltInAnchorType,
    score: AnchorRule['score'],
  ): AnchorRule => {
    const defaultSettings = defaultByType.get(type);
    if (defaultSettings === undefined) throw new Error(`Missing default anchor settings for ${type}.`);
    return createBuiltInRule(type, defaultSettings, overrideByType.get(type), score);
  };

  const builtIn: AnchorRule[] = [
    make(AnchorType.TownPlaza, (tile, context) => {
      if (!Number.isFinite(safeLand(tile, context))) return Number.NEGATIVE_INFINITY;
      return centerScore(tile, context.world) * 0.48
        + flatness(tile, config.maximumUrbanSlope) * 0.28
        + clamp01(tile.coastDistance / 20) * 0.12
        + (1 - tile.floodRisk) * 0.12;
    }),
    make(AnchorType.Church, (tile, context) => {
      if (!Number.isFinite(safeLand(tile, context))) return Number.NEGATIVE_INFINITY;
      const plaza = getAnchor(context.placed, AnchorType.TownPlaza);
      if (plaza === undefined) return Number.NEGATIVE_INFINITY;
      return closeness(distanceTo(tile, plaza), 10, 9) * 0.55
        + flatness(tile, config.maximumUrbanSlope) * 0.25
        + centerScore(tile, context.world) * 0.2;
    }),
    make(AnchorType.Market, (tile, context) => {
      if (!Number.isFinite(safeLand(tile, context))) return Number.NEGATIVE_INFINITY;
      const plaza = getAnchor(context.placed, AnchorType.TownPlaza);
      const church = getAnchor(context.placed, AnchorType.Church);
      if (plaza === undefined || church === undefined) return Number.NEGATIVE_INFINITY;
      return closeness(distanceTo(tile, plaza), 14, 13) * 0.35
        + closeness(distanceTo(tile, church), 13, 12) * 0.25
        + flatness(tile, config.maximumUrbanSlope) * 0.22
        + (1 - tile.floodRisk) * 0.18;
    }),
    make(AnchorType.Hospital, (tile, context) => {
      if (!Number.isFinite(safeLand(tile, context))) return Number.NEGATIVE_INFINITY;
      const plaza = getAnchor(context.placed, AnchorType.TownPlaza);
      if (plaza === undefined) return Number.NEGATIVE_INFINITY;
      return closeness(distanceTo(tile, plaza), 24, 22) * 0.4
        + flatness(tile, config.maximumUrbanSlope) * 0.3
        + (1 - tile.floodRisk) * 0.22
        + clamp01(tile.coastDistance / 15) * 0.08;
    }),
    make(AnchorType.School, (tile, context) => {
      if (!Number.isFinite(safeLand(tile, context))) return Number.NEGATIVE_INFINITY;
      const plaza = getAnchor(context.placed, AnchorType.TownPlaza);
      if (plaza === undefined) return Number.NEGATIVE_INFINITY;
      return closeness(distanceTo(tile, plaza), 31, 28) * 0.42
        + flatness(tile, config.maximumUrbanSlope) * 0.27
        + (1 - tile.floodRisk) * 0.2
        + (1 - tile.forestDensity) * 0.11;
    }),
    make(AnchorType.Port, (tile, context) => {
      if (tile.water !== WaterType.Land || tile.slope > config.maximumUrbanSlope * 1.4) {
        return Number.NEGATIVE_INFINITY;
      }
      const coast = coastAdjacency(tile, context.world);
      if (coast <= 0) return Number.NEGATIVE_INFINITY;
      return coast * 0.52
        + regionScore(tile, context.world, 0.63, 0.77, 0.5) * 0.2
        + flatness(tile, config.maximumUrbanSlope * 1.4) * 0.18
        + tile.moisture * 0.1;
    }),
    make(AnchorType.Airport, (tile, context) => {
      if (!Number.isFinite(safeLand(tile, context)) || tile.slope > config.maximumAirportSlope) {
        return Number.NEGATIVE_INFINITY;
      }
      const relief = localRelief(tile, context.world, config.airportFlatRadius);
      if (relief > config.airportMaximumRelief) return Number.NEGATIVE_INFINITY;
      const plaza = getAnchor(context.placed, AnchorType.TownPlaza);
      const plazaDistance = plaza === undefined ? 0 : distanceTo(tile, plaza);
      return clamp01(plazaDistance / 75) * 0.24
        + regionScore(tile, context.world, 0.78, 0.5, 0.55) * 0.22
        + flatness(tile, config.maximumAirportSlope) * 0.28
        + (1 - relief / config.airportMaximumRelief) * 0.2
        + (1 - tile.floodRisk) * 0.06;
    }),
    make(AnchorType.RiceFields, (tile, context) => {
      if (tile.water !== WaterType.Land || tile.slope > config.maximumUrbanSlope) {
        return Number.NEGATIVE_INFINITY;
      }
      return regionScore(tile, context.world, 0.2, 0.61, 0.48) * 0.35
        + flatness(tile, config.maximumUrbanSlope) * 0.2
        + tile.moisture * 0.2
        + clamp01(tile.floodRisk * 1.4) * 0.13
        + (1 - tile.forestDensity) * 0.12;
    }),
    make(AnchorType.Hacienda, (tile, context) => {
      if (!Number.isFinite(safeLand(tile, context))) return Number.NEGATIVE_INFINITY;
      const fields = getAnchor(context.placed, AnchorType.RiceFields);
      const fieldScore = fields === undefined ? 0 : closeness(distanceTo(tile, fields), 34, 30);
      return regionScore(tile, context.world, 0.24, 0.43, 0.48) * 0.28
        + fieldScore * 0.28
        + flatness(tile, config.maximumUrbanSlope * 1.4) * 0.18
        + clamp01((tile.elevation - 0.4) / 0.24) * 0.15
        + (1 - tile.floodRisk) * 0.11;
    }),
  ];

  return [...builtIn, ...customAnchors.map(createCustomRule)];
}
