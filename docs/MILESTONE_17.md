# Milestone 17 — Living World Simulation

## Goal

Milestone 17 turns the generated Metro Bacolod-scale region into a time-dependent session environment while keeping geography and authored map overrides non-destructive.

## Runtime dependency order

```text
SimulationClock
→ WeatherSystem
→ TrafficSystem
→ InfrastructureStatusSystem
→ VenueSystem
→ TravelContext
→ NPCScheduleSystem
→ SupernaturalSystem
→ Event log
```

## Clock

`SimulationClock` supports:

```ts
'realtime' | 'campaign' | 'manual'
```

Campaign time can run at:

```ts
0 | 1 | 5 | 15 | 60
```

The clock stores an explicit timestamp and timezone. Campaign time is derived from a real-time anchor, so accelerated time does not accumulate frame-by-frame drift.

## Weather

`WeatherSystem` is deterministic for a world seed and three-hour time band unless the DM selects an override. The wet-season probability table increases rain and storm frequency without requiring a long-running climate simulation.

Weather emits movement multipliers and flood pressure used by later systems.

## Traffic

`TrafficSystem` creates one multiplier per road using:

- Time profile
- Road class
- Connected settlement population
- Weather speed loss

It does not create one vehicle per resident.

## Infrastructure

`InfrastructureStatusSystem` derives temporary statuses from weather and tile flood risk, then applies explicit DM overrides last.

Supported states:

```ts
'open' | 'restricted' | 'closed' | 'flooded' | 'damaged' | 'under-repair'
```

The travel engine receives closed and restricted ID sets rather than mutating generated roads or maritime entities.

## NPC schedules

`NPCScheduleSystem` keeps the existing generated four-period schedule data but adds travel transitions. Before the next period begins, an NPC calculates a route from the current schedule location to the next one. The NPC marker advances along that route and exposes a dynamic state.

This approach preserves existing NPC JSON while allowing later milestones to add fully authored minute-level schedules.

## Travel context

`TravelPlanner` accepts an optional live context:

```ts
interface TravelContext {
  timestampMs: number;
  revision: number;
  trafficByRoadId: ReadonlyMap<number, number>;
  closedRoadIds: ReadonlySet<number>;
  restrictedRoadIds: ReadonlySet<number>;
  closedBridgeIds: ReadonlySet<number>;
  closedPortIds: ReadonlySet<number>;
  closedWaterRouteIds: ReadonlySet<number>;
  roadSpeedMultiplier: number;
  walkingSpeedMultiplier: number;
  ferryTimeMultiplier: number;
  reasons: readonly string[];
}
```

Normal routing still works with no context. Live routing applies conditions during pathfinding, not only after calculating a path, so a closure can force a different fork or make a route unavailable.

## Persistence

`StoredSimulationState` saves clock settings, weather override, and manual infrastructure statuses. Generated weather, traffic, venue state, and NPC dynamic positions are recalculated from the saved timestamp and seed.

## Explicit exclusions

- Story Flow beats
- Encounter roles
- Prerequisite chains
- AI Director
- Automatic plot writing
- Individual vehicle simulation
- Combat simulation
