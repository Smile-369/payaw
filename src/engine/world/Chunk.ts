export const DEFAULT_CHUNK_SIZE = 32;

export interface ChunkCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface ChunkBounds {
  readonly coordinate: ChunkCoordinate;
  readonly startX: number;
  readonly startY: number;
  readonly endXExclusive: number;
  readonly endYExclusive: number;
}

export function getChunkBounds(
  coordinate: ChunkCoordinate,
  worldWidth: number,
  worldHeight: number,
  chunkSize = DEFAULT_CHUNK_SIZE,
): ChunkBounds {
  const startX = coordinate.x * chunkSize;
  const startY = coordinate.y * chunkSize;

  return {
    coordinate,
    startX,
    startY,
    endXExclusive: Math.min(startX + chunkSize, worldWidth),
    endYExclusive: Math.min(startY + chunkSize, worldHeight),
  };
}
