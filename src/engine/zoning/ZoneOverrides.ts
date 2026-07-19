import type { ZoneOverride } from '../generation/GenerationOptions';
import { WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { buildZoneEntities } from './ZoneGenerator';

/**
 * Applies authored zoning after procedural zoning and before building generation.
 * Invalid water/road/river targets are ignored rather than corrupting the world.
 */
export function applyZoneOverrides(world: World, overrides: readonly ZoneOverride[]): void {
  const byTile = new Map<number, ZoneOverride>();
  for (const override of overrides) {
    if (!Number.isInteger(override.tileIndex) || override.tileIndex < 0 || override.tileIndex >= world.tiles.length) continue;
    byTile.set(override.tileIndex, override);
  }

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    tile.zoneType = tile.generatedZoneType;
    tile.zoneOverrideType = null;
    tile.hasZoneOverride = false;
    tile.zoneLocked = false;

    const override = byTile.get(index);
    if (override === undefined) continue;
    if (tile.water !== WaterType.Land || tile.road || tile.river) continue;
    tile.zoneType = override.zoneType;
    tile.zoneOverrideType = override.zoneType;
    tile.hasZoneOverride = true;
    tile.zoneLocked = override.locked;
  }

  buildZoneEntities(world);
}
