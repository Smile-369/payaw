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
  readonly islandId: number;
  name: string;
  readonly type: SettlementType;
  x: number;
  y: number;
  tileIndex: number;
  readonly influenceRadius: number;
  readonly populationTarget: number;
  readonly isPrimary: boolean;
  roadIds: number[];
}
