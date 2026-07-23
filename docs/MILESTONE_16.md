# Milestone 16.1 — NPCs, Forked Roads, and Regional Routing

## Objective

Milestone 16.1 turns PAYAW's generated Metro-scale region into a usable navigation and population workspace without introducing a rigid quest-flow model.

The release has four connected systems:

1. **Forked anchor road network**
2. **NPC generation and map inspection**
3. **Point A → Point B travel planning with alternate routes**
4. **Toolbar category menus and layer toggles**

The prior Story Flow Studio, beat types, prerequisites, and Story Campaign model are removed.

## Road-network topology

The road generator still begins with a deterministic minimum-cost backbone and configured extra edges. Milestone 16.1 adds an anchor-degree repair pass.

When the world has three or more anchors, each anchor is given at least two independent graph connections when valid candidates exist. This changes the generated topology from a mostly tree-like network into a network with useful cycles.

```text
Anchor backbone
    ↓
Extra deterministic links
    ↓
Degree repair for under-connected anchors
    ↓
A* road geometry
    ↓
Forks, junctions, and alternate approaches
```

This does not guarantee two completely disjoint physical routes in every terrain configuration, but it prevents anchors from being intentionally left as single-edge leaves when another feasible connection exists.

## NPC model

NPCs are generated after story locations and other world entities so they can use the completed settlement, zoning, building, and road data.

```text
World
 └─ NPC[]
     ├─ identity
     ├─ occupation
     ├─ personality
     ├─ wish / fear / secret / rumor
     ├─ status
     ├─ settlement and zone
     ├─ home and workplace
     ├─ schedule[]
     └─ relationships[]
```

Generation is deterministic for the same seed, profile, world state, and roster size. Building pools are grouped by settlement before assignment to avoid repeatedly scanning every building for every NPC.

NPCs are included in world serialization and project JSON. Their current scheduled position is exposed as a travel location and map marker.

## Travel-location registry

`collectTravelLocations(world)` exposes stable entries for:

```text
settlement:<id>
anchor:<id>
port:<id>
story:<id>
npc:<id>
point:<x>:<y>
```

Temporary `point:` locations are created by clicking the map and are kept in the editor session rather than written into generated terrain.

## Point A → Point B routing

### Walking

Walking uses A* across traversable land and bridge tiles. Cost considers:

- 125-meter tile distance
- Roads versus off-road travel
- Terrain type
- Slope
- Flood exposure

### Driving

Driving finds road-access legs around both endpoints and routes through generated road and bridge tiles.

```text
Walk to road
→ Drive through network
→ Walk from road
```

Road class controls effective speed, while traffic profile scales time.

### Public transport

Jeepney/tricycle mode uses the road network with reduced effective speed and a waiting-time allowance. Alternate-route generation is supported.

### Road + ferry

Mixed routing can connect road journeys through generated ports and enabled maritime routes. Ferry duration comes from the generated water-route model.

## Alternate routes

`planTravelAlternatives()` returns the primary route and then searches for alternatives by increasing the traversal cost of road tiles already used by previous plans.

This encourages subsequent plans to use:

- Different road forks
- Different anchor approaches
- Parallel arterials or local-road detours

The UI displays up to three routes, ordered by estimated duration. Choosing one updates the map overlay and route breakdown.

Alternate-route search currently applies to driving and public transport. Walking and mixed-ferry routing return their best route.

## Toolbar category menus

The category toolbar provides compact, context-specific controls without replacing the full Layer Manager.

Each menu synchronizes with the canonical layer checkbox and renderer state. Changing a toolbar toggle therefore has the same result as changing the corresponding layer in the side panel.

Categories:

- Terrain
- Settlements
- Roads
- Buildings
- Anchors
- Story
- NPCs
- Travel
- Labels

## Rendering

New canonical layers:

- `RenderLayer.NPCs`
- `RenderLayer.Travel`

NPC markers are culled by viewport. Travel routes are transient overlays and are not baked into the generated world or raster caches.

## Persistence

World schema remains **16**. The generation contract is identified by:

```text
payaw-m16-npc-routing-v2
```

Full world/project JSON preserves NPCs and the roster configuration. Story Campaign fields from the abandoned Story Flow prototype are no longer exported or used.

## Main implementation files

- `src/engine/npc/NPC.ts`
- `src/engine/npc/NPCGenerator.ts`
- `src/engine/generation/stages/NPCStage.ts`
- `src/engine/infrastructure/RoadNetwork.ts`
- `src/engine/travel/TravelPlanner.ts`
- `src/engine/renderer/Layers.ts`
- `src/engine/renderer/CanvasRenderer.ts`
- `src/engine/world/World.ts`
- `src/main.ts`
- `tests/Milestone16Test.ts`
