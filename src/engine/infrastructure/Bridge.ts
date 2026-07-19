import type { GridPoint } from '../geography/Landmass';
import type { RoadType } from './Road';

export enum BridgeType {
  Footbridge = 'footbridge',
  Causeway = 'causeway',
  LocalBridge = 'local-bridge',
  HighwayBridge = 'highway-bridge',
  LongSpanBridge = 'long-span-bridge',
}

export interface Bridge {
  readonly id: number;
  readonly key: string;
  name: string;
  readonly fromIslandId: number;
  readonly toIslandId: number;
  readonly start: GridPoint;
  readonly end: GridPoint;
  readonly startTileIndex: number;
  readonly endTileIndex: number;
  readonly centerline: readonly GridPoint[];
  readonly deckTileIndices: readonly number[];
  type: BridgeType;
  roadClass: RoadType;
  readonly length: number;
  deckWidth: number;
  clearance: number;
  approachRoadIds: number[];
  deckRoadId: number | null;
  readonly supportPoints: readonly GridPoint[];
  readonly generated: boolean;
  locked: boolean;
}

export interface BridgeOverride {
  readonly key: string;
  readonly name?: string;
  readonly type?: BridgeType;
  readonly roadClass?: RoadType;
  readonly deckWidth?: number;
  readonly clearance?: number;
  readonly start?: GridPoint;
  readonly end?: GridPoint;
  readonly locked?: boolean;
  readonly suppressed?: boolean;
}

export interface CustomBridgeDefinition {
  readonly key: string;
  readonly name: string;
  readonly fromIslandKey: string;
  readonly toIslandKey: string;
  readonly type: BridgeType;
  readonly roadClass: RoadType;
  readonly deckWidth: number;
  readonly clearance: number;
  readonly start?: GridPoint;
  readonly end?: GridPoint;
  readonly locked: boolean;
}

export const BRIDGE_TYPE_LABELS: Readonly<Record<BridgeType, string>> = {
  [BridgeType.Footbridge]: 'Footbridge',
  [BridgeType.Causeway]: 'Causeway',
  [BridgeType.LocalBridge]: 'Local bridge',
  [BridgeType.HighwayBridge]: 'Highway bridge',
  [BridgeType.LongSpanBridge]: 'Long-span bridge',
};
