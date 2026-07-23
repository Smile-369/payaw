import type { AuthoringVisibility, SettlementKind } from '../../authoring/AuthoringLayer';
export enum SettlementType {
  City = 'city',
  Town = 'town',
  Village = 'village',
  Hamlet = 'hamlet',
  AgriculturalCommunity = 'agricultural-community',
  PortCommunity = 'port-community',
  IndustrialDistrict = 'industrial-district',
}

export interface Settlement {
  readonly id: number;
  readonly key: string;
  islandId: number;
  name: string;
  readonly type: SettlementType;
  x: number;
  y: number;
  tileIndex: number;
  readonly influenceRadius: number;
  readonly populationTarget: number;
  readonly isPrimary: boolean;
  readonly source?: 'generated' | 'authored';
  readonly kind?: SettlementKind;
  readonly parentKey?: string | null;
  readonly rotation?: number;
  readonly density?: number;
  readonly locked?: boolean;
  readonly hidden?: boolean;
  readonly visibility?: AuthoringVisibility;
  readonly notes?: string;
  readonly generateRoads?: boolean;
  readonly generateBuildings?: boolean;
  roadIds: number[];
}
