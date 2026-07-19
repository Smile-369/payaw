export enum IslandRole {
  PrimarySettlement = 'primary-settlement',
  SatelliteTown = 'satellite-town',
  RuralVillage = 'rural-village',
  Agricultural = 'agricultural',
  Industrial = 'industrial',
  PortHub = 'port-hub',
  ProtectedNature = 'protected-nature',
  StoryIsland = 'story-island',
  Uninhabited = 'uninhabited',
}

export enum DevelopmentLevel {
  Undeveloped = 'undeveloped',
  Hamlet = 'hamlet',
  Village = 'village',
  Town = 'town',
  Urban = 'urban',
}

export interface Island {
  readonly id: number;
  readonly key: string;
  readonly landmassId: number;
  name: string;
  role: IslandRole;
  developmentLevel: DevelopmentLevel;
  readonly viabilityScore: number;
  readonly populationCapacity: number;
  allocatedPopulation: number;
  populationWeight: number;
  settlementCountTarget: number;
  settlementIds: number[];
  bridgeIds: number[];
  allowBridges: boolean;
  allowPorts: boolean;
  allowRoads: boolean;
  allowStoryPoints: boolean;
  preserveNature: boolean;
  locked: boolean;
}

export interface IslandOverride {
  readonly key: string;
  readonly name?: string;
  readonly role?: IslandRole;
  readonly developmentLevel?: DevelopmentLevel;
  readonly populationWeight?: number;
  readonly settlementCount?: number;
  readonly allowBridges?: boolean;
  readonly allowPorts?: boolean;
  readonly allowRoads?: boolean;
  readonly allowStoryPoints?: boolean;
  readonly preserveNature?: boolean;
  readonly locked?: boolean;
}

export const ISLAND_ROLE_LABELS: Readonly<Record<IslandRole, string>> = {
  [IslandRole.PrimarySettlement]: 'Primary settlement',
  [IslandRole.SatelliteTown]: 'Satellite town',
  [IslandRole.RuralVillage]: 'Rural village',
  [IslandRole.Agricultural]: 'Agricultural island',
  [IslandRole.Industrial]: 'Industrial island',
  [IslandRole.PortHub]: 'Port hub',
  [IslandRole.ProtectedNature]: 'Protected nature',
  [IslandRole.StoryIsland]: 'Story island',
  [IslandRole.Uninhabited]: 'Uninhabited',
};
