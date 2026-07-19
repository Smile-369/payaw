import { AnchorType } from '../settlement/Anchor';
import { ZoneType } from '../zoning/Zone';
import { BuildingType } from './Building';

export interface BuildingTemplate {
  readonly id: string;
  readonly type: BuildingType;
  readonly allowedZones: readonly ZoneType[];
  readonly minimumWidth: number;
  readonly maximumWidth: number;
  readonly minimumDepth: number;
  readonly maximumDepth: number;
  readonly minimumStories: number;
  readonly maximumStories: number;
  readonly weight: number;
  readonly anchorType?: AnchorType;
}

export const BUILDING_TEMPLATES: readonly BuildingTemplate[] = [
  { id: 'bahay-01', type: BuildingType.FilipinoHouse, allowedZones: [ZoneType.Residential, ZoneType.Mixed], minimumWidth: 2, maximumWidth: 4, minimumDepth: 2, maximumDepth: 4, minimumStories: 1, maximumStories: 2, weight: 8 },
  { id: 'nipa-01', type: BuildingType.NipaHut, allowedZones: [ZoneType.Residential, ZoneType.Agricultural], minimumWidth: 2, maximumWidth: 3, minimumDepth: 2, maximumDepth: 3, minimumStories: 1, maximumStories: 1, weight: 2.8 },
  { id: 'townhouse-01', type: BuildingType.TownHouse, allowedZones: [ZoneType.Residential, ZoneType.Mixed], minimumWidth: 3, maximumWidth: 5, minimumDepth: 4, maximumDepth: 7, minimumStories: 2, maximumStories: 3, weight: 2.4 },
  { id: 'boarding-house-01', type: BuildingType.BoardingHouse, allowedZones: [ZoneType.Residential, ZoneType.Mixed], minimumWidth: 4, maximumWidth: 7, minimumDepth: 4, maximumDepth: 7, minimumStories: 2, maximumStories: 4, weight: 1.5 },
  { id: 'mansion-01', type: BuildingType.Mansion, allowedZones: [ZoneType.Residential], minimumWidth: 6, maximumWidth: 10, minimumDepth: 6, maximumDepth: 10, minimumStories: 2, maximumStories: 3, weight: 0.3 },
  { id: 'condominium-01', type: BuildingType.Condominium, allowedZones: [ZoneType.Residential, ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 6, maximumWidth: 10, minimumDepth: 6, maximumDepth: 10, minimumStories: 5, maximumStories: 12, weight: 0.38 },
  { id: 'apartment-01', type: BuildingType.Apartment, allowedZones: [ZoneType.Residential, ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 3, maximumWidth: 6, minimumDepth: 3, maximumDepth: 5, minimumStories: 2, maximumStories: 4, weight: 3 },
  { id: 'subdivision-01', type: BuildingType.Subdivision, allowedZones: [ZoneType.Residential], minimumWidth: 6, maximumWidth: 10, minimumDepth: 5, maximumDepth: 9, minimumStories: 1, maximumStories: 2, weight: 0.8 },
  { id: 'court-01', type: BuildingType.BasketballCourt, allowedZones: [ZoneType.Residential, ZoneType.Government, ZoneType.Institutional], minimumWidth: 7, maximumWidth: 9, minimumDepth: 11, maximumDepth: 13, minimumStories: 1, maximumStories: 1, weight: 0.45 },
  { id: 'sari-sari-01', type: BuildingType.SariSariStore, allowedZones: [ZoneType.Residential, ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 2, maximumWidth: 3, minimumDepth: 2, maximumDepth: 3, minimumStories: 1, maximumStories: 2, weight: 5 },
  { id: 'convenience-01', type: BuildingType.ConvenienceStore, allowedZones: [ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 3, maximumWidth: 5, minimumDepth: 3, maximumDepth: 5, minimumStories: 1, maximumStories: 2, weight: 1.6 },
  { id: 'mall-01', type: BuildingType.Mall, allowedZones: [ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 10, maximumWidth: 18, minimumDepth: 8, maximumDepth: 15, minimumStories: 2, maximumStories: 5, weight: 0.16 },
  { id: 'cinema-01', type: BuildingType.Cinema, allowedZones: [ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 7, maximumWidth: 12, minimumDepth: 7, maximumDepth: 12, minimumStories: 1, maximumStories: 3, weight: 0.28 },
  { id: 'restaurant-01', type: BuildingType.Restaurant, allowedZones: [ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 3, maximumWidth: 6, minimumDepth: 3, maximumDepth: 6, minimumStories: 1, maximumStories: 2, weight: 1.7 },
  { id: 'cafe-01', type: BuildingType.Cafe, allowedZones: [ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 2, maximumWidth: 4, minimumDepth: 2, maximumDepth: 4, minimumStories: 1, maximumStories: 2, weight: 1.4 },
  { id: 'hotel-01', type: BuildingType.Hotel, allowedZones: [ZoneType.Commercial, ZoneType.Mixed], minimumWidth: 6, maximumWidth: 11, minimumDepth: 5, maximumDepth: 9, minimumStories: 3, maximumStories: 8, weight: 0.45 },
  { id: 'office-01', type: BuildingType.OfficeBuilding, allowedZones: [ZoneType.Commercial, ZoneType.Government, ZoneType.Mixed], minimumWidth: 5, maximumWidth: 9, minimumDepth: 5, maximumDepth: 9, minimumStories: 2, maximumStories: 7, weight: 0.75 },
  { id: 'gas-station-01', type: BuildingType.GasStation, allowedZones: [ZoneType.Commercial, ZoneType.Industrial], minimumWidth: 6, maximumWidth: 9, minimumDepth: 5, maximumDepth: 8, minimumStories: 1, maximumStories: 1, weight: 0.6 },
  { id: 'warehouse-01', type: BuildingType.Warehouse, allowedZones: [ZoneType.Industrial], minimumWidth: 6, maximumWidth: 12, minimumDepth: 5, maximumDepth: 10, minimumStories: 1, maximumStories: 2, weight: 5 },
  { id: 'factory-01', type: BuildingType.Factory, allowedZones: [ZoneType.Industrial], minimumWidth: 8, maximumWidth: 16, minimumDepth: 7, maximumDepth: 14, minimumStories: 1, maximumStories: 3, weight: 1.6 },
  { id: 'farm-house-01', type: BuildingType.FarmHouse, allowedZones: [ZoneType.Agricultural], minimumWidth: 3, maximumWidth: 6, minimumDepth: 3, maximumDepth: 6, minimumStories: 1, maximumStories: 2, weight: 1.8 },
  { id: 'fishing-village-01', type: BuildingType.FishingVillage, allowedZones: [ZoneType.Residential, ZoneType.Industrial], minimumWidth: 4, maximumWidth: 8, minimumDepth: 3, maximumDepth: 6, minimumStories: 1, maximumStories: 2, weight: 0.7 },
  { id: 'rice-field-01', type: BuildingType.RiceField, allowedZones: [ZoneType.Agricultural], minimumWidth: 5, maximumWidth: 11, minimumDepth: 5, maximumDepth: 11, minimumStories: 1, maximumStories: 1, weight: 9 },
  { id: 'church-main', type: BuildingType.Church, allowedZones: [ZoneType.Institutional, ZoneType.Government], minimumWidth: 4, maximumWidth: 6, minimumDepth: 6, maximumDepth: 9, minimumStories: 2, maximumStories: 3, weight: 1, anchorType: AnchorType.Church },
  { id: 'school-main', type: BuildingType.School, allowedZones: [ZoneType.Institutional], minimumWidth: 5, maximumWidth: 9, minimumDepth: 5, maximumDepth: 8, minimumStories: 2, maximumStories: 4, weight: 1, anchorType: AnchorType.School },
  { id: 'hospital-main', type: BuildingType.Hospital, allowedZones: [ZoneType.Institutional], minimumWidth: 5, maximumWidth: 9, minimumDepth: 5, maximumDepth: 8, minimumStories: 2, maximumStories: 5, weight: 1, anchorType: AnchorType.Hospital },
  { id: 'barangay-hall-main', type: BuildingType.BarangayHall, allowedZones: [ZoneType.Government], minimumWidth: 3, maximumWidth: 6, minimumDepth: 3, maximumDepth: 6, minimumStories: 1, maximumStories: 3, weight: 1, anchorType: AnchorType.TownPlaza },
  { id: 'public-market-main', type: BuildingType.PublicMarket, allowedZones: [ZoneType.Commercial, ZoneType.Government], minimumWidth: 5, maximumWidth: 10, minimumDepth: 5, maximumDepth: 8, minimumStories: 1, maximumStories: 2, weight: 1, anchorType: AnchorType.Market },
  { id: 'airport-terminal-main', type: BuildingType.AirportTerminal, allowedZones: [ZoneType.Industrial], minimumWidth: 6, maximumWidth: 11, minimumDepth: 4, maximumDepth: 7, minimumStories: 1, maximumStories: 2, weight: 1, anchorType: AnchorType.Airport },
  { id: 'port-main', type: BuildingType.PortFacility, allowedZones: [ZoneType.Industrial], minimumWidth: 5, maximumWidth: 9, minimumDepth: 4, maximumDepth: 7, minimumStories: 1, maximumStories: 2, weight: 1, anchorType: AnchorType.Port },
];

export function templatesForZone(zone: ZoneType): readonly BuildingTemplate[] {
  return BUILDING_TEMPLATES.filter((template) => template.anchorType === undefined && template.allowedZones.includes(zone));
}

export function templateForAnchor(anchorType: AnchorType): BuildingTemplate | undefined {
  return BUILDING_TEMPLATES.find((template) => template.anchorType === anchorType);
}
