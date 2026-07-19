import type { GridPoint } from '../geography/Landmass';

export enum PortType {
  FishingDock = 'fishing-dock',
  BarangayJetty = 'barangay-jetty',
  FerryTerminal = 'ferry-terminal',
  CommercialPort = 'commercial-port',
  IndustrialPort = 'industrial-port',
  Marina = 'marina',
}

export interface Port {
  readonly id: number;
  readonly key: string;
  name: string;
  readonly islandId: number;
  readonly settlementId: number | null;
  readonly position: GridPoint;
  readonly tileIndex: number;
  readonly waterPosition: GridPoint;
  readonly waterTileIndex: number;
  type: PortType;
  capacity: number;
  readonly waterDepth: number;
  readonly shelteredScore: number;
  readonly roadAccessDistance: number;
  accessRoadId: number | null;
  routeIds: number[];
  readonly generated: boolean;
  locked: boolean;
}

export interface PortOverride {
  readonly key: string;
  readonly name?: string;
  readonly type?: PortType;
  readonly capacity?: number;
  readonly position?: GridPoint;
  readonly locked?: boolean;
  readonly suppressed?: boolean;
}

export interface CustomPortDefinition {
  readonly key: string;
  readonly name: string;
  readonly islandKey: string;
  readonly type: PortType;
  readonly capacity: number;
  readonly position?: GridPoint;
  readonly locked: boolean;
}

export const PORT_TYPE_LABELS: Readonly<Record<PortType, string>> = {
  [PortType.FishingDock]: 'Fishing dock',
  [PortType.BarangayJetty]: 'Barangay jetty',
  [PortType.FerryTerminal]: 'Ferry terminal',
  [PortType.CommercialPort]: 'Commercial port',
  [PortType.IndustrialPort]: 'Industrial port',
  [PortType.Marina]: 'Marina',
};
