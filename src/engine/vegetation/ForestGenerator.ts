import type { VegetationConfig } from '../config/GenerationConfig';
import type { Random } from '../rng/Random';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { ZoneType } from '../zoning/Zone';
import { VegetationType, type VegetationInstance } from './Vegetation';

function hasNearbyBuilding(world: World, x: number, y: number, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const tile = world.getTile(x + dx, y + dy);
      if (tile?.buildingId !== null && tile?.buildingId !== undefined) return true;
    }
  }
  return false;
}

function chooseVegetation(world: World, tileIndex: number, random: Random): VegetationType {
  const tile = world.tiles[tileIndex];
  if (tile === undefined) return VegetationType.Scrub;
  if (tile.floodRisk >= 0.45 && tile.coastDistance <= 5) return VegetationType.Mangrove;
  if (tile.zoneType === ZoneType.Agricultural) {
    return tile.moisture > 0.58 ? VegetationType.RiceCrop : VegetationType.Sugarcane;
  }
  if (tile.coastDistance <= 7) return VegetationType.CoconutPalm;
  if (tile.forestDensity > 0.76) {
    return random.pick([
      VegetationType.ForestTree,
      VegetationType.MangoTree,
      VegetationType.Bamboo,
      VegetationType.Acacia,
    ]);
  }
  if (tile.moisture > 0.64) return random.pick([VegetationType.Banana, VegetationType.Bamboo]);
  return random.pick([VegetationType.MangoTree, VegetationType.Acacia, VegetationType.Scrub]);
}

function shouldSpawn(world: World, index: number, config: VegetationConfig, random: Random): boolean {
  const tile = world.tiles[index];
  if (
    tile === undefined
    || tile.water !== WaterType.Land
    || tile.road
    || tile.river
    || tile.buildingId !== null
    || tile.vegetationId !== null
    || tile.terrain === TerrainType.Beach
  ) return false;
  if (hasNearbyBuilding(world, tile.x, tile.y, config.minimumBuildingDistance)) return false;

  if (tile.zoneType === ZoneType.Agricultural) {
    return (tile.x + tile.y * 2) % Math.max(1, config.agriculturalCropSpacing) === 0
      && random.chance(0.72);
  }
  if (tile.zoneType === ZoneType.Forest || tile.terrain === TerrainType.Forest) {
    const probability = Math.max(0, tile.forestDensity - config.forestSpawnThreshold)
      * config.forestDensityScale * 2.4;
    return random.chance(Math.min(0.88, probability));
  }
  if (tile.floodRisk >= config.mangroveFloodRiskThreshold && tile.coastDistance <= 5) {
    return random.chance(0.32);
  }
  if (tile.coastDistance <= 7 && random.chance(config.coastalPalmChance)) return true;
  if (tile.roadDistance >= 1 && tile.roadDistance <= 2 && random.chance(config.roadsideTreeChance)) return true;
  return random.chance(Math.max(0, tile.forestDensity - 0.58) * 0.16);
}

export function generateVegetation(world: World, config: VegetationConfig, random: Random): void {
  world.vegetation = [];
  for (const tile of world.tiles) tile.vegetationId = null;

  for (let index = 0; index < world.tiles.length; index += 1) {
    if (world.vegetation.length >= config.maximumInstances) break;
    const tileRandom = random.fork(`tile-${index}`);
    if (!shouldSpawn(world, index, config, tileRandom)) continue;
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    const instance: VegetationInstance = {
      id: world.vegetation.length,
      type: chooseVegetation(world, index, tileRandom.fork('type')),
      tileIndex: index,
      x: tile.x + tileRandom.float(0.18, 0.82),
      y: tile.y + tileRandom.float(0.18, 0.82),
      rotation: tileRandom.float(0, Math.PI * 2),
      scale: tileRandom.float(0.72, 1.28),
      age: tileRandom.float(0.12, 1),
    };
    tile.vegetationId = instance.id;
    world.vegetation.push(instance);
  }
}
