import type { Random } from '../engine/rng/Random';
import { EncounterDanger, StoryObjectType, type StoryEncounterDefinition } from './StoryObject';

interface EncounterTemplate {
  readonly title: string;
  readonly description: string;
  readonly danger: EncounterDanger;
  readonly weight: number;
}

const COMMON: readonly EncounterTemplate[] = [
  { title: 'A familiar voice', description: 'Someone calls a character by a childhood nickname from somewhere no one can see.', danger: EncounterDanger.Omen, weight: 3 },
  { title: 'The missing minute', description: 'Every clock skips forward by one minute. One character remembers what happened during it.', danger: EncounterDanger.Low, weight: 2 },
  { title: 'Cold footprint', description: 'A wet barefoot print appears, followed by another closer to the group.', danger: EncounterDanger.Low, weight: 3 },
  { title: 'Borrowed shadow', description: 'A character’s shadow points toward a hidden clue instead of following the light.', danger: EncounterDanger.Omen, weight: 2 },
  { title: 'Malas gathers', description: 'Loose objects tremble while a nearby unspoken wish briefly becomes audible.', danger: EncounterDanger.Moderate, weight: 2 },
  { title: 'Wrong way home', description: 'The road loops back to the story site until the group gives up or leaves something meaningful behind.', danger: EncounterDanger.Severe, weight: 1 },
];

const TYPE_SPECIFIC: Readonly<Partial<Record<StoryObjectType, readonly EncounterTemplate[]>>> = {
  [StoryObjectType.BaleteTree]: [
    { title: 'Roots underfoot', description: 'Roots rise beneath the soil and point toward something buried near the tree.', danger: EncounterDanger.Low, weight: 3 },
    { title: 'The kapre’s ember', description: 'A red ember falls from the canopy. Looking up reveals a silhouette that was not there before.', danger: EncounterDanger.Moderate, weight: 2 },
    { title: 'Name in the bark', description: 'Fresh letters carve themselves into the trunk, spelling the name of someone in town.', danger: EncounterDanger.Omen, weight: 3 },
  ],
  [StoryObjectType.OldSchool]: [
    { title: 'Attendance check', description: 'A classroom voice calls names from an old class list. One character’s name is included.', danger: EncounterDanger.Moderate, weight: 3 },
    { title: 'Bell after dark', description: 'The school bell rings and every door closes at once.', danger: EncounterDanger.Severe, weight: 1 },
    { title: 'Chalk answer', description: 'A blackboard writes the answer to a question the group has not asked yet.', danger: EncounterDanger.Omen, weight: 3 },
  ],
  [StoryObjectType.AbandonedCinema]: [
    { title: 'The unfinished screening', description: 'The projector turns on and shows the group entering the building five minutes from now.', danger: EncounterDanger.Moderate, weight: 2 },
    { title: 'Seat reserved', description: 'One seat is clean and warm. A ticket bears a character’s full name.', danger: EncounterDanger.Low, weight: 3 },
    { title: 'Audience applause', description: 'Invisible viewers applaud when someone admits a regret.', danger: EncounterDanger.Omen, weight: 2 },
  ],
  [StoryObjectType.OldCemetery]: [
    { title: 'Fresh grave', description: 'A newly dug grave has no marker, but the soil contains an object belonging to the group.', danger: EncounterDanger.Severe, weight: 1 },
    { title: 'Procession without faces', description: 'A silent funeral procession crosses the path and vanishes behind the oldest tomb.', danger: EncounterDanger.Moderate, weight: 2 },
    { title: 'Borrowed flowers', description: 'Flowers move from one grave to another, marking a trail toward a clue.', danger: EncounterDanger.Omen, weight: 3 },
  ],
  [StoryObjectType.HauntedHouse]: [
    { title: 'Someone upstairs', description: 'Footsteps follow the group from the floor above, even when the house has only one storey.', danger: EncounterDanger.Moderate, weight: 3 },
    { title: 'Dinner is ready', description: 'A complete meal appears on a dusty table, still steaming.', danger: EncounterDanger.Low, weight: 2 },
  ],
  [StoryObjectType.Shrine]: [
    { title: 'Answered offering', description: 'An offering disappears and is replaced with a small object connected to the petitioner’s wish.', danger: EncounterDanger.Omen, weight: 3 },
    { title: 'A favor owed', description: 'A voice grants a minor request and quietly names the price.', danger: EncounterDanger.Moderate, weight: 2 },
  ],
  [StoryObjectType.Ruins]: [
    { title: 'Wall remembers', description: 'Touching the oldest wall reveals a brief sensory memory of the place before it fell.', danger: EncounterDanger.Omen, weight: 3 },
    { title: 'Collapse pattern', description: 'Falling debris blocks the obvious route while opening a path into a sealed room.', danger: EncounterDanger.Moderate, weight: 2 },
  ],
  [StoryObjectType.ForestHaunt]: [
    { title: 'No insects', description: 'The forest becomes completely silent while something circles beyond sight.', danger: EncounterDanger.Moderate, weight: 3 },
    { title: 'Trail of ribbons', description: 'Old ribbons tied to branches lead deeper into the trees and spell a warning when viewed from above.', danger: EncounterDanger.Low, weight: 2 },
  ],
  [StoryObjectType.WatersideHaunt]: [
    { title: 'Reflection stays', description: 'A character’s reflection remains in the water after they step away.', danger: EncounterDanger.Moderate, weight: 3 },
    { title: 'Something in the net', description: 'An abandoned net pulls tight around an object that should not be underwater.', danger: EncounterDanger.Low, weight: 2 },
  ],
};

export function generateEncounterTable(type: StoryObjectType, random: Random, count = 6): StoryEncounterDefinition[] {
  const pool = [...COMMON, ...(TYPE_SPECIFIC[type] ?? [])];
  const selected: EncounterTemplate[] = [];
  const remaining = [...pool];
  while (selected.length < count && remaining.length > 0) {
    const index = random.int(0, remaining.length - 1);
    const [entry] = remaining.splice(index, 1);
    if (entry !== undefined) selected.push(entry);
  }
  return selected.map((entry, index) => ({
    id: `${type}-${index + 1}`,
    title: entry.title,
    description: entry.description,
    danger: entry.danger,
    weight: entry.weight,
  }));
}

export function pickWeightedEncounter(
  encounters: readonly StoryEncounterDefinition[],
  randomValue: number,
): StoryEncounterDefinition | undefined {
  if (encounters.length === 0) return undefined;
  const total = encounters.reduce((sum, encounter) => sum + Math.max(0, encounter.weight), 0);
  if (total <= 0) return encounters[0];
  let cursor = Math.min(0.999999999, Math.max(0, randomValue)) * total;
  for (const encounter of encounters) {
    cursor -= Math.max(0, encounter.weight);
    if (cursor < 0) return encounter;
  }
  return encounters.at(-1);
}
