import type { AnchorPositionOverride, SettlementPositionOverride, StoryPositionOverride } from './GenerationOptions';
import type { InvalidPositionOverrideError } from './InvalidPositionOverrideError';

export interface RecoveredPositionOverrides {
  readonly anchorPositions: readonly AnchorPositionOverride[];
  readonly settlementPositions: readonly SettlementPositionOverride[];
  readonly storyPositions: readonly StoryPositionOverride[];
  readonly removed: boolean;
}

export function recoverPositionOverrides(
  anchorPositions: readonly AnchorPositionOverride[],
  storyPositions: readonly StoryPositionOverride[],
  error: InvalidPositionOverrideError,
): RecoveredPositionOverrides;
export function recoverPositionOverrides(
  anchorPositions: readonly AnchorPositionOverride[],
  settlementPositions: readonly SettlementPositionOverride[],
  storyPositions: readonly StoryPositionOverride[],
  error: InvalidPositionOverrideError,
): RecoveredPositionOverrides;
/** Removes only the persisted position record that caused generation to fail. */
export function recoverPositionOverrides(
  anchorPositions: readonly AnchorPositionOverride[],
  settlementOrStoryPositions: readonly SettlementPositionOverride[] | readonly StoryPositionOverride[],
  storyPositionsOrError: readonly StoryPositionOverride[] | InvalidPositionOverrideError,
  maybeError?: InvalidPositionOverrideError,
): RecoveredPositionOverrides {
  const legacyCall = maybeError === undefined;
  const settlementPositions = legacyCall ? [] : settlementOrStoryPositions as readonly SettlementPositionOverride[];
  const storyPositions = legacyCall
    ? settlementOrStoryPositions as readonly StoryPositionOverride[]
    : storyPositionsOrError as readonly StoryPositionOverride[];
  const error = legacyCall ? storyPositionsOrError as InvalidPositionOverrideError : maybeError;

  if (error.kind === 'anchor') {
    const nextAnchors = anchorPositions.filter((position) => position.key !== error.key);
    return {
      anchorPositions: nextAnchors,
      settlementPositions,
      storyPositions,
      removed: nextAnchors.length !== anchorPositions.length,
    };
  }

  if (error.kind === 'settlement') {
    const nextSettlements = settlementPositions.filter((position) => position.key !== error.key);
    return {
      anchorPositions,
      settlementPositions: nextSettlements,
      storyPositions,
      removed: nextSettlements.length !== settlementPositions.length,
    };
  }

  const nextStories = storyPositions.filter((position) => {
    if (position.key !== undefined) return position.key !== error.key;
    return error.entityId === null || position.id !== error.entityId;
  });
  return {
    anchorPositions,
    settlementPositions,
    storyPositions: nextStories,
    removed: nextStories.length !== storyPositions.length,
  };
}
