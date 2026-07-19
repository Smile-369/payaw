export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface Block {
  readonly id: number;
  name: string;
  readonly tileIndices: readonly number[];
  readonly boundary: readonly GridPoint[];
  readonly holes: readonly (readonly GridPoint[])[];
  readonly centroid: GridPoint;
  readonly area: number;
  readonly perimeter: number;
  readonly roadFrontage: number;
  averageAccessibility: number;
  averageLandValue: number;
  zoneId: number | null;
}
