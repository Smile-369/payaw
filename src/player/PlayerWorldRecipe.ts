import type {
  AuthoredMapFeature,
  AuthoredSettlementDefinition,
  GeneratedFeatureOverride,
  SettlementAuthoringOverride,
} from '../authoring/AuthoringLayer';
import { resolveGenerationOptions, type GenerationOptions } from '../engine/generation/GenerationOptions';

/**
 * Deterministic, player-safe instructions for rebuilding the public map.
 * Story rules, custom story points, NPC state, and GM-only authoring records are
 * intentionally excluded. The player generator stops before story/NPC stages.
 */
export interface PlayerWorldGenerationRecipe {
  readonly seed: string;
  readonly generationVersion: string;
  readonly options: GenerationOptions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function publicAuthoredSettlements(
  values: GenerationOptions['authoredSettlements'],
): readonly AuthoredSettlementDefinition[] {
  return (values ?? []).flatMap((settlement) => {
    if (settlement.hidden || settlement.visibility !== 'players') return [];
    const { hidden: _hidden, notes: _notes, ...publicSettlement } = settlement;
    void _hidden;
    void _notes;
    // hidden/notes are restored to harmless values only inside the player
    // generator, so the network projection contains no GM-only fields.
    return [publicSettlement as unknown as AuthoredSettlementDefinition];
  });
}

function publicSettlementOverrides(
  values: GenerationOptions['settlementAuthoringOverrides'],
): readonly SettlementAuthoringOverride[] {
  return (values ?? []).map((override) => {
    const { hidden, notes: _notes, visibility, ...publicOverride } = override;
    void _notes;
    const shouldSuppress = override.suppressed === true
      || hidden === true
      || visibility === 'gm-only'
      || visibility === 'hidden';
    return {
      ...publicOverride,
      ...(shouldSuppress ? { suppressed: true } : {}),
      ...(visibility === 'players' ? { visibility: 'players' as const } : {}),
    } as SettlementAuthoringOverride;
  });
}

function publicGeneratedFeatureOverrides(
  values: GenerationOptions['generatedFeatureOverrides'],
): readonly GeneratedFeatureOverride[] {
  return (values ?? []).map((override) => {
    const { hidden, notes: _notes, ...publicOverride } = override;
    void _notes;
    return {
      ...publicOverride,
      ...((override.suppressed === true || hidden === true) ? { suppressed: true } : {}),
    } as GeneratedFeatureOverride;
  });
}

function publicAuthoredFeatures(
  values: GenerationOptions['authoredFeatures'],
): readonly AuthoredMapFeature[] {
  return (values ?? []).flatMap((feature) => {
    if (
      feature.hidden
      || feature.realityLayer !== 'normal'
      || feature.visibility !== 'players'
      || feature.category === 'hidden-payaw'
    ) return [];
    const { hidden: _hidden, notes: _notes, ...publicFeature } = feature;
    void _hidden;
    void _notes;
    return [publicFeature as unknown as AuthoredMapFeature];
  });
}

export function createPlayerWorldGenerationRecipe(
  seed: string,
  generationVersion: string,
  source: GenerationOptions,
): PlayerWorldGenerationRecipe {
  const resolved = resolveGenerationOptions(source);
  return {
    seed: seed.trim(),
    generationVersion,
    options: {
      customAnchors: resolved.customAnchors,
      builtInAnchorOverrides: resolved.builtInAnchorOverrides,
      terrainSize: resolved.terrainSize,
      townScale: resolved.townScale,
      terrainShape: resolved.terrainShape,
      climatePreset: resolved.climatePreset,
      islandCount: resolved.islandCount,
      islandSpacingKilometers: resolved.islandSpacingKilometers,
      satelliteSettlementCount: resolved.satelliteSettlementCount,
      roadNameOverrides: resolved.roadNameOverrides,
      blockNameOverrides: resolved.blockNameOverrides,
      anchorPositionOverrides: resolved.anchorPositionOverrides,
      settlementPositionOverrides: resolved.settlementPositionOverrides,
      authoredSettlements: publicAuthoredSettlements(resolved.authoredSettlements),
      settlementAuthoringOverrides: publicSettlementOverrides(resolved.settlementAuthoringOverrides),
      terrainOverrides: resolved.terrainOverrides,
      generatedFeatureOverrides: publicGeneratedFeatureOverrides(resolved.generatedFeatureOverrides),
      authoredFeatures: publicAuthoredFeatures(resolved.authoredFeatures),
      zoneOverrides: resolved.zoneOverrides,
      islandOverrides: resolved.islandOverrides,
      bridgeOverrides: resolved.bridgeOverrides,
      customBridges: resolved.customBridges,
      portOverrides: resolved.portOverrides,
      customPorts: resolved.customPorts,
      // Never transfer deterministic story placement or story content. The
      // player map receives revealed markers separately in PlayerProjection.
      storyPositionOverrides: [],
      storyRuleOverrides: [],
      customStoryPoints: [],
    },
  };
}

export function parsePlayerWorldGenerationRecipe(value: unknown): PlayerWorldGenerationRecipe | null {
  if (!isRecord(value) || typeof value.seed !== 'string' || !isRecord(value.options)) return null;
  const seed = value.seed.trim();
  if (seed.length === 0 || seed.length > 512) return null;
  return {
    seed,
    generationVersion: typeof value.generationVersion === 'string' ? value.generationVersion : '',
    options: value.options as unknown as GenerationOptions,
  };
}

/** Restore required harmless authoring fields before calling the engine. */
export function hydratePlayerWorldGenerationOptions(
  recipe: PlayerWorldGenerationRecipe,
): GenerationOptions {
  const source = recipe.options;
  return {
    ...source,
    authoredSettlements: (source.authoredSettlements ?? []).map((settlement) => ({
      ...settlement,
      hidden: false,
      visibility: 'players',
      notes: '',
    })),
    settlementAuthoringOverrides: (source.settlementAuthoringOverrides ?? []).map((override) => ({
      ...override,
      hidden: false,
      notes: '',
      ...(override.suppressed === true ? {} : { visibility: 'players' as const }),
    })),
    generatedFeatureOverrides: (source.generatedFeatureOverrides ?? []).map((override) => ({
      ...override,
      hidden: false,
      notes: '',
    })),
    authoredFeatures: (source.authoredFeatures ?? []).map((feature) => ({
      ...feature,
      hidden: false,
      notes: '',
      realityLayer: 'normal',
      visibility: 'players',
    })),
    storyPositionOverrides: [],
    storyRuleOverrides: [],
    customStoryPoints: [],
  };
}
