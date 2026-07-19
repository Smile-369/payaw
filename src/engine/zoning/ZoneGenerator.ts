import type { ZoningConfig } from '../config/GenerationConfig';
import { AnchorType, type Anchor } from '../settlement/Anchor';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { IslandRole } from '../regional/Island';
import { ZoneType, type Zone } from './Zone';

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const ZONE_PRIORITY: Readonly<Record<ZoneType, number>> = {
  [ZoneType.Government]: 7,
  [ZoneType.Institutional]: 6,
  [ZoneType.Commercial]: 5,
  [ZoneType.Industrial]: 4,
  [ZoneType.Residential]: 3,
  [ZoneType.Agricultural]: 2,
  [ZoneType.Forest]: 1,
  [ZoneType.Mixed]: 4,
};

function anchorByType(world: World, type: AnchorType): Anchor | undefined {
  return world.anchors.find((anchor) => anchor.type === type);
}

function distance(x: number, y: number, anchor: Anchor | undefined): number {
  return anchor === undefined ? Number.POSITIVE_INFINITY : Math.hypot(anchor.x - x, anchor.y - y);
}


function anchorZoneInfluence(world: World, x: number, y: number): ZoneType | null {
  let selected: { type: ZoneType; normalizedDistance: number } | undefined;
  for (const anchor of world.anchors) {
    if (anchor.zoneType === null) continue;
    const influenceRadius = Math.max(2, anchor.radius * 1.65);
    const normalizedDistance = Math.hypot(anchor.x - x, anchor.y - y) / influenceRadius;
    if (normalizedDistance > 1) continue;
    if (selected === undefined || normalizedDistance < selected.normalizedDistance) {
      selected = { type: anchor.zoneType, normalizedDistance };
    }
  }
  return selected?.type ?? null;
}

function classifyTile(
  world: World,
  index: number,
  config: ZoningConfig,
  anchors: Readonly<Record<AnchorType, Anchor | undefined>>,
): ZoneType | null {
  const tile = world.tiles[index];
  if (tile === undefined || tile.water !== WaterType.Land || tile.road || tile.river) return null;

  const influencedZone = anchorZoneInfluence(world, tile.x, tile.y);
  if (influencedZone !== null) return influencedZone;

  const plazaDistance = distance(tile.x, tile.y, anchors[AnchorType.TownPlaza]);
  const marketDistance = distance(tile.x, tile.y, anchors[AnchorType.Market]);
  const churchDistance = distance(tile.x, tile.y, anchors[AnchorType.Church]);
  const schoolDistance = distance(tile.x, tile.y, anchors[AnchorType.School]);
  const hospitalDistance = distance(tile.x, tile.y, anchors[AnchorType.Hospital]);
  const portDistance = distance(tile.x, tile.y, anchors[AnchorType.Port]);
  const airportDistance = distance(tile.x, tile.y, anchors[AnchorType.Airport]);
  const riceDistance = distance(tile.x, tile.y, anchors[AnchorType.RiceFields]);
  const haciendaDistance = distance(tile.x, tile.y, anchors[AnchorType.Hacienda]);

  if (plazaDistance <= config.governmentRadius) return ZoneType.Government;
  if (Math.min(churchDistance, schoolDistance, hospitalDistance) <= config.institutionalRadius) {
    return ZoneType.Institutional;
  }
  if (Math.min(portDistance, airportDistance) <= config.industrialAnchorRadius) {
    return ZoneType.Industrial;
  }
  if (Math.min(riceDistance, haciendaDistance) <= config.agriculturalAnchorRadius) {
    return ZoneType.Agricultural;
  }

  const island = tile.islandId === null ? undefined : world.islands[tile.islandId];
  const settlement = tile.settlementId === null ? undefined : world.settlements[tile.settlementId];
  if (island?.preserveNature === true && settlement === undefined) return ZoneType.Forest;
  if (island?.role === IslandRole.Agricultural && settlement === undefined) return ZoneType.Agricultural;
  if (island?.role === IslandRole.Industrial && tile.roadDistance >= 0 && tile.roadDistance <= 14) return ZoneType.Industrial;
  if (island?.role === IslandRole.PortHub && tile.coastDistance <= 8 && tile.roadDistance >= 0 && tile.roadDistance <= 10) return ZoneType.Industrial;
  if (settlement !== undefined) {
    const settlementDistance = Math.hypot(tile.x - settlement.x, tile.y - settlement.y);
    if (settlementDistance <= Math.max(4, settlement.influenceRadius * 0.28) && tile.landValue >= config.commercialLandValueThreshold * 0.82) return ZoneType.Commercial;
    if (tile.roadDistance >= 0 && tile.roadDistance <= 16 && tile.slope < 0.22 && tile.floodRisk < 0.74) return ZoneType.Residential;
  }

  const westness = 1 - tile.x / Math.max(1, world.width - 1);
  if (
    westness >= config.agriculturalWestThreshold
    && tile.slope < 0.12
    && tile.floodRisk < 0.72
    && tile.elevation < 0.61
  ) {
    return ZoneType.Agricultural;
  }
  if (
    tile.terrain === TerrainType.Forest
    && tile.forestDensity >= config.forestDensityThreshold
    && (tile.roadDistance < 0 || tile.roadDistance >= config.forestRoadDistance)
  ) {
    return ZoneType.Forest;
  }
  if (
    tile.landValue >= config.commercialLandValueThreshold
    && tile.roadDistance >= 0
    && tile.roadDistance <= config.commercialRoadDistance
    && Math.min(marketDistance, plazaDistance) <= 48
  ) {
    return ZoneType.Commercial;
  }
  if (
    tile.landValue >= config.residentialLandValueThreshold
    && tile.roadDistance >= 0
    && tile.roadDistance <= 18
    && tile.slope < 0.2
    && tile.floodRisk < 0.7
  ) {
    return ZoneType.Residential;
  }
  if (tile.terrain === TerrainType.Forest || tile.forestDensity >= config.forestDensityThreshold) {
    return ZoneType.Forest;
  }
  if (westness >= 0.42 && tile.slope < 0.16) return ZoneType.Agricultural;
  return ZoneType.Residential;
}

function isProtectedZone(
  world: World,
  index: number,
  config: ZoningConfig,
  anchors: Readonly<Record<AnchorType, Anchor | undefined>>,
): boolean {
  const tile = world.tiles[index];
  if (tile === undefined) return false;
  if (anchorZoneInfluence(world, tile.x, tile.y) !== null) return true;
  return distance(tile.x, tile.y, anchors[AnchorType.TownPlaza]) <= config.governmentRadius
    || Math.min(
      distance(tile.x, tile.y, anchors[AnchorType.Church]),
      distance(tile.x, tile.y, anchors[AnchorType.School]),
      distance(tile.x, tile.y, anchors[AnchorType.Hospital]),
    ) <= config.institutionalRadius
    || Math.min(
      distance(tile.x, tile.y, anchors[AnchorType.Port]),
      distance(tile.x, tile.y, anchors[AnchorType.Airport]),
    ) <= config.industrialAnchorRadius * 0.72
    || Math.min(
      distance(tile.x, tile.y, anchors[AnchorType.RiceFields]),
      distance(tile.x, tile.y, anchors[AnchorType.Hacienda]),
    ) <= config.agriculturalAnchorRadius * 0.72;
}

function smoothZones(
  world: World,
  config: ZoningConfig,
  anchors: Readonly<Record<AnchorType, Anchor | undefined>>,
): void {
  for (let pass = 0; pass < config.smoothingPasses; pass += 1) {
    const next = world.tiles.map((tile) => tile.zoneType);
    for (let index = 0; index < world.tiles.length; index += 1) {
      const tile = world.tiles[index];
      if (tile === undefined || tile.zoneType === null || isProtectedZone(world, index, config, anchors)) continue;
      const counts = new Map<ZoneType, number>();
      for (const [dx, dy] of DIRECTIONS) {
        const neighbor = world.getTile(tile.x + dx, tile.y + dy);
        if (neighbor?.zoneType === null || neighbor === undefined) continue;
        counts.set(neighbor.zoneType, (counts.get(neighbor.zoneType) ?? 0) + 1);
      }
      const candidates = [...counts.entries()]
        .filter(([, count]) => count >= 3)
        .sort((left, right) => right[1] - left[1] || ZONE_PRIORITY[right[0]] - ZONE_PRIORITY[left[0]]);
      const selected = candidates[0]?.[0];
      if (selected !== undefined) next[index] = selected;
    }
    for (let index = 0; index < next.length; index += 1) {
      const tile = world.tiles[index];
      if (tile !== undefined) tile.zoneType = next[index] ?? null;
    }
  }
}

function makeBlocksSingleZone(world: World): void {
  for (const block of world.blocks) {
    const blockTileSet = new Set(block.tileIndices);
    const forcedZone = world.anchors.find((anchor) => anchor.zoneType !== null && blockTileSet.has(anchor.tileIndex))?.zoneType;
    if (forcedZone !== undefined && forcedZone !== null) {
      for (const index of block.tileIndices) {
        const tile = world.tiles[index];
        if (tile !== undefined) tile.zoneType = forcedZone;
      }
      continue;
    }
    const counts = new Map<ZoneType, number>();
    for (const index of block.tileIndices) {
      const zoneType = world.tiles[index]?.zoneType;
      if (zoneType !== undefined && zoneType !== null) {
        counts.set(zoneType, (counts.get(zoneType) ?? 0) + 1);
      }
    }
    const selected = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || ZONE_PRIORITY[right[0]] - ZONE_PRIORITY[left[0]])[0]?.[0];
    if (selected === undefined) continue;
    for (const index of block.tileIndices) {
      const tile = world.tiles[index];
      if (tile !== undefined) tile.zoneType = selected;
    }
  }
}

function collectZoneComponents(world: World): readonly { type: ZoneType; indices: number[] }[] {
  const visited = new Uint8Array(world.tiles.length);
  const components: { type: ZoneType; indices: number[] }[] = [];

  for (let startIndex = 0; startIndex < world.tiles.length; startIndex += 1) {
    const type = world.tiles[startIndex]?.zoneType;
    if (type === undefined || type === null || visited[startIndex] === 1) continue;
    const indices: number[] = [];
    const queue = [startIndex];
    visited[startIndex] = 1;

    for (let offset = 0; offset < queue.length; offset += 1) {
      const currentIndex = queue[offset];
      if (currentIndex === undefined) continue;
      indices.push(currentIndex);
      const tile = world.tiles[currentIndex];
      if (tile === undefined) continue;
      for (const [dx, dy] of DIRECTIONS) {
        const nx: number = tile.x + dx;
        const ny: number = tile.y + dy;
        if (!world.contains(nx, ny)) continue;
        const nextIndex = ny * world.width + nx;
        if (visited[nextIndex] === 1 || world.tiles[nextIndex]?.zoneType !== type) continue;
        visited[nextIndex] = 1;
        queue.push(nextIndex);
      }
    }

    components.push({ type, indices });
  }

  return components;
}

function mergeSmallZonePatches(world: World, minimumArea: number): void {
  for (const component of collectZoneComponents(world)) {
    if (component.indices.length >= minimumArea) continue;
    const neighbors = new Map<ZoneType, number>();
    for (const index of component.indices) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      for (const [dx, dy] of DIRECTIONS) {
        const neighbor = world.getTile(tile.x + dx, tile.y + dy);
        if (neighbor?.zoneType === undefined || neighbor.zoneType === null || neighbor.zoneType === component.type) continue;
        neighbors.set(neighbor.zoneType, (neighbors.get(neighbor.zoneType) ?? 0) + 1);
      }
    }
    const replacement = [...neighbors.entries()]
      .sort((left, right) => right[1] - left[1] || ZONE_PRIORITY[right[0]] - ZONE_PRIORITY[left[0]])[0]?.[0];
    if (replacement === undefined) continue;
    for (const index of component.indices) {
      const tile = world.tiles[index];
      if (tile !== undefined) tile.zoneType = replacement;
    }
  }
}

export function buildZoneEntities(world: World): void {
  world.zones = [];
  for (const tile of world.tiles) tile.zoneId = null;
  for (const block of world.blocks) block.zoneId = null;

  const components = [...collectZoneComponents(world)]
    .sort((left, right) => (left.indices[0] ?? 0) - (right.indices[0] ?? 0));
  for (const component of components) {
    let x = 0;
    let y = 0;
    let landValue = 0;
    const blockIds = new Set<number>();
    for (const index of component.indices) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      x += tile.x + 0.5;
      y += tile.y + 0.5;
      landValue += tile.landValue;
      if (tile.blockId !== null) blockIds.add(tile.blockId);
    }
    const divisor = Math.max(1, component.indices.length);
    const zone: Zone = {
      id: world.zones.length,
      type: component.type,
      tileIndices: [...component.indices].sort((left, right) => left - right),
      blockIds: [...blockIds].sort((left, right) => left - right),
      centroid: { x: x / divisor, y: y / divisor },
      area: component.indices.length,
      averageLandValue: landValue / divisor,
    };
    world.zones.push(zone);
    for (const index of zone.tileIndices) {
      const tile = world.tiles[index];
      if (tile !== undefined) tile.zoneId = zone.id;
    }
  }

  for (const block of world.blocks) {
    const counts = new Map<number, number>();
    for (const index of block.tileIndices) {
      const zoneId = world.tiles[index]?.zoneId;
      if (zoneId !== undefined && zoneId !== null) counts.set(zoneId, (counts.get(zoneId) ?? 0) + 1);
    }
    block.zoneId = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? null;
  }
}

export function generateZones(world: World, config: ZoningConfig): void {
  const anchors: Record<AnchorType, Anchor | undefined> = {
    [AnchorType.Church]: anchorByType(world, AnchorType.Church),
    [AnchorType.TownPlaza]: anchorByType(world, AnchorType.TownPlaza),
    [AnchorType.Market]: anchorByType(world, AnchorType.Market),
    [AnchorType.School]: anchorByType(world, AnchorType.School),
    [AnchorType.Hospital]: anchorByType(world, AnchorType.Hospital),
    [AnchorType.Port]: anchorByType(world, AnchorType.Port),
    [AnchorType.Airport]: anchorByType(world, AnchorType.Airport),
    [AnchorType.RiceFields]: anchorByType(world, AnchorType.RiceFields),
    [AnchorType.Hacienda]: anchorByType(world, AnchorType.Hacienda),
    [AnchorType.Custom]: undefined,
  };

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile !== undefined) tile.zoneType = classifyTile(world, index, config, anchors);
  }
  smoothZones(world, config, anchors);
  makeBlocksSingleZone(world);
  mergeSmallZonePatches(world, config.minimumZoneArea);
  makeBlocksSingleZone(world);
  for (const tile of world.tiles) {
    tile.generatedZoneType = tile.zoneType;
    tile.zoneOverrideType = null;
    tile.hasZoneOverride = false;
    tile.zoneLocked = false;
  }
  buildZoneEntities(world);
}

