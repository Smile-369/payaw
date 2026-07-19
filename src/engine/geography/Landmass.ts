export interface GridBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

/** A physically connected component of land tiles. Tiny rocks remain landmasses even when they are not promoted to islands. */
export interface Landmass {
  readonly id: number;
  readonly key: string;
  readonly tileIndices: readonly number[];
  readonly coastlineTileIndices: readonly number[];
  readonly simplifiedCoastline: readonly GridPoint[];
  readonly area: number;
  readonly coastlineLength: number;
  readonly bounds: GridBounds;
  readonly centroid: GridPoint;
  readonly averageElevation: number;
  readonly averageSlope: number;
  readonly averageFloodRisk: number;
  readonly averageMoisture: number;
  readonly averageForestDensity: number;
  readonly freshwaterScore: number;
  readonly buildableArea: number;
}
