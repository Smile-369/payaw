import type { GridPoint } from '../blocks/Block';

export enum BuildingType {
  FilipinoHouse = 'filipino-house',
  NipaHut = 'nipa-hut',
  TownHouse = 'town-house',
  BoardingHouse = 'boarding-house',
  Mansion = 'mansion',
  Condominium = 'condominium',
  Apartment = 'apartment',
  Subdivision = 'subdivision',
  BasketballCourt = 'basketball-court',
  SariSariStore = 'sari-sari-store',
  ConvenienceStore = 'convenience-store',
  Mall = 'mall',
  Cinema = 'cinema',
  Restaurant = 'restaurant',
  Cafe = 'cafe',
  Hotel = 'hotel',
  OfficeBuilding = 'office-building',
  GasStation = 'gas-station',
  School = 'school',
  Hospital = 'hospital',
  Church = 'church',
  RiceField = 'rice-field',
  Warehouse = 'warehouse',
  Factory = 'factory',
  FarmHouse = 'farm-house',
  FishingVillage = 'fishing-village',
  BarangayHall = 'barangay-hall',
  PublicMarket = 'public-market',
  AirportTerminal = 'airport-terminal',
  PortFacility = 'port-facility',
}

export enum BuildingCondition {
  New = 'new',
  Maintained = 'maintained',
  Weathered = 'weathered',
  Dilapidated = 'dilapidated',
}

export interface BuildingEntrance extends GridPoint {
  readonly roadTileIndex: number;
}

export interface Building {
  readonly id: number;
  /** Stable identity before authoring suppression and runtime reindexing. */
  readonly generatedId?: number;
  readonly type: BuildingType;
  readonly templateId: string;
  readonly blockId: number | null;
  readonly zoneId: number | null;
  readonly tileIndices: readonly number[];
  readonly footprint: readonly GridPoint[];
  readonly entrance: BuildingEntrance;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly stories: number;
  readonly condition: BuildingCondition;
  readonly anchorId: number | null;
  readonly source?: 'generated' | 'authored';
  readonly authoringFeatureId?: string;
  readonly authoredName?: string;
}
