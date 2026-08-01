import { HistoryManager } from '../src/editor/HistoryManager';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { AnchorRegionPreference, AnchorTerrainPreference } from '../src/engine/settlement/Anchor';
import { WaterType } from '../src/engine/world/Tile';
import { pickWeightedEncounter } from '../src/story/EncounterGenerator';
import {
  EncounterDanger,
  StoryObjectSource,
  StoryObjectType,
  type CustomStoryPointDefinition,
  type StoryEncounterDefinition,
} from '../src/story/StoryObject';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const customDefinition: CustomStoryPointDefinition = {
  id: 'lost-letters-shrine',
  name: 'Chapel of Lost Letters',
  type: StoryObjectType.Shrine,
  region: AnchorRegionPreference.Anywhere,
  terrain: AnchorTerrainPreference.SafeLand,
  preferredZone: null,
  allowedZones: [],
  disallowedZones: [],
  influenceRadius: 11,
  minimumDistance: 8,
  encounters: [],
};

const pipeline = new GenerationPipeline();
const seed = 'payaw-ms81-focused';
const authored = pipeline.generate(seed, { customStoryPoints: [customDefinition] });
const repeated = pipeline.generate(seed, { customStoryPoints: [customDefinition] });
const customKey = `custom-story:${customDefinition.id}`;
const custom = authored.storyObjects.find((item) => item.key === customKey);
const repeatedCustom = repeated.storyObjects.find((item) => item.key === customKey);

assert(custom !== undefined, 'Browser-authored story point was not generated.');
assert(repeatedCustom !== undefined, 'Repeated custom story point was not generated.');
assert(authored.storyObjects.length === 7, 'Expected six built-in story points plus one custom story point.');
assert(custom.source === StoryObjectSource.Custom, 'Custom story source metadata was lost.');
assert(custom.customDefinitionId === customDefinition.id, 'Custom story definition id was lost.');
assert(custom.name === customDefinition.name, 'Custom story name was not preserved.');
assert(custom.encounters.length > 0, 'An empty custom encounter table did not receive generated encounters.');
assert(
  JSON.stringify(custom.encounters) === JSON.stringify(repeatedCustom.encounters),
  'Generated encounter tables are not deterministic for the same seed.',
);
assert(
  authored.storyObjects.every((item) => item.encounters.length > 0),
  'At least one story point has no random encounters.',
);

const moveTile = authored.tiles.find((tile) => (
  tile.water === WaterType.Land
  && !tile.river
  && tile.x > 5
  && tile.y > 5
  && tile.x < authored.width - 6
  && tile.y < authored.height - 6
  && (tile.x !== custom.x || tile.y !== custom.y)
));
assert(moveTile !== undefined, 'No dry tile was available for the custom story position override test.');

const overrideEncounter: StoryEncounterDefinition = {
  id: 'lost-letter-delivery',
  title: 'Letter without a sender',
  description: 'A sealed letter names the next person who will enter the chapel.',
  weight: 5,
  danger: EncounterDanger.Moderate,
};
const overrideOptions = {
  customStoryPoints: [customDefinition],
  storyPositionOverrides: [{ id: 999, key: customKey, x: moveTile.x, y: moveTile.y }],
  storyRuleOverrides: [{
    id: 999,
    key: customKey,
    name: 'The Chapel That Answers',
    preferredZone: null,
    allowedZones: [],
    disallowedZones: [],
    influenceRadius: 17,
    wish: 'To receive one final reply.',
    manifestation: 'Letters appear beneath locked doors before anyone writes them.',
    encounters: [overrideEncounter],
  }],
} as const;

const overridden = pipeline.generate(seed, overrideOptions);
const overriddenCustom = overridden.storyObjects.find((item) => item.key === customKey);
assert(overriddenCustom !== undefined, 'Key-based custom story override removed the story point.');
assert(overriddenCustom.x === moveTile.x && overriddenCustom.y === moveTile.y, 'Key-based story position override was not applied.');
assert(overriddenCustom.name === 'The Chapel That Answers', 'Key-based story name override was not applied.');
assert(overriddenCustom.wish === 'To receive one final reply.', 'Story wish override was not applied.');
assert(overriddenCustom.manifestation.startsWith('Letters appear'), 'Story manifestation override was not applied.');
assert(overriddenCustom.influenceRadius === 17, 'Story influence-radius override was not applied.');
assert(JSON.stringify(overriddenCustom.encounters) === JSON.stringify([overrideEncounter]), 'Authored encounter table was not applied.');

const partial = pipeline.generate(seed, { customStoryPoints: [customDefinition] });
pipeline.regenerateFrom(partial, 'story-layer', overrideOptions);
assert(
  JSON.stringify(partial.storyObjects) === JSON.stringify(overridden.storyObjects),
  'Partial story-layer regeneration differs from a full deterministic generation.',
);

const weighted: StoryEncounterDefinition[] = [
  { id: 'one', title: 'One', description: 'First', weight: 1, danger: EncounterDanger.Low },
  { id: 'three', title: 'Three', description: 'Second', weight: 3, danger: EncounterDanger.Severe },
];
assert(pickWeightedEncounter(weighted, 0)?.id === 'one', 'Weighted encounter lower boundary failed.');
assert(pickWeightedEncounter(weighted, 0.249)?.id === 'one', 'Weighted encounter first interval failed.');
assert(pickWeightedEncounter(weighted, 0.25)?.id === 'three', 'Weighted encounter interval boundary failed.');
assert(pickWeightedEncounter(weighted, 1)?.id === 'three', 'Weighted encounter upper boundary failed.');

const history = new HistoryManager<{ value: number }>(2);
history.record({ value: 0 }, 'first edit');
history.record({ value: 1 }, 'second edit');
const undone = history.undo({ value: 2 });
assert(undone?.state.value === 1 && history.canRedo, 'Undo history did not restore the previous state.');
const redone = history.redo({ value: 1 });
assert(redone?.state.value === 2 && history.canUndo, 'Redo history did not restore the current state.');
history.record({ value: 2 }, 'third edit');
assert(!history.canRedo, 'Recording a new edit did not clear redo history.');

const boundedHistory = new HistoryManager<{ value: number }>(2);
boundedHistory.record({ value: 0 }, 'zero');
boundedHistory.record({ value: 1 }, 'one');
boundedHistory.record({ value: 2 }, 'two');
assert(boundedHistory.undo({ value: 3 })?.state.value === 2, 'Bounded history lost its newest snapshot.');
assert(boundedHistory.undo({ value: 2 })?.state.value === 1, 'Bounded history lost its second-newest snapshot.');
assert(boundedHistory.undo({ value: 1 }) === undefined, 'Bounded history retained a snapshot beyond its limit.');

console.log(JSON.stringify({
  generationVersion: overridden.metadata.generationVersion,
  storyPointCount: authored.storyObjects.length,
  customStory: {
    key: custom.key,
    source: custom.source,
    generatedEncounterCount: custom.encounters.length,
    movedTo: { x: overriddenCustom.x, y: overriddenCustom.y },
    authoredEncounterCount: overriddenCustom.encounters.length,
  },
  partialRegenerationMatchesFull: true,
  undoRedo: {
    boundedSnapshots: true,
    redoInvalidation: true,
  },
  imageExportApi: 'CanvasRenderer.exportPng',
}, null, 2));
