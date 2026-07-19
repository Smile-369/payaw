import type { GridPoint } from '../blocks/Block';

export enum ZoneType {
  Commercial = 'commercial',
  Residential = 'residential',
  Industrial = 'industrial',
  Agricultural = 'agricultural',
  Institutional = 'institutional',
  Government = 'government',
  Forest = 'forest',
  Mixed = 'mixed',
}

export interface Zone {
  readonly id: number;
  readonly type: ZoneType;
  readonly tileIndices: readonly number[];
  readonly blockIds: readonly number[];
  readonly centroid: GridPoint;
  readonly area: number;
  readonly averageLandValue: number;
}
