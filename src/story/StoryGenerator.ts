import { BuildingCondition, BuildingType } from '../engine/buildings/Building';
import type { StoryConfig } from '../engine/config/GenerationConfig';
import type { StoryPositionOverride, StoryRuleOverride } from '../engine/generation/GenerationOptions';
import type { Random } from '../engine/rng/Random';
import { AnchorRegionPreference, AnchorTerrainPreference } from '../engine/settlement/Anchor';
import { TerrainType, WaterType } from '../engine/world/Tile';
import type { World } from '../engine/world/World';
import { ZoneType } from '../engine/zoning/Zone';
import { generateEncounterTable } from './EncounterGenerator';
import { generateManifestation } from './GhostGenerator';
import {
  StoryObjectSource,
  StoryObjectType,
  type CustomStoryPointDefinition,
  type StoryEncounterDefinition,
  type StoryObject,
} from './StoryObject';
import { generateWish } from './WishGenerator';

interface Candidate {
  readonly index: number;
  readonly score: number;
  readonly buildingId: number | null;
}

interface ResolvedStoryRule {
  readonly name: string;
  readonly preferredZone: ZoneType | null;
  readonly allowedZones: readonly ZoneType[];
  readonly disallowedZones: readonly ZoneType[];
  readonly influenceRadius: number;
  readonly wish: string | undefined;
  readonly manifestation: string | undefined;
  readonly encounters: readonly StoryEncounterDefinition[] | undefined;
}

function storyKey(type: StoryObjectType, id: number): string {
  if (type === StoryObjectType.BaleteTree) return `balete-${id + 1}`;
  return type;
}

function matchingRule(
  id: number,
  key: string,
  overrides: readonly StoryRuleOverride[],
): StoryRuleOverride | undefined {
  return overrides.find((item) => item.key === key) ?? overrides.find((item) => item.id === id);
}

function matchingPosition(
  id: number,
  key: string,
  overrides: readonly StoryPositionOverride[],
): StoryPositionOverride | undefined {
  return overrides.find((item) => item.key === key) ?? overrides.find((item) => item.id === id);
}

function resolveStoryRule(
  id: number,
  key: string,
  defaultName: string,
  defaultInfluenceRadius: number,
  overrides: readonly StoryRuleOverride[],
  defaults: Partial<ResolvedStoryRule> = {},
): ResolvedStoryRule {
  const override = matchingRule(id, key, overrides);
  return {
    name: override?.name?.trim() || defaultName,
    preferredZone: override?.preferredZone ?? defaults.preferredZone ?? null,
    allowedZones: override?.allowedZones ?? defaults.allowedZones ?? [],
    disallowedZones: override?.disallowedZones ?? defaults.disallowedZones ?? [],
    influenceRadius: Math.max(2, Math.min(40, override?.influenceRadius ?? defaults.influenceRadius ?? defaultInfluenceRadius)),
    wish: override?.wish?.trim() || defaults.wish,
    manifestation: override?.manifestation?.trim() || defaults.manifestation,
    encounters: override?.encounters ?? defaults.encounters,
  };
}


function islandAllowsStory(world: World, index: number): boolean {
  const islandId = world.tiles[index]?.islandId;
  if (islandId === null || islandId === undefined) return false;
  return world.islands[islandId]?.allowStoryPoints === true;
}

function zoneRuleScore(world: World, index: number, rule: ResolvedStoryRule): number | null {
  const zone = world.tiles[index]?.zoneType ?? null;
  if (zone !== null && rule.disallowedZones.includes(zone)) return null;
  if (rule.allowedZones.length > 0 && (zone === null || !rule.allowedZones.includes(zone))) return null;
  return rule.preferredZone !== null && zone === rule.preferredZone ? 0.32 : 0;
}

function nearbyBuildingCount(world: World, x: number, y: number, radius: number): number {
  let count = 0;
  for (const building of world.buildings) {
    const tileIndex = building.tileIndices[0];
    const tile = tileIndex === undefined ? undefined : world.tiles[tileIndex];
    if (tile !== undefined && Math.hypot(tile.x - x, tile.y - y) <= radius) count += 1;
  }
  return count;
}

function separated(world: World, index: number, selected: readonly StoryObject[], minimum: number): boolean {
  const tile = world.tiles[index];
  if (tile === undefined) return false;
  return selected.every((item) => Math.hypot(tile.x - item.x, tile.y - item.y) >= minimum);
}

function createStoryObject(
  world: World,
  candidate: Candidate,
  id: number,
  key: string,
  type: StoryObjectType,
  source: StoryObjectSource,
  customDefinitionId: string | null,
  rule: ResolvedStoryRule,
  random: Random,
): StoryObject {
  const tile = world.tiles[candidate.index];
  if (tile === undefined) throw new Error('Story placement referenced an invalid tile.');
  return {
    id,
    key,
    source,
    customDefinitionId,
    type,
    name: rule.name,
    tileIndex: candidate.index,
    x: tile.x,
    y: tile.y,
    influenceRadius: rule.influenceRadius,
    placementScore: candidate.score,
    linkedBuildingId: candidate.buildingId,
    zoneType: tile.zoneType,
    preferredZone: rule.preferredZone,
    allowedZones: rule.allowedZones,
    disallowedZones: rule.disallowedZones,
    wish: rule.wish ?? generateWish(type, random.fork('wish')),
    manifestation: rule.manifestation ?? generateManifestation(type, random.fork('manifestation')),
    encounters: rule.encounters !== undefined && rule.encounters.length > 0
      ? rule.encounters
      : generateEncounterTable(type, random.fork('encounters')),
  };
}

function choose(
  world: World,
  type: StoryObjectType,
  name: string,
  config: StoryConfig,
  random: Random,
  selected: readonly StoryObject[],
  score: (index: number) => Candidate | undefined,
  minimumSpacing = config.landmarkMinimumSpacing,
  influenceRadius = 8,
  positionOverrides: readonly StoryPositionOverride[] = [],
  ruleOverrides: readonly StoryRuleOverride[] = [],
  keyOverride?: string,
  source = StoryObjectSource.BuiltIn,
  customDefinitionId: string | null = null,
  ruleDefaults: Partial<ResolvedStoryRule> = {},
): StoryObject {
  const id = selected.length;
  const key = keyOverride ?? storyKey(type, id);
  const rule = resolveStoryRule(id, key, name, influenceRadius, ruleOverrides, ruleDefaults);
  const positionOverride = matchingPosition(id, key, positionOverrides);
  if (positionOverride !== undefined) {
    const x = Math.round(positionOverride.x);
    const y = Math.round(positionOverride.y);
    const tile = world.getTile(x, y);
    if (tile === undefined || tile.water !== WaterType.Land || tile.river || !islandAllowsStory(world, y * world.width + x)) {
      throw new Error(`Manual position for story object “${name}” must be on dry land.`);
    }
    if (zoneRuleScore(world, y * world.width + x, rule) === null) {
      throw new Error(`Manual position for story object “${rule.name}” violates its allowed or disallowed zone rules.`);
    }
    return createStoryObject(
      world,
      { index: y * world.width + x, score: 1, buildingId: tile.buildingId },
      id,
      key,
      type,
      source,
      customDefinitionId,
      rule,
      random,
    );
  }

  const candidates: Candidate[] = [];
  for (let index = 0; index < world.tiles.length; index += 1) {
    if (!islandAllowsStory(world, index) || !separated(world, index, selected, minimumSpacing)) continue;
    const candidate = score(index);
    const zoneBonus = zoneRuleScore(world, index, rule);
    if (candidate !== undefined && zoneBonus !== null && Number.isFinite(candidate.score)) {
      candidates.push({ ...candidate, score: candidate.score + zoneBonus + random.float(0, 0.012) });
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  let chosen = candidates.slice(0, config.candidateLimit)[0];
  if (chosen === undefined) {
    chosen = world.tiles
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile, index }) => islandAllowsStory(world, index) && tile.water === WaterType.Land && !tile.river && zoneRuleScore(world, index, rule) !== null && separated(world, index, selected, Math.max(4, minimumSpacing * 0.5)))
      .map(({ tile, index }) => ({ index, buildingId: tile.buildingId, score: (1 - tile.floodRisk) * 0.55 + (1 - tile.slope) * 0.35 + Math.min(1, Math.max(0, tile.roadDistance) / 8) * 0.10 }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0];
  }
  if (chosen === undefined) throw new Error(`No suitable location was found for story object “${name}”.`);
  return createStoryObject(world, chosen, id, key, type, source, customDefinitionId, rule, random);
}

function buildingCandidate(world: World, type: BuildingType): Candidate[] {
  return world.buildings
    .filter((building) => building.type === type)
    .flatMap((building) => {
      const tileIndex = building.tileIndices[0];
      if (tileIndex === undefined) return [];
      const tile = world.tiles[tileIndex];
      if (tile === undefined) return [];
      const conditionBonus = building.condition === BuildingCondition.Dilapidated
        ? 0.34
        : building.condition === BuildingCondition.Weathered ? 0.22 : 0.06;
      return [{ index: tileIndex, score: 0.55 + conditionBonus, buildingId: building.id }];
    });
}

function candidateMap(candidates: readonly Candidate[]): ReadonlyMap<number, Candidate> {
  return new Map(candidates.map((candidate) => [candidate.index, candidate]));
}

function regionScore(world: World, x: number, y: number, region: AnchorRegionPreference): number {
  const u = x / Math.max(1, world.width - 1);
  const v = y / Math.max(1, world.height - 1);
  switch (region) {
    case AnchorRegionPreference.North: return 1 - v;
    case AnchorRegionPreference.South: return v;
    case AnchorRegionPreference.East: return u;
    case AnchorRegionPreference.West: return 1 - u;
    case AnchorRegionPreference.TownCenter: {
      const center = world.anchors.find((anchor) => anchor.type === 'town-plaza') ?? world.anchors[0];
      if (center === undefined) return 0.5;
      return 1 - Math.min(1, Math.hypot(x - center.x, y - center.y) / Math.max(world.width, world.height) * 2.4);
    }
    default: return 0.55;
  }
}

function customTerrainScore(world: World, index: number, preference: AnchorTerrainPreference): number | null {
  const tile = world.tiles[index];
  if (tile === undefined || tile.water !== WaterType.Land || tile.river) return null;
  switch (preference) {
    case AnchorTerrainPreference.FlatLand:
      return tile.slope > 0.2 ? null : 1 - Math.min(1, tile.slope / 0.2);
    case AnchorTerrainPreference.Coast:
      return tile.coastDistance > 16 ? null : 1 - tile.coastDistance / 16;
    case AnchorTerrainPreference.River: {
      const riverScore = tile.river ? 1 : tile.floodRisk * 0.55 + (tile.terrain === TerrainType.Floodplain || tile.terrain === TerrainType.Delta ? 0.45 : 0);
      return riverScore < 0.25 ? null : riverScore;
    }
    case AnchorTerrainPreference.ForestEdge:
      return tile.forestDensity < 0.28 || tile.forestDensity > 0.82 ? null : 1 - Math.abs(tile.forestDensity - 0.58);
    case AnchorTerrainPreference.Farmland:
      return tile.zoneType === ZoneType.Agricultural || tile.terrain === TerrainType.Plain || tile.terrain === TerrainType.Floodplain
        ? 0.65 + (1 - tile.slope) * 0.35
        : null;
    case AnchorTerrainPreference.HighGround:
      return tile.elevation < 0.56 || tile.slope > 0.36 ? null : Math.min(1, tile.elevation);
    case AnchorTerrainPreference.DryLand:
      return tile.floodRisk > 0.24 ? null : 1 - tile.floodRisk;
    case AnchorTerrainPreference.SafeLand:
    default:
      return tile.floodRisk > 0.45 || tile.slope > 0.32 ? null : (1 - tile.floodRisk) * 0.55 + (1 - tile.slope) * 0.45;
  }
}

function customCandidate(world: World, definition: CustomStoryPointDefinition, index: number): Candidate | undefined {
  const tile = world.tiles[index];
  if (tile === undefined) return undefined;
  const terrain = customTerrainScore(world, index, definition.terrain);
  if (terrain === null) return undefined;
  const region = regionScore(world, tile.x, tile.y, definition.region);
  const road = tile.roadDistance < 0 ? 0 : 1 - Math.min(1, Math.abs(tile.roadDistance - 5) / 20);
  return {
    index,
    buildingId: tile.buildingId,
    score: terrain * 0.48 + region * 0.28 + road * 0.12 + (1 - tile.floodRisk) * 0.12,
  };
}

export function generateStoryObjects(
  world: World,
  config: StoryConfig,
  random: Random,
  positionOverrides: readonly StoryPositionOverride[] = [],
  ruleOverrides: readonly StoryRuleOverride[] = [],
  customDefinitions: readonly CustomStoryPointDefinition[] = [],
): void {
  const selected: StoryObject[] = [];

  for (let index = 0; index < config.baleteCount; index += 1) {
    selected.push(choose(
      world,
      StoryObjectType.BaleteTree,
      `Balete Tree ${index + 1}`,
      config,
      random.fork(`balete-${index}`),
      selected,
      (tileIndex) => {
        const tile = world.tiles[tileIndex];
        if (
          tile === undefined
          || tile.water !== WaterType.Land
          || tile.river
          || tile.forestDensity < config.baleteMinimumForestDensity
          || tile.slope > 0.24
          || tile.roadDistance < 3
          || tile.roadDistance > 24
        ) return undefined;
        const buildings = nearbyBuildingCount(world, tile.x, tile.y, config.buildingSearchRadius);
        if (buildings > config.baleteMaximumNearbyBuildings) return undefined;
        return {
          index: tileIndex,
          score: tile.forestDensity * 0.48
            + Math.min(1, tile.roadDistance / 12) * 0.2
            + (1 - tile.floodRisk) * 0.17
            + (1 - buildings / Math.max(1, config.baleteMaximumNearbyBuildings + 1)) * 0.15,
          buildingId: null,
        };
      },
      config.baleteMinimumSpacing,
      10,
      positionOverrides,
      ruleOverrides,
    ));
  }

  const schools = candidateMap(buildingCandidate(world, BuildingType.School));
  selected.push(choose(
    world,
    StoryObjectType.OldSchool,
    'Old School',
    config,
    random.fork('old-school'),
    selected,
    (index) => {
      const building = schools.get(index);
      if (building !== undefined) return building;
      const tile = world.tiles[index];
      if (tile?.zoneType !== ZoneType.Institutional || tile.roadDistance < 1 || tile.roadDistance > 6) return undefined;
      return { index, score: 0.45 + (1 - tile.landValue) * 0.25 + tile.accessibility * 0.12, buildingId: null };
    },
    config.landmarkMinimumSpacing,
    12,
    positionOverrides,
    ruleOverrides,
  ));

  const commercialBuildings = candidateMap([
    ...buildingCandidate(world, BuildingType.Apartment),
    ...buildingCandidate(world, BuildingType.SariSariStore),
    ...buildingCandidate(world, BuildingType.PublicMarket),
    ...buildingCandidate(world, BuildingType.Mall),
    ...buildingCandidate(world, BuildingType.Cinema),
  ]);
  selected.push(choose(
    world,
    StoryObjectType.AbandonedCinema,
    'Abandoned Cinema',
    config,
    random.fork('abandoned-cinema'),
    selected,
    (index) => {
      const building = commercialBuildings.get(index);
      if (building !== undefined) return { ...building, score: building.score + 0.08 };
      const tile = world.tiles[index];
      if (tile?.zoneType !== ZoneType.Commercial || tile.roadDistance < 1 || tile.roadDistance > 5) return undefined;
      return { index, score: 0.52 + tile.landValue * 0.18 + tile.accessibility * 0.16, buildingId: null };
    },
    config.landmarkMinimumSpacing,
    11,
    positionOverrides,
    ruleOverrides,
  ));

  selected.push(choose(
    world,
    StoryObjectType.OldCemetery,
    'Old Cemetery',
    config,
    random.fork('old-cemetery'),
    selected,
    (index) => {
      const tile = world.tiles[index];
      if (
        tile === undefined
        || tile.water !== WaterType.Land
        || tile.river
        || tile.floodRisk > 0.3
        || tile.slope > 0.18
        || tile.roadDistance < 2
        || tile.roadDistance > 12
        || tile.zoneType === ZoneType.Commercial
        || tile.zoneType === ZoneType.Industrial
      ) return undefined;
      const buildings = nearbyBuildingCount(world, tile.x, tile.y, config.buildingSearchRadius);
      if (buildings > 6) return undefined;
      const centerDistance = Math.hypot(tile.x - world.width * 0.5, tile.y - world.height * 0.53);
      return {
        index,
        score: Math.min(1, centerDistance / 70) * 0.32
          + (1 - tile.floodRisk) * 0.26
          + Math.min(1, tile.roadDistance / 8) * 0.18
          + (1 - buildings / 7) * 0.24,
        buildingId: null,
      };
    },
    config.landmarkMinimumSpacing,
    10,
    positionOverrides,
    ruleOverrides,
  ));

  for (const definition of customDefinitions) {
    const key = `custom-story:${definition.id}`;
    selected.push(choose(
      world,
      definition.type,
      definition.name,
      config,
      random.fork(key),
      selected,
      (index) => customCandidate(world, definition, index),
      Math.max(4, definition.minimumDistance),
      definition.influenceRadius,
      positionOverrides,
      ruleOverrides,
      key,
      StoryObjectSource.Custom,
      definition.id,
      {
        preferredZone: definition.preferredZone,
        allowedZones: definition.allowedZones,
        disallowedZones: definition.disallowedZones,
        influenceRadius: definition.influenceRadius,
        wish: definition.wish,
        manifestation: definition.manifestation,
        encounters: definition.encounters,
      },
    ));
  }

  world.storyObjects = selected;
}
