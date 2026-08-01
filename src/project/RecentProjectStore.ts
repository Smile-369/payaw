import { ClimatePreset, TerrainShape, TerrainSize, TownScale } from '../engine/generation/GenerationOptions';
import { isEnumValue } from '../editor/EditorStatePersistence';

const RECENT_PROJECTS_STORAGE_KEY = 'payaw.recent-projects.v1';
const MAXIMUM_RECENT_PROJECTS = 8;

export interface RecentProjectEntry {
  readonly seed: string;
  readonly terrainSize: TerrainSize;
  readonly townScale: TownScale;
  readonly terrainShape: TerrainShape;
  readonly climatePreset: ClimatePreset;
  readonly islandCount: number;
  readonly islandSpacingKilometers: number;
  readonly satelliteSettlementCount: number;
  readonly updatedAt: string;
}

export function loadRecentProjects(): RecentProjectEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const candidate = item as Partial<RecentProjectEntry>;
      if (
        typeof candidate.seed !== 'string'
        || !isEnumValue(Object.values(TerrainSize), candidate.terrainSize)
        || !isEnumValue(Object.values(TownScale), candidate.townScale)
        || !isEnumValue(Object.values(TerrainShape), candidate.terrainShape)
        || !isEnumValue(Object.values(ClimatePreset), candidate.climatePreset)
      ) return [];
      return [{
        seed: candidate.seed,
        terrainSize: candidate.terrainSize,
        townScale: candidate.townScale,
        terrainShape: candidate.terrainShape,
        climatePreset: candidate.climatePreset,
        islandCount: Number(candidate.islandCount) || 5,
        islandSpacingKilometers: Number(candidate.islandSpacingKilometers) || 4,
        satelliteSettlementCount: 0,
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
      }];
    }).slice(0, MAXIMUM_RECENT_PROJECTS);
  } catch {
    return [];
  }
}

export function saveRecentProject(entry: RecentProjectEntry): void {
  const entries = [
    entry,
    ...loadRecentProjects().filter((item) => item.seed !== entry.seed || item.terrainShape !== entry.terrainShape),
  ].slice(0, MAXIMUM_RECENT_PROJECTS);
  localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(entries));
}

export function clearRecentProjects(): void {
  localStorage.removeItem(RECENT_PROJECTS_STORAGE_KEY);
}
