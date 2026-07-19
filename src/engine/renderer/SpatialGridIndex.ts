export interface SpatialBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Lightweight deterministic uniform-grid index for viewport queries. */
export class SpatialGridIndex {
  private readonly cellSize: number;
  private readonly cells = new Map<string, number[]>();

  public constructor(cellSize = 24) {
    this.cellSize = Math.max(4, Math.floor(cellSize));
  }

  public clear(): void {
    this.cells.clear();
  }

  public insert(id: number, x: number, y: number): void {
    const key = this.keyFor(x, y);
    const values = this.cells.get(key);
    if (values === undefined) this.cells.set(key, [id]);
    else values.push(id);
  }

  public query(bounds: SpatialBounds, margin = 0): number[] {
    const leftCell = Math.floor((bounds.left - margin) / this.cellSize);
    const rightCell = Math.floor((bounds.right + margin) / this.cellSize);
    const topCell = Math.floor((bounds.top - margin) / this.cellSize);
    const bottomCell = Math.floor((bounds.bottom + margin) / this.cellSize);
    const values: number[] = [];
    for (let cellY = topCell; cellY <= bottomCell; cellY += 1) {
      for (let cellX = leftCell; cellX <= rightCell; cellX += 1) {
        const entries = this.cells.get(`${cellX}:${cellY}`);
        if (entries !== undefined) values.push(...entries);
      }
    }
    return values;
  }

  private keyFor(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
  }
}
