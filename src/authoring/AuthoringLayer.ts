import { TerrainType, WaterType } from '../engine/world/Tile';

export type SettlementKind =
  | 'city'
  | 'town'
  | 'barangay'
  | 'subdivision'
  | 'neighborhood'
  | 'village'
  | 'sitio'
  | 'district'
  | 'compound'
  | 'custom';

export type AuthoringVisibility = 'gm-only' | 'players' | 'hidden';
export type AuthoringRealityLayer = 'normal' | 'hidden-payaw';
export type AuthoringFeatureCategory =
  | 'terrain'
  | 'river'
  | 'road'
  | 'building'
  | 'district'
  | 'landmark'
  | 'infrastructure'
  | 'natural'
  | 'label'
  | 'hidden-payaw';

export interface AuthoringPoint {
  readonly x: number;
  readonly y: number;
}

export type AuthoringGeometry =
  | { readonly kind: 'point'; readonly point: AuthoringPoint }
  | { readonly kind: 'circle'; readonly center: AuthoringPoint; readonly radius: number }
  | { readonly kind: 'polyline'; readonly points: readonly AuthoringPoint[] }
  | { readonly kind: 'polygon'; readonly points: readonly AuthoringPoint[] };

export interface AuthoredSettlementDefinition {
  readonly key: string;
  readonly name: string;
  readonly kind: SettlementKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly rotation: number;
  readonly populationTarget: number;
  readonly density: number;
  readonly parentKey: string | null;
  readonly generateRoads: boolean;
  readonly generateBuildings: boolean;
  readonly locked: boolean;
  readonly hidden: boolean;
  readonly visibility: AuthoringVisibility;
  readonly notes: string;
}

export interface SettlementAuthoringOverride {
  readonly key: string;
  readonly name?: string | undefined;
  readonly kind?: SettlementKind | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly radius?: number | undefined;
  readonly rotation?: number | undefined;
  readonly populationTarget?: number | undefined;
  readonly density?: number | undefined;
  readonly generateRoads?: boolean | undefined;
  readonly generateBuildings?: boolean | undefined;
  readonly parentKey?: string | null | undefined;
  readonly locked?: boolean | undefined;
  readonly hidden?: boolean | undefined;
  readonly visibility?: AuthoringVisibility | undefined;
  readonly suppressed?: boolean | undefined;
  readonly notes?: string | undefined;
}

export interface TerrainTileOverride {
  readonly tileIndex: number;
  readonly terrain?: TerrainType | undefined;
  readonly water?: WaterType | undefined;
  readonly elevation?: number | undefined;
  readonly elevationDelta?: number | undefined;
  readonly moisture?: number | undefined;
  readonly forestDensity?: number | undefined;
  readonly floodRisk?: number | undefined;
  readonly river?: boolean | undefined;
  readonly locked: boolean;
}

export interface GeneratedFeatureOverride {
  readonly key: string;
  readonly entityType: 'road' | 'building' | 'river' | 'settlement' | 'district' | 'label' | 'landmark';
  readonly entityId?: number | undefined;
  readonly name?: string | undefined;
  readonly hidden?: boolean | undefined;
  readonly suppressed?: boolean | undefined;
  readonly locked?: boolean | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly rotation?: number | undefined;
  readonly scale?: number | undefined;
  readonly aliases?: readonly string[] | undefined;
  readonly notes?: string | undefined;
}

export interface AuthoredMapFeature {
  readonly id: string;
  readonly name: string;
  readonly category: AuthoringFeatureCategory;
  readonly subtype: string;
  readonly geometry: AuthoringGeometry;
  readonly realityLayer: AuthoringRealityLayer;
  readonly visibility: AuthoringVisibility;
  readonly locked: boolean;
  readonly hidden: boolean;
  readonly opacity: number;
  readonly lineWidth: number;
  readonly fillOpacity: number;
  readonly color: string | null;
  readonly rotation: number;
  readonly scale: number;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthoringLayerState {
  readonly authoredSettlements: readonly AuthoredSettlementDefinition[];
  readonly settlementOverrides: readonly SettlementAuthoringOverride[];
  readonly terrainOverrides: readonly TerrainTileOverride[];
  readonly generatedFeatureOverrides: readonly GeneratedFeatureOverride[];
  readonly features: readonly AuthoredMapFeature[];
}

export const EMPTY_AUTHORING_LAYER: AuthoringLayerState = {
  authoredSettlements: [],
  settlementOverrides: [],
  terrainOverrides: [],
  generatedFeatureOverrides: [],
  features: [],
};

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function authoredFeatureBounds(feature: AuthoredMapFeature): { left: number; top: number; right: number; bottom: number } {
  const geometry = feature.geometry;
  if (geometry.kind === 'point') {
    return { left: geometry.point.x, top: geometry.point.y, right: geometry.point.x, bottom: geometry.point.y };
  }
  if (geometry.kind === 'circle') {
    return {
      left: geometry.center.x - geometry.radius,
      top: geometry.center.y - geometry.radius,
      right: geometry.center.x + geometry.radius,
      bottom: geometry.center.y + geometry.radius,
    };
  }
  const xs = geometry.points.map((point) => point.x);
  const ys = geometry.points.map((point) => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}
