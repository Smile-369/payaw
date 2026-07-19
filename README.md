# PAYAW Procedural World Engine — Milestone 11.1

**Milestone 11.1: Saved Position Recovery** fixes stale manual anchor and story locations that can become invalid after terrain or profile changes. It includes all Milestone 11 maritime features.

## Milestone 11.1 fix

- Full generation no longer fails because an old Town Plaza or story-point override lands on water.
- Only the invalid saved position is removed.
- The affected object returns to a deterministic procedural location.
- Valid moved objects and all other customization remain untouched.
- The repaired state is saved automatically.
- Direct dragging remains strict and still rejects invalid placements.

See `docs/MILESTONE_11_1.md` and `docs/VALIDATION_11_1.md`.

---

## What Milestone 11 adds

### Procedural ports

Each inhabited island that permits ports is evaluated for a coastal terminal. Candidate sites are scored using:

- Adjacent navigable water depth
- Shelter from open-water exposure
- Flat and buildable approach terrain
- Road-network proximity
- Flood risk
- Island role and population demand

Generated port types include:

- Fishing dock
- Barangay jetty
- Ferry terminal
- Commercial port
- Industrial port
- Marina

Every port records its island, settlement, land and water positions, capacity, depth, shelter, road access, access-road ID, connected route IDs, and generated/custom state.

### Water navigation

Water routes use a dedicated ocean traversal field. Each vessel has a minimum draft and different speed:

- Small boat
- Ferry
- Cargo vessel

A* rejects land tiles and impassably shallow water. Its cost also accounts for shallow-water risk and exposure far from shore. This produces routes that follow navigable water rather than drawing straight lines through islands.

### Regional route selection

Route demand considers:

- Population connected
- Port capacity and type
- Island roles
- Route distance
- Existing bridge competition
- Whether a pair is already connected

The generator first builds a maritime regional backbone between disconnected island groups and can then add a limited number of valuable extra connections.

Route types include:

- Fishing route
- Passenger ferry
- Cargo route
- Coastal route
- Open-water route
- Smuggling route
- Story route

### Travel times and danger

Each route calculates:

```text
boarding time
+ water distance × tile scale ÷ vessel speed
= estimated journey time
```

Routes also receive a 0–1 danger rating from distance, open-water exposure, and shallow-water risk.

### Maritime encounters

Every generated or custom route includes a deterministic weighted encounter table. Examples include sudden fog, engine failure, a missing passenger, floating shrines, and ghost vessels.

DM Mode now provides:

- Route itinerary and estimated travel time
- Vessel and danger level
- Map focus
- Weighted maritime encounter rolls
- Maritime entries in the recent-roll log

### Port and route editor

The World Editor now allows you to:

- Add custom ports to selected islands
- Rename and reclassify ports
- Change capacity
- Move ports to another valid coastal point
- Lock, suppress, delete, or reset ports
- Add routes between any two ports
- Change route type and vessel class
- Override travel time and danger
- Enable or disable service
- Lock, suppress, delete, or reset routes

All changes are non-destructive overrides and support undo/redo.

### Partial regeneration

```text
Port edit
→ ports and access roads
→ water routes
→ accessibility
→ blocks and zoning
→ buildings, vegetation, and story

Water-route edit
→ water routes
→ accessibility and downstream analysis
```

Roads now track bridge and port ownership independently. This prevents stale approach roads from surviving partial regeneration.

### Rendering and exports

Independent layers were added for:

- Ports
- Port labels
- Water routes
- Water-route labels

Imported artwork can target:

```text
infrastructure:port
infrastructure:water-route
```

Ports and routes are included in World JSON, override files, and full-map PNG exports.

## Run locally

```bash
corepack enable
pnpm install
pnpm dev
```

## Validate

```bash
pnpm check
pnpm test:ms9
pnpm test:ms10
pnpm test:ms11
pnpm build
```

## Current focused result

The Milestone 11 archipelago fixture generated:

| System | Result |
|---|---:|
| Islands | 5 |
| Bridges | 3 |
| Ports | 4 |
| Water routes | 6 |
| Passenger routes | 6 |
| Combined travel time | 149 minutes |

See [`docs/MILESTONE_11.md`](docs/MILESTONE_11.md) and [`docs/VALIDATION_11.md`](docs/VALIDATION_11.md) for architecture and validation details.
