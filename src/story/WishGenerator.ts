import type { Random } from '../engine/rng/Random';
import { StoryObjectType } from './StoryObject';

const GENERIC_WISHES = [
  'Someone wished the place would never be forgotten.',
  'A promise was made here and never fulfilled.',
  'Someone wished to see a missing person one more time.',
  'The place remembers a wish that was never spoken aloud.',
] as const;

const WISHES: Readonly<Partial<Record<StoryObjectType, readonly string[]>>> = {
  [StoryObjectType.BaleteTree]: [
    'A wish to be remembered after everyone leaves.',
    'A wish for the town to remain exactly as it was.',
    'A wish that a missing person would find the road home.',
    'A wish to keep a family secret buried beneath the roots.',
  ],
  [StoryObjectType.OldSchool]: [
    'A child wished to grow up before the school year ended.',
    'A teacher wished that no student would ever be forgotten.',
    'A class wished for one final day together.',
  ],
  [StoryObjectType.AbandonedCinema]: [
    'The last audience wished the ending could be changed.',
    'A projectionist wished the dead could see themselves again.',
    'Someone wished that one perfect night would never finish.',
  ],
  [StoryObjectType.OldCemetery]: [
    'A mourner wished the grave would answer back.',
    'A family wished their name would never disappear.',
    'Someone buried here wished to be found by the living.',
  ],
  [StoryObjectType.HauntedHouse]: [
    'A family wished that no one would ever have to leave the house.',
    'Someone wished for the door to open one final time.',
  ],
  [StoryObjectType.Shrine]: [
    'An offering carried a wish too costly to grant safely.',
    'Someone promised to return if their prayer was answered.',
  ],
  [StoryObjectType.Ruins]: [
    'The builders wished their work would outlive them.',
    'Someone wished the collapse could be undone.',
  ],
  [StoryObjectType.ForestHaunt]: [
    'A traveler wished to disappear where no one could follow.',
    'Someone wished the forest would hide what happened here.',
  ],
  [StoryObjectType.WatersideHaunt]: [
    'Someone wished the current would return what it took.',
    'A farewell was whispered into the water and refused to leave.',
  ],
};

export function generateWish(type: StoryObjectType, random: Random): string {
  return random.pick(WISHES[type] ?? GENERIC_WISHES);
}
