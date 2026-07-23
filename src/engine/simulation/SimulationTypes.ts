import type { NPCSchedulePeriod } from '../npc/NPC';

export type SimulationClockMode = 'realtime' | 'campaign' | 'manual';
export type SimulationSpeed = 0 | 1 | 5 | 15 | 60;

export interface SimulationTimeState {
  readonly mode: SimulationClockMode;
  readonly campaignTimestampMs: number;
  readonly speed: SimulationSpeed;
  readonly timezone: string;
}

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'heavy-rain' | 'thunderstorm' | 'typhoon';

export interface WeatherState {
  readonly condition: WeatherCondition;
  readonly intensity: number;
  readonly precipitationMmPerHour: number;
  readonly windKph: number;
  readonly visibilityKilometers: number;
  readonly roadSpeedMultiplier: number;
  readonly walkingSpeedMultiplier: number;
  readonly floodRiskDelta: number;
  readonly authored: boolean;
}

export type InfrastructureOperationalState = 'open' | 'restricted' | 'closed' | 'flooded' | 'damaged' | 'under-repair';

export interface InfrastructureStatusState {
  readonly roadStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly bridgeStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly portStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly manualRoadStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly manualBridgeStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly manualPortStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
}

export type VenueOperationalState = 'open' | 'closed' | 'closing-soon' | 'emergency-only' | 'evacuated' | 'abandoned';

export interface VenueStatusState {
  readonly anchorStatusById: Readonly<Record<number, VenueOperationalState>>;
}

export type SettlementActivityLevel = 'asleep' | 'quiet' | 'normal' | 'busy' | 'rush';

export interface SettlementActivityState {
  readonly levelBySettlementId: Readonly<Record<number, SettlementActivityLevel>>;
  readonly aggregateTrafficMultiplier: number;
  readonly profileLabel: string;
}

export type NPCMovementState = 'at-location' | 'preparing' | 'travelling' | 'delayed' | 'unable' | 'fallback';

export interface NPCDynamicStateEntry {
  readonly npcId: number;
  readonly state: NPCMovementState;
  readonly schedulePeriod: NPCSchedulePeriod;
  readonly currentTileIndex: number;
  readonly destinationTileIndex: number;
  readonly activity: string;
  readonly estimatedArrivalTimestampMs: number | null;
  readonly delayMinutes: number;
}

export interface NPCDynamicState {
  readonly entriesByNpcId: Readonly<Record<number, NPCDynamicStateEntry>>;
}

export interface SupernaturalState {
  readonly active: boolean;
  readonly level: 'dormant' | 'uneasy' | 'manifesting' | 'peak';
  readonly afterDark: boolean;
  readonly witchingHour: boolean;
  readonly stormAmplified: boolean;
}

export interface SimulationEvent {
  readonly id: string;
  readonly timestampMs: number;
  readonly category: 'time' | 'weather' | 'traffic' | 'infrastructure' | 'venue' | 'npc' | 'supernatural';
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
}

export interface WorldSimulationState {
  readonly time: SimulationTimeState;
  readonly weather: WeatherState;
  readonly infrastructure: InfrastructureStatusState;
  readonly venues: VenueStatusState;
  readonly settlements: SettlementActivityState;
  readonly npcs: NPCDynamicState;
  readonly supernatural: SupernaturalState;
  readonly eventLog: readonly SimulationEvent[];
  readonly revision: number;
}

export interface SimulationOverrides {
  readonly weatherCondition: WeatherCondition | null;
  readonly infrastructure: InfrastructureStatusState;
}

export interface StoredSimulationState {
  readonly time: SimulationTimeState;
  readonly weatherOverride: WeatherCondition | null;
  readonly manualRoadStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly manualBridgeStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly manualPortStatusById: Readonly<Record<number, InfrastructureOperationalState>>;
  readonly eventLog: readonly SimulationEvent[];
}
