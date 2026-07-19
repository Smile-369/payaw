import type { GridPoint } from '../geography/Landmass';

export enum WaterRouteType {
  FishingRoute = 'fishing-route',
  PassengerFerry = 'passenger-ferry',
  CargoRoute = 'cargo-route',
  CoastalRoute = 'coastal-route',
  OpenWaterRoute = 'open-water-route',
  SmugglingRoute = 'smuggling-route',
  StoryRoute = 'story-route',
}

export enum VesselClass {
  SmallBoat = 'small-boat',
  Ferry = 'ferry',
  CargoVessel = 'cargo-vessel',
}

export enum MaritimeDanger {
  Low = 'low',
  Moderate = 'moderate',
  High = 'high',
  Severe = 'severe',
}

export interface MaritimeEncounter {
  readonly weight: number;
  readonly danger: MaritimeDanger;
  readonly title: string;
  readonly description: string;
}

export interface WaterRoute {
  readonly id: number;
  readonly key: string;
  name: string;
  readonly fromPortId: number;
  readonly toPortId: number;
  type: WaterRouteType;
  vesselClass: VesselClass;
  readonly tileIndices: readonly number[];
  readonly centerline: readonly GridPoint[];
  readonly distance: number;
  estimatedTravelTimeMinutes: number;
  dangerRating: number;
  encounters: readonly MaritimeEncounter[];
  readonly generated: boolean;
  enabled: boolean;
  locked: boolean;
}

export interface WaterRouteOverride {
  readonly key: string;
  readonly name?: string;
  readonly type?: WaterRouteType;
  readonly vesselClass?: VesselClass;
  readonly estimatedTravelTimeMinutes?: number;
  readonly dangerRating?: number;
  readonly enabled?: boolean;
  readonly locked?: boolean;
  readonly suppressed?: boolean;
}

export interface CustomWaterRouteDefinition {
  readonly key: string;
  readonly name: string;
  readonly fromPortKey: string;
  readonly toPortKey: string;
  readonly type: WaterRouteType;
  readonly vesselClass: VesselClass;
  readonly enabled: boolean;
  readonly locked: boolean;
}

export const WATER_ROUTE_TYPE_LABELS: Readonly<Record<WaterRouteType, string>> = {
  [WaterRouteType.FishingRoute]: 'Fishing route',
  [WaterRouteType.PassengerFerry]: 'Passenger ferry',
  [WaterRouteType.CargoRoute]: 'Cargo route',
  [WaterRouteType.CoastalRoute]: 'Coastal route',
  [WaterRouteType.OpenWaterRoute]: 'Open-water route',
  [WaterRouteType.SmugglingRoute]: 'Smuggling route',
  [WaterRouteType.StoryRoute]: 'Story route',
};

export const VESSEL_CLASS_LABELS: Readonly<Record<VesselClass, string>> = {
  [VesselClass.SmallBoat]: 'Small boat',
  [VesselClass.Ferry]: 'Ferry',
  [VesselClass.CargoVessel]: 'Cargo vessel',
};
