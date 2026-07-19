import { BuildingType } from '../engine/buildings/Building';
import { RoadType } from '../engine/infrastructure/Road';
import { AnchorType } from '../engine/settlement/Anchor';
import { VegetationType } from '../engine/vegetation/Vegetation';
import { StoryObjectType } from '../story/StoryObject';
import { AssetTargetCategory } from './Customization';

export interface AssetTargetOption {
  readonly value: string;
  readonly label: string;
}

export const ASSET_CATEGORY_LABELS: Readonly<Record<AssetTargetCategory, string>> = {
  [AssetTargetCategory.Map]: 'Map decoration only',
  [AssetTargetCategory.Building]: 'Generated building',
  [AssetTargetCategory.Story]: 'Story point',
  [AssetTargetCategory.Anchor]: 'Anchor',
  [AssetTargetCategory.Vegetation]: 'Vegetation',
  [AssetTargetCategory.Infrastructure]: 'Infrastructure / prop',
};

export function humanizeIdentifier(value: string): string {
  return value.split('-').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

const INFRASTRUCTURE_TARGETS: readonly AssetTargetOption[] = [
  { value: `road-${RoadType.Main}`, label: 'Main road marker' },
  { value: `road-${RoadType.Secondary}`, label: 'Secondary road marker' },
  { value: `road-${RoadType.Local}`, label: 'Local road marker' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'street-light', label: 'Street light' },
  { value: 'power-pole', label: 'Power pole' },
  { value: 'fence', label: 'Fence' },
  { value: 'bench', label: 'Bench' },
  { value: 'bus-stop', label: 'Bus stop' },
  { value: 'waiting-shed', label: 'Waiting shed' },
  { value: 'road-sign', label: 'Road sign' },
];

export function assetTargetsFor(category: AssetTargetCategory): readonly AssetTargetOption[] {
  switch (category) {
    case AssetTargetCategory.Map:
      return [];
    case AssetTargetCategory.Building:
      return Object.values(BuildingType).map((value) => ({ value, label: humanizeIdentifier(value) }));
    case AssetTargetCategory.Story:
      return Object.values(StoryObjectType).map((value) => ({ value, label: humanizeIdentifier(value) }));
    case AssetTargetCategory.Anchor:
      return Object.values(AnchorType).map((value) => ({ value, label: humanizeIdentifier(value) }));
    case AssetTargetCategory.Vegetation:
      return Object.values(VegetationType).map((value) => ({ value, label: humanizeIdentifier(value) }));
    case AssetTargetCategory.Infrastructure:
      return INFRASTRUCTURE_TARGETS;
  }
}

export function describeAssetTarget(category: AssetTargetCategory, targetType: string | null): string {
  if (category === AssetTargetCategory.Map || targetType === null) return ASSET_CATEGORY_LABELS[category];
  const match = assetTargetsFor(category).find((target) => target.value === targetType);
  return `${ASSET_CATEGORY_LABELS[category]} · ${match?.label ?? humanizeIdentifier(targetType)}`;
}
