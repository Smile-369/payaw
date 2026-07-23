# Milestone 17 Architecture — Living World Simulation

## Product goal

Milestone 17 makes the Metro Bacolod-scale region feel inhabited and time-dependent. It builds on the existing NPC generator and real-time clock without reintroducing Story Flow beats or an AI director.

The simulation must remain:

- Deterministic when replayed from the same seed, campaign time, and overrides
- Lightweight enough for a browser-based regional map
- Inspectable and overridable by the DM
- Integrated with the existing Point A → Point B travel calculator
- Non-destructive to generated geography and authored map edits

## Scope

### Included

- Campaign clock modes
- Detailed NPC schedules and movement
- Venue opening and closing states
- Settlement activity levels
- Time-dependent traffic
- Weather and flood disruptions
- Road, bridge, port, and ferry closures
- Supernatural activity windows
- Simulation event log
- DM pause, skip-time, and override controls
- Travel-time recalculation from live world conditions

### Excluded

- Story beats and prerequisite graphs
- Automatic plot writing
- AI Director behavior
- Fully simulated household economics
- One vehicle entity for every resident
- Combat simulation

## Time model

The current live clock becomes one of three clock modes:

```text
Real Time
Campaign Time
Paused Manual Time
```

### Real Time

Uses the device's local date and time. Appropriate for ambient map display and live sessions.

### Campaign Time

Stores an explicit in-world timestamp and supports:

- Pause/resume
- 1×, 5×, 15×, 60× acceleration
- Advance by minutes, hours, or days
- Jump to a selected date and time

### Paused Manual Time

The DM selects a fixed timestamp. Nothing advances until explicitly changed.

The canonical state is:

```ts
interface SimulationTimeState {
  mode: 'realtime' | 'campaign' | 'manual';
  campaignTimestampMs: number;
  speed: 0 | 1 | 5 | 15 | 60;
  timezone: string;
}
```

## Core modules

### `SimulationClock`

Produces the authoritative world timestamp and emits minute, hour, daypart, and date-change events.

### `SimulationScheduler`

Runs deterministic systems in dependency order:

```text
Clock
→ Weather
→ Infrastructure status
→ Venue status
→ Traffic/activity
→ NPC schedules
→ Supernatural state
→ Travel cache invalidation
→ Event log
```

### `WorldSimulationState`

Stores only dynamic state. It does not duplicate static generated entities.

```ts
interface WorldSimulationState {
  time: SimulationTimeState;
  weather: WeatherState;
  infrastructure: InfrastructureStatusState;
  venues: VenueStatusState;
  settlements: SettlementActivityState;
  npcs: NPCDynamicState;
  supernatural: SupernaturalState;
  eventLog: SimulationEvent[];
}
```

### `NPCScheduleSystem`

Extends the current four-period schedules into timed schedule entries:

```ts
interface NPCScheduleEntry {
  dayMask: number;
  startMinute: number;
  endMinute: number;
  locationRef: EntityReference;
  activity: string;
  travelMode: TravelMode;
  priority: number;
}
```

NPCs transition through:

- At location
- Preparing to travel
- Travelling
- Delayed
- Unable to reach destination
- Using fallback location

Travel duration is calculated by the same regional travel planner used by the user-facing A → B calculator.

### `VenueSystem`

Tracks operational states for important buildings and anchors:

- Open
- Closed
- Closing soon
- Emergency only
- Evacuated
- Abandoned

Schedules can vary by weekday, weekend, holiday override, weather, or DM control.

### `TrafficSystem`

Uses aggregate traffic rather than individual vehicle simulation. Each road segment receives a dynamic multiplier derived from:

- Road class
- Settlement population
- Time of day
- Nearby schools, markets, offices, ports, and terminals
- Weather
- Closures

Target profiles for a Metro Bacolod-scale region:

- Predawn
- Morning rush
- Midday
- Afternoon school release
- Evening rush
- Late night

### `WeatherSystem`

Generates or accepts authored weather conditions:

- Clear
- Cloudy
- Rain
- Heavy rain
- Thunderstorm
- Typhoon conditions

Weather updates flood risk, road speed, walking speed, ferry availability, visibility, and supernatural activity.

### `InfrastructureStatusSystem`

Maintains temporary statuses for:

- Roads
- Bridges
- Ports
- Water routes
- Anchors and venues

Statuses include open, restricted, closed, flooded, damaged, and under repair.

### `SupernaturalSystem`

Activates existing horror locations and NPC conditions according to explicit rules such as:

- After 6 PM
- At 3 AM
- During storms
- On configured dates
- Above a Malas threshold

This system changes visibility, danger, and encounter availability but does not author plot chains.

## Travel integration

The Point A → Point B calculator reads a `TravelContext` snapshot:

```ts
interface TravelContext {
  timestampMs: number;
  weather: WeatherState;
  trafficByRoadId: ReadonlyMap<number, number>;
  closedRoadIds: ReadonlySet<number>;
  closedBridgeIds: ReadonlySet<number>;
  closedPortIds: ReadonlySet<number>;
  closedWaterRouteIds: ReadonlySet<number>;
}
```

A route result includes both normal and current-world estimates:

```text
Normal drive: 18 minutes
Current conditions: 31 minutes
Reason: evening traffic + flooded collector road
Alternate route: 25 minutes
```

Travel caches are keyed by origin, destination, mode, and a compact simulation-context revision number. They are invalidated only when relevant conditions change.

## Performance strategy

The region is simulated at multiple levels of detail:

### Active entities

Selected NPCs, visible NPCs, and NPCs relevant to the current session receive exact schedule and route updates.

### Background NPCs

Offscreen NPCs update only when they cross a schedule boundary or when queried.

### Settlement aggregates

Population activity, traffic demand, and venue usage are computed per settlement and district rather than per resident.

The scheduler runs at most once per simulated minute for ordinary systems. Rendering remains frame-based but reads immutable simulation snapshots.

## UI architecture

A new **Simulation** category menu and Studio Dock panel provide:

- Clock mode
- Date and time
- Speed controls
- Weather override
- Traffic overlay
- Open/closed venue overlay
- Infrastructure closure tools
- NPC schedule visibility
- Supernatural activity overlay
- Event log

Toolbar controls:

```text
Pause / Play
Time speed
Advance time
Weather
Traffic
Closures
NPC movement
Supernatural
```

## DM control hierarchy

Manual overrides always win:

```text
DM override
→ Authored project rule
→ Deterministic simulation rule
→ Generated default
```

Every override includes an optional expiry timestamp so a road can be closed for two hours or a venue can remain open for one session.

## Persistence

Milestone 17 should introduce schema 17 with a separate `simulation` section. Static world JSON remains deterministic and simulation saves remain compact.

```json
{
  "simulation": {
    "time": {},
    "weatherOverride": null,
    "entityOverrides": [],
    "eventLog": []
  }
}
```

## Delivery phases

### M17.1 — Clock and scheduler

- Real-time, campaign, and manual modes
- Pause and speed controls
- Deterministic scheduler
- Simulation persistence

### M17.2 — NPC schedules and travel

- Timed schedules
- NPC travelling state
- A → B planner integration
- Delays and fallback behavior

### M17.3 — Venues, traffic, and closures

- Opening hours
- Aggregate traffic
- Road/bridge/port closures
- Dynamic route recalculation

### M17.4 — Weather and supernatural state

- Weather model
- Flood and ferry effects
- Time/weather-based horror visibility
- DM overlays and event log

## Acceptance criteria

Milestone 17 is complete when:

1. A campaign clock can be paused, accelerated, saved, and restored.
2. NPCs move according to timed schedules using actual route durations.
3. Businesses and landmarks visibly open and close.
4. Rush hour, weather, and closures change Point A → Point B travel times.
5. The DM can override any dynamic state without changing generated geography.
6. A Metro Bacolod-scale world remains responsive with at least 200 generated NPCs.
7. Replaying the same seed and simulation timestamp produces the same dynamic state unless manual overrides differ.
