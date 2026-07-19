import type { ZoneOverride } from '../engine/generation/GenerationOptions';
import { WaterType } from '../engine/world/Tile';
import type { World } from '../engine/world/World';
import type { ZoneType } from '../engine/zoning/Zone';

const CARDINAL_DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

export type ZoneTool = 'paint' | 'erase' | 'fill' | 'rectangle' | 'eyedropper' | 'lock' | 'unlock' | 'smooth';

export function editableZoneTile(world: World, index: number): boolean {
  const tile = world.tiles[index];
  return tile !== undefined && tile.water === WaterType.Land && !tile.road && !tile.river;
}

export function brushIndices(world: World, centerX: number, centerY: number, radius: number): number[] {
  const output: number[] = [];
  const squaredRadius = Math.max(0.5, radius) ** 2;
  const minimumX = Math.max(0, Math.floor(centerX - radius));
  const maximumX = Math.min(world.width - 1, Math.ceil(centerX + radius));
  const minimumY = Math.max(0, Math.floor(centerY - radius));
  const maximumY = Math.min(world.height - 1, Math.ceil(centerY + radius));
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      if ((x + 0.5 - centerX) ** 2 + (y + 0.5 - centerY) ** 2 > squaredRadius) continue;
      const index = y * world.width + x;
      if (editableZoneTile(world, index)) output.push(index);
    }
  }
  return output;
}

export function rectangleIndices(world: World, startX: number, startY: number, endX: number, endY: number): number[] {
  const output: number[] = [];
  const minimumX = Math.max(0, Math.floor(Math.min(startX, endX)));
  const maximumX = Math.min(world.width - 1, Math.floor(Math.max(startX, endX)));
  const minimumY = Math.max(0, Math.floor(Math.min(startY, endY)));
  const maximumY = Math.min(world.height - 1, Math.floor(Math.max(startY, endY)));
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const index = y * world.width + x;
      if (editableZoneTile(world, index)) output.push(index);
    }
  }
  return output;
}

export function floodFillIndices(world: World, startIndex: number): number[] {
  const start = world.tiles[startIndex];
  if (start === undefined || !editableZoneTile(world, startIndex)) return [];
  const targetZone = start.zoneType;
  const visited = new Uint8Array(world.tiles.length);
  const queue = [startIndex];
  const output: number[] = [];
  visited[startIndex] = 1;
  for (let offset = 0; offset < queue.length; offset += 1) {
    const index = queue[offset];
    const tile = index === undefined ? undefined : world.tiles[index];
    if (index === undefined || tile === undefined || tile.zoneType !== targetZone || !editableZoneTile(world, index)) continue;
    output.push(index);
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const x: number = tile.x + dx;
      const y: number = tile.y + dy;
      if (!world.contains(x, y)) continue;
      const neighborIndex = y * world.width + x;
      if (visited[neighborIndex] === 1) continue;
      visited[neighborIndex] = 1;
      if (world.tiles[neighborIndex]?.zoneType === targetZone) queue.push(neighborIndex);
    }
  }
  return output;
}

export function setZoneOverrides(
  current: readonly ZoneOverride[],
  indices: readonly number[],
  zoneType: ZoneType | null,
  locked: boolean,
  mode: 'paint' | 'erase' | 'lock' | 'unlock',
): ZoneOverride[] {
  const byIndex = new Map(current.map((override) => [override.tileIndex, override]));
  for (const index of indices) {
    const existing = byIndex.get(index);
    if (mode === 'erase') {
      if (existing?.locked) continue;
      byIndex.delete(index);
      continue;
    }
    if (mode === 'lock') {
      if (existing !== undefined) byIndex.set(index, { ...existing, locked: true });
      continue;
    }
    if (mode === 'unlock') {
      if (existing !== undefined) byIndex.set(index, { ...existing, locked: false });
      continue;
    }
    if (existing?.locked) continue;
    byIndex.set(index, { tileIndex: index, zoneType, locked });
  }
  return [...byIndex.values()].sort((left, right) => left.tileIndex - right.tileIndex);
}

export function smoothZoneOverrides(world: World, current: readonly ZoneOverride[], indices: readonly number[]): ZoneOverride[] {
  const byIndex = new Map(current.map((override) => [override.tileIndex, override]));
  const changes: ZoneOverride[] = [];
  for (const index of indices) {
    const existing = byIndex.get(index);
    if (existing?.locked) continue;
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    const counts = new Map<ZoneType | null, number>();
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const neighbor = world.getTile(tile.x + dx, tile.y + dy);
      if (neighbor === undefined) continue;
      counts.set(neighbor.zoneType, (counts.get(neighbor.zoneType) ?? 0) + 1);
    }
    const selected = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    if (selected !== undefined && selected[1] >= 3) {
      changes.push({ tileIndex: index, zoneType: selected[0], locked: false });
    }
  }
  for (const change of changes) byIndex.set(change.tileIndex, change);
  return [...byIndex.values()].sort((left, right) => left.tileIndex - right.tileIndex);
}
