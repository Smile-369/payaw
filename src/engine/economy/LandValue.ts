import type { LandValueConfig } from '../config/GenerationConfig';
import { clamp01 } from '../math/Scalar';
import { AnchorType, type Anchor } from '../settlement/Anchor';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';

function findAnchor(world: World, type: AnchorType): Anchor | undefined {
  return world.anchors.find((anchor) => anchor.type === type);
}

function radialInfluence(x: number, y: number, anchor: Anchor | undefined, radius: number): number {
  if (anchor === undefined || radius <= 0) return 0;
  return clamp01(1 - Math.hypot(anchor.x - x, anchor.y - y) / radius);
}

export function calculateLandValue(world: World, config: LandValueConfig): void {
  const market = findAnchor(world, AnchorType.Market);
  const church = findAnchor(world, AnchorType.Church);
  const plaza = findAnchor(world, AnchorType.TownPlaza);
  const hospital = findAnchor(world, AnchorType.Hospital);

  for (const tile of world.tiles) {
    if (tile.water !== WaterType.Land) {
      tile.landValue = 0;
      continue;
    }

    const roadProximity = tile.roadDistance < 0
      ? 0
      : Math.exp(-tile.roadDistance / config.roadDistanceScale);
    const marketScore = radialInfluence(tile.x, tile.y, market, config.marketRadius);
    const churchScore = radialInfluence(tile.x, tile.y, church, config.churchRadius);
    const plazaScore = radialInfluence(tile.x, tile.y, plaza, config.plazaRadius);
    const hospitalScore = radialInfluence(tile.x, tile.y, hospital, config.hospitalRadius);
    const coastScore = tile.coastDistance < 0
      ? 0
      : clamp01(1 - tile.coastDistance / config.coastRadius);
    const isolation = tile.roadDistance < 0
      ? 1
      : clamp01((tile.roadDistance - config.isolationDistance) / Math.max(1, config.isolationDistance));
    const forestPenalty = tile.terrain === TerrainType.Forest
      ? tile.forestDensity * config.forestPenalty
      : 0;

    tile.landValue = clamp01(
      config.baseValue
      + tile.accessibility * config.accessibilityWeight
      + roadProximity * config.roadProximityWeight
      + marketScore * config.marketInfluence
      + churchScore * config.churchInfluence
      + plazaScore * config.plazaInfluence
      + hospitalScore * config.hospitalInfluence
      + coastScore * config.coastInfluence
      - tile.slope * config.slopePenalty
      - tile.floodRisk * config.floodPenalty
      - isolation * config.isolationPenalty
      - forestPenalty,
    );
  }

  for (const block of world.blocks) {
    let totalLandValue = 0;
    let totalAccessibility = 0;
    for (const index of block.tileIndices) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      totalLandValue += tile.landValue;
      totalAccessibility += tile.accessibility;
    }
    const divisor = Math.max(1, block.tileIndices.length);
    block.averageLandValue = totalLandValue / divisor;
    block.averageAccessibility = totalAccessibility / divisor;
  }
}
