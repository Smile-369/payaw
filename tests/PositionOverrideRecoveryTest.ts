import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { InvalidPositionOverrideError } from '../src/engine/generation/InvalidPositionOverrideError';
import { recoverPositionOverrides } from '../src/engine/generation/PositionOverrideRecovery';
import { TerrainShape, TownScale, type AnchorPositionOverride, type StoryPositionOverride } from '../src/engine/generation/GenerationOptions';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pipeline = new GenerationPipeline();
const seed = 'payaw-ms111-stale-overrides';
const profile = { terrainShape: TerrainShape.Archipelago, townScale: TownScale.Urban } as const;

const staleAnchorPositions: AnchorPositionOverride[] = [
  { key: 'town-plaza', x: -40, y: -40 },
];

let anchorError: InvalidPositionOverrideError | null = null;
try {
  pipeline.generate(seed, { ...profile, anchorPositionOverrides: staleAnchorPositions });
} catch (error) {
  if (error instanceof InvalidPositionOverrideError) anchorError = error;
  else throw error;
}
assert(anchorError !== null, 'An invalid saved anchor position did not produce a typed recovery error.');
assert(anchorError.kind === 'anchor' && anchorError.key === 'town-plaza', 'The anchor recovery error did not identify Town Plaza.');

const recoveredAnchorState = recoverPositionOverrides(staleAnchorPositions, [], anchorError);
assert(recoveredAnchorState.removed, 'The stale Town Plaza position was not removed.');
assert(recoveredAnchorState.anchorPositions.length === 0, 'The stale anchor override survived recovery.');

const recoveredWorld = pipeline.generate(seed, {
  ...profile,
  anchorPositionOverrides: recoveredAnchorState.anchorPositions,
  storyPositionOverrides: recoveredAnchorState.storyPositions,
});
const plaza = recoveredWorld.anchors.find((anchor) => anchor.key === 'town-plaza');
assert(plaza !== undefined, 'Town Plaza was not procedurally restored after recovery.');
assert(recoveredWorld.tiles[plaza.tileIndex]?.water === 'land', 'Recovered Town Plaza is not on land.');

const baseline = pipeline.generate(`${seed}-story`, profile);
const firstStory = baseline.storyObjects[0];
assert(firstStory !== undefined, 'Story recovery test has no generated story object.');
const staleStoryPositions: StoryPositionOverride[] = [
  { id: firstStory.id, key: firstStory.key, x: -50, y: -50 },
];

let storyError: InvalidPositionOverrideError | null = null;
try {
  pipeline.generate(`${seed}-story`, { ...profile, storyPositionOverrides: staleStoryPositions });
} catch (error) {
  if (error instanceof InvalidPositionOverrideError) storyError = error;
  else throw error;
}
assert(storyError !== null, 'An invalid saved story position did not produce a typed recovery error.');
assert(storyError.kind === 'story' && storyError.key === firstStory.key, 'The story recovery error identified the wrong object.');

const recoveredStoryState = recoverPositionOverrides([], staleStoryPositions, storyError);
assert(recoveredStoryState.removed && recoveredStoryState.storyPositions.length === 0, 'The stale story position was not removed.');
const recoveredStoryWorld = pipeline.generate(`${seed}-story`, {
  ...profile,
  anchorPositionOverrides: recoveredStoryState.anchorPositions,
  storyPositionOverrides: recoveredStoryState.storyPositions,
});
assert(recoveredStoryWorld.storyObjects.some((story) => story.key === firstStory.key), 'The story object was not procedurally restored.');

console.log(JSON.stringify({
  version: recoveredWorld.metadata.generationVersion,
  recoveredAnchor: plaza.name,
  recoveredStory: firstStory.name,
  anchorOverrideCount: recoveredAnchorState.anchorPositions.length,
  storyOverrideCount: recoveredStoryState.storyPositions.length,
}, null, 2));
