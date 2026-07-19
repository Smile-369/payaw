import type { AnchorPositionOverride, StoryPositionOverride } from './GenerationOptions';
import type { InvalidPositionOverrideError } from './InvalidPositionOverrideError';

export interface RecoveredPositionOverrides {
  readonly anchorPositions: readonly AnchorPositionOverride[];
  readonly storyPositions: readonly StoryPositionOverride[];
  readonly removed: boolean;
}

/** Removes only the persisted position record that caused generation to fail. */
export function recoverPositionOverrides(
  anchorPositions: readonly AnchorPositionOverride[],
  storyPositions: readonly StoryPositionOverride[],
  error: InvalidPositionOverrideError,
): RecoveredPositionOverrides {
  if (error.kind === 'anchor') {
    const nextAnchors = anchorPositions.filter((position) => position.key !== error.key);
    return {
      anchorPositions: nextAnchors,
      storyPositions,
      removed: nextAnchors.length !== anchorPositions.length,
    };
  }

  const nextStories = storyPositions.filter((position) => {
    if (position.key !== undefined) return position.key !== error.key;
    return error.entityId === null || position.id !== error.entityId;
  });
  return {
    anchorPositions,
    storyPositions: nextStories,
    removed: nextStories.length !== storyPositions.length,
  };
}
