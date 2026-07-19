import type { Random } from '../engine/rng/Random';
import { StoryObjectType } from './StoryObject';

const GENERIC_MANIFESTATIONS = [
  'The air becomes unnaturally still and a familiar voice speaks from the wrong direction.',
  'Objects shift into a pattern that points toward a hidden memory of the place.',
  'The road away becomes longer each time someone looks back.',
  'A figure is visible only in glass, water, or polished metal.',
] as const;

const MANIFESTATIONS: Readonly<Partial<Record<StoryObjectType, readonly string[]>>> = {
  [StoryObjectType.BaleteTree]: [
    'A figure appears between the hanging roots only when seen in reflection.',
    'Voices repeat promises spoken near the trunk, but in the wrong order.',
    'The road bends back toward the tree whenever someone tries to leave alone.',
  ],
  [StoryObjectType.OldSchool]: [
    'Attendance is called in an empty classroom after sunset.',
    'Wet footprints cross the corridor and stop at a desk with no nameplate.',
    'The school bell rings once for every year the building has been abandoned.',
  ],
  [StoryObjectType.AbandonedCinema]: [
    'The screen shows scenes from the audience’s lives several minutes before they happen.',
    'A second audience can be heard reacting behind the sealed projection wall.',
    'A burned film reel projects a person who was never recorded.',
  ],
  [StoryObjectType.OldCemetery]: [
    'Names rearrange themselves across the gravestones after heavy rain.',
    'A funeral procession crosses the road without casting shadows.',
    'Fresh flowers appear on the oldest grave whenever someone goes missing.',
  ],
  [StoryObjectType.HauntedHouse]: [
    'Footsteps follow visitors from the room directly above, even when there is no upper floor.',
    'Every window shows the house during a different year.',
  ],
  [StoryObjectType.Shrine]: [
    'Offerings vanish and return bearing small marks that resemble fingerprints.',
    'The shrine answers prayers in the voice of someone the petitioner misses.',
  ],
  [StoryObjectType.Ruins]: [
    'Collapsed walls briefly stand intact whenever thunder sounds.',
    'Dust traces the movements of people who died before the place fell.',
  ],
  [StoryObjectType.ForestHaunt]: [
    'The forest falls silent while unseen footsteps match the group’s pace.',
    'Trees change position whenever no one is looking directly at them.',
  ],
  [StoryObjectType.WatersideHaunt]: [
    'Reflections continue moving after the people casting them have stopped.',
    'Voices rise from beneath the water whenever the tide changes.',
  ],
};

export function generateManifestation(type: StoryObjectType, random: Random): string {
  return random.pick(MANIFESTATIONS[type] ?? GENERIC_MANIFESTATIONS);
}
