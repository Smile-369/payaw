import type { GridPoint } from '../blocks/Block';
import type { RiverCourse } from '../world/Tile';

export enum RiverTerminus {
  Ocean = 'ocean',
  Confluence = 'confluence',
}

export interface RiverSample extends GridPoint {
  readonly tileIndex: number;
  readonly discharge: number;
  readonly width: number;
  readonly depth: number;
  readonly course: RiverCourse;
}

export interface River {
  readonly id: number;
  readonly sourceIndex: number;
  readonly mouthIndex: number;
  readonly path: readonly number[];
  readonly centerline: readonly RiverSample[];
  readonly distributaries: readonly (readonly number[])[];
  readonly deltaTileIndices: readonly number[];
  readonly length: number;
  readonly maximumDischarge: number;
  readonly maximumWidth: number;
  readonly maximumDepth: number;
  readonly terminus: RiverTerminus;
  readonly tributaryOf: number | null;
}
