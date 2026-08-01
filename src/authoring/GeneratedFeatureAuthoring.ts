import { createRuleId } from '../utils/Identifiers';
import type { AuthoredMapFeature, AuthoringGeometry } from './AuthoringLayer';

export type GeneratedFeatureEntityType = 'road' | 'building';

function generatedSourceTag(entityType: GeneratedFeatureEntityType, entityId: number): string {
  return `generated-source:${entityType}:${entityId}`;
}

export function generatedSourceForFeature(
  feature: AuthoredMapFeature,
): { readonly entityType: GeneratedFeatureEntityType; readonly entityId: number } | null {
  for (const tag of feature.tags) {
    const match = /^generated-source:(road|building):(\d+)$/.exec(tag);
    if (match === null) continue;
    const entityId = Number(match[2]);
    if (Number.isInteger(entityId)) return { entityType: match[1] as GeneratedFeatureEntityType, entityId };
  }
  return null;
}

export function createGeneratedReplacementFeature(
  name: string,
  category: GeneratedFeatureEntityType,
  subtype: string,
  geometry: AuthoringGeometry,
  entityId: number,
): AuthoredMapFeature {
  const now = new Date().toISOString();
  return {
    id: createRuleId(),
    name,
    category,
    subtype,
    geometry,
    realityLayer: 'normal',
    visibility: 'players',
    locked: false,
    hidden: false,
    opacity: 0.94,
    lineWidth: category === 'road' ? 2 : 1.2,
    fillOpacity: category === 'building' ? 0.48 : 0,
    color: category === 'road' ? '#d1aa72' : '#d9c8a7',
    rotation: 0,
    scale: 1,
    aliases: [],
    tags: [generatedSourceTag(category, entityId)],
    notes: `Authored replacement for generated ${category} #${entityId}. Reset this feature to restore the generated original.`,
    createdAt: now,
    updatedAt: now,
  };
}
