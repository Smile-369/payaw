import type { ZoneType } from '../zoning/Zone';

export enum AnchorType {
  Church = 'church',
  TownPlaza = 'town-plaza',
  Market = 'market',
  School = 'school',
  Hospital = 'hospital',
  Port = 'port',
  Airport = 'airport',
  RiceFields = 'rice-fields',
  Hacienda = 'hacienda',
  Custom = 'custom',
}

export enum AnchorSource {
  BuiltIn = 'built-in',
  Custom = 'custom',
}

export enum AnchorRegionPreference {
  Anywhere = 'anywhere',
  TownCenter = 'town-center',
  North = 'north',
  South = 'south',
  East = 'east',
  West = 'west',
}

export enum AnchorTerrainPreference {
  SafeLand = 'safe-land',
  FlatLand = 'flat-land',
  Coast = 'coast',
  River = 'river',
  ForestEdge = 'forest-edge',
  Farmland = 'farmland',
  HighGround = 'high-ground',
  DryLand = 'dry-land',
}

export enum AnchorProximityBand {
  None = 'none',
  Adjacent = 'adjacent',
  Near = 'near',
  Outskirts = 'outskirts',
  Far = 'far',
}

export type BuiltInAnchorType = Exclude<AnchorType, AnchorType.Custom>;

export interface AnchorRuleSettings {
  readonly name: string;
  readonly region: AnchorRegionPreference;
  readonly terrain: AnchorTerrainPreference;
  readonly targetAnchor: BuiltInAnchorType | null;
  readonly proximity: AnchorProximityBand;
  readonly radius: number;
  readonly minimumDistance: number;
  /** The zone this anchor should establish around itself after road/block generation. */
  readonly zoneType: ZoneType | null;
}

export interface CustomAnchorDefinition extends AnchorRuleSettings {
  readonly id: string;
}

export interface BuiltInAnchorOverride extends AnchorRuleSettings {
  readonly type: BuiltInAnchorType;
}

export interface Anchor {
  readonly id: number;
  readonly key: string;
  readonly type: AnchorType;
  readonly name: string;
  readonly source: AnchorSource;
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly placementScore: number;
  readonly zoneType: ZoneType | null;
  readonly customRule: CustomAnchorDefinition | null;
  readonly builtInOverride: BuiltInAnchorOverride | null;
}

export const BUILT_IN_ANCHOR_TYPES: readonly BuiltInAnchorType[] = [
  AnchorType.TownPlaza,
  AnchorType.Church,
  AnchorType.Market,
  AnchorType.School,
  AnchorType.Hospital,
  AnchorType.Port,
  AnchorType.Airport,
  AnchorType.RiceFields,
  AnchorType.Hacienda,
];

export const ANCHOR_LABELS: Readonly<Record<AnchorType, string>> = {
  [AnchorType.Church]: 'Church',
  [AnchorType.TownPlaza]: 'Town Plaza',
  [AnchorType.Market]: 'Market',
  [AnchorType.School]: 'School',
  [AnchorType.Hospital]: 'Hospital',
  [AnchorType.Port]: 'Port',
  [AnchorType.Airport]: 'Airport',
  [AnchorType.RiceFields]: 'Rice Fields',
  [AnchorType.Hacienda]: 'Hacienda',
  [AnchorType.Custom]: 'Custom Anchor',
};
