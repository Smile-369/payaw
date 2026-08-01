import type { AuthoredSettlementDefinition } from '../src/authoring/AuthoringLayer';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale, type GenerationOptions, type StoryRuleOverride } from '../src/engine/generation/GenerationOptions';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const baseOptions: GenerationOptions = {
  terrainShape: TerrainShape.SingleLargeIsland,
  terrainSize: TerrainSize.Small,
  townScale: TownScale.SemiUrban,
  islandCount: 1,
  islandSpacingKilometers: 4,
  satelliteSettlementCount: 0,
};

function main(): void {
  const pipeline = new GenerationPipeline();
  const seed = 'payaw-ms21-uiux-overhaul';
  const baseline = pipeline.generate(seed, baseOptions);
  const target = baseline.storyObjects[0];
  assert(target !== undefined, 'Baseline world did not generate a removable story point.');

  const removal: StoryRuleOverride = {
    id: target.id,
    key: target.key,
    name: target.name,
    preferredZone: target.preferredZone,
    allowedZones: target.allowedZones,
    disallowedZones: target.disallowedZones,
    influenceRadius: target.influenceRadius,
    suppressed: true,
  };
  const withoutStory = pipeline.generate(seed, { ...baseOptions, storyRuleOverrides: [removal] });
  assert(!withoutStory.storyObjects.some((item) => item.key === target.key), 'Suppressed story point still appears in the generated world.');
  assert(withoutStory.storyObjects.length === baseline.storyObjects.length - 1, 'Story-point suppression removed the wrong number of sites.');

  const sourceSettlement = baseline.settlements[0];
  assert(sourceSettlement !== undefined, 'Baseline world did not generate a settlement reference point.');
  const community: AuthoredSettlementDefinition = {
    key: 'settlement:authored:ms21-community',
    name: 'Barangay Paglaum',
    kind: 'barangay',
    x: sourceSettlement.x,
    y: sourceSettlement.y,
    radius: 8,
    rotation: 0,
    populationTarget: 720,
    density: 0.64,
    parentKey: null,
    generateRoads: false,
    generateBuildings: false,
    locked: false,
    hidden: false,
    visibility: 'players',
    notes: 'Milestone 21 community-anchor regression.',
  };
  const withCommunity = pipeline.generate(seed, { ...baseOptions, authoredSettlements: [community] });
  const added = withCommunity.settlements.find((item) => item.key === community.key);
  assert(added !== undefined, 'Community settlement anchor was not retained after the UI overhaul.');
  assert(added.kind === 'barangay' && added.name === community.name, 'Community anchor metadata changed during generation.');

  console.log(JSON.stringify({
    release: '0.21.1',
    baselineStoryPoints: baseline.storyObjects.length,
    storyPointsAfterRemoval: withoutStory.storyObjects.length,
    removedStoryKey: target.key,
    communityAnchor: { key: added.key, name: added.name, kind: added.kind },
  }, null, 2));
}

main();
