import { MinPriorityQueue } from '../math/MinPriorityQueue';
import type { World } from '../world/World';

export interface GridPathOptions {
  readonly startIndex: number;
  readonly goalIndex: number;
  readonly traversalCost: (fromIndex: number, toIndex: number) => number;
  readonly heuristicScale?: number;
  readonly maximumVisited?: number;
}

const DIRECTIONS: readonly (readonly [number, number, number])[] = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
];

function heuristic(world: World, index: number, goalIndex: number, scale: number): number {
  const x = index % world.width;
  const y = Math.floor(index / world.width);
  const goalX = goalIndex % world.width;
  const goalY = Math.floor(goalIndex / world.width);
  return Math.hypot(goalX - x, goalY - y) * scale;
}

function reconstructPath(cameFrom: Int32Array, startIndex: number, goalIndex: number): readonly number[] {
  const path: number[] = [goalIndex];
  let current = goalIndex;
  while (current !== startIndex) {
    const parent = cameFrom[current];
    if (parent === undefined || parent < 0) {
      return [];
    }
    current = parent;
    path.push(current);
  }
  path.reverse();
  return path;
}

export function findGridPath(world: World, options: GridPathOptions): readonly number[] {
  const { startIndex, goalIndex, traversalCost } = options;
  if (world.tiles[startIndex] === undefined || world.tiles[goalIndex] === undefined) {
    throw new RangeError('Path endpoints must reference valid world tiles.');
  }
  if (startIndex === goalIndex) {
    return [startIndex];
  }

  const heuristicScale = options.heuristicScale ?? 0.65;
  const maximumVisited = options.maximumVisited ?? world.tiles.length;
  const open = new MinPriorityQueue();
  const cameFrom = new Int32Array(world.tiles.length);
  cameFrom.fill(-1);
  const costSoFar = new Float64Array(world.tiles.length);
  costSoFar.fill(Number.POSITIVE_INFINITY);
  costSoFar[startIndex] = 0;
  open.push({ index: startIndex, priority: heuristic(world, startIndex, goalIndex, heuristicScale) });
  let visited = 0;

  while (open.size > 0 && visited < maximumVisited) {
    const currentEntry = open.pop();
    if (currentEntry === undefined) {
      break;
    }
    const current = currentEntry.index;
    if (current === goalIndex) {
      return reconstructPath(cameFrom, startIndex, goalIndex);
    }
    visited += 1;

    const currentX = current % world.width;
    const currentY = Math.floor(current / world.width);
    const currentCost = costSoFar[current];
    if (currentCost === undefined || !Number.isFinite(currentCost)) {
      continue;
    }

    for (const [offsetX, offsetY, distance] of DIRECTIONS) {
      const nextX = currentX + offsetX;
      const nextY = currentY + offsetY;
      if (!world.contains(nextX, nextY)) {
        continue;
      }
      const next = nextY * world.width + nextX;
      const baseCost = traversalCost(current, next);
      if (!Number.isFinite(baseCost)) {
        continue;
      }
      const nextCost = currentCost + baseCost * distance;
      const knownCost = costSoFar[next];
      if (knownCost !== undefined && nextCost >= knownCost) {
        continue;
      }

      costSoFar[next] = nextCost;
      cameFrom[next] = current;
      open.push({
        index: next,
        priority: nextCost + heuristic(world, next, goalIndex, heuristicScale),
      });
    }
  }

  return [];
}
