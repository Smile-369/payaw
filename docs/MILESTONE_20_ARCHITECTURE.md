# Milestone 20 Architecture — Campaign System

## Layering

PAYAW now has four local data layers:

```text
Deterministic Generated World
            ↓
Non-destructive World Authoring Layer
            ↓
NPC and Location Authoring Layer
            ↓
Campaign State and Run State
```

The campaign references the other layers through stable IDs. It does not own or duplicate terrain, buildings, community anchors, NPC biographies, weekly schedules, or location metadata.

## Modules

### `src/campaign/CampaignSystem.ts`

Pure domain functions and schema definitions. It has no DOM dependency and is testable in Node.

Responsibilities:

- Campaign construction and normalization
- Scene lifecycle and participant staging
- Campaign clock and timezone
- Timeline eligibility and event execution
- Clues, handouts, objectives, and reveals
- Messaging
- Assets and notes
- Sessions, encounters, and checkpoints
- Activity/revision history
- Search, backlinks, and reference validation
- Campaign-only export manifest

Every consequential mutation returns a new `CampaignState`. The state revision increments and an activity record is appended.

### `src/campaign/CampaignStudio.ts`

DOM controller for the Campaign Studio.

Responsibilities:

- Bind dashboard and Scene Director controls
- Render campaign lists and summaries
- Translate form input into pure domain operations
- Request confirmation for consequential time/event operations
- Ask the host application for external NPC, location, character, and asset options
- Notify the host when campaign time, weather, active scene, or map focus changes
- Trigger persistence after state changes

The controller does not generate a world or mutate NPC records directly.

### `src/main.ts`

Application integration boundary.

Responsibilities:

- Own current `campaignState`
- Bind the campaign to the active world reference
- Include campaign state in autosave and project import/export
- Provide external reference catalogs
- Synchronize active-scene NPC placements
- Synchronize campaign time/weather with existing display systems
- Focus the map on linked campaign locations

## State shape

The top-level campaign contains immutable arrays and a mutable-by-replacement run-state object.

```text
CampaignState
├── metadata
├── runState
│   ├── activeSessionId
│   ├── activeSceneId
│   ├── campaignTime
│   ├── timezone
│   ├── weatherOverride
│   └── activeEncounterId
├── scenes[]
├── timelineEvents[]
├── clues[]
├── handouts[]
├── objectives[]
├── reveals[]
├── messageThreads[]
├── assets[]
├── notes[]
├── sessions[]
├── encounters[]
├── checkpoints[]
├── activity[]
└── revision
```

## Stable references

References are string IDs, not array indexes. External references use source-specific prefixes where appropriate, for example:

- `npc:<id>`
- `location:<stable-ref>`
- `character:<id>`
- `payaw-asset:<id>`
- `campaign-scene:<scene-id>` for NPC scene placement

Missing references are preserved and reported. This prevents an import or regeneration from silently changing campaign meaning.

## Mutation model

Domain functions use immutable replacement:

```text
User action
  → domain validation
  → new CampaignState
  → revision + activity record
  → host callbacks
  → autosave
  → rerender
```

This enables checkpointing, deterministic tests, future offline synchronization, and later server-side authorization.

## Time model

Campaign time is stored as an ISO timestamp, while display uses the campaign's IANA timezone. Timezone changes do not rewrite the stored instant.

Time advancement produces a preview containing:

- From timestamp
- To timestamp
- Minute delta
- IDs of events crossed
- Large-jump flag

The UI uses this preview to avoid accidental skips.

## Event-safety model

Timeline evaluation and action execution are separate.

```text
Scheduled event
  → eligible
  → GM confirmation
  → triggered
  → actions applied once
  → activity recorded
```

Ordinary already-triggered events cannot execute twice. `triggerCount` and `lastTriggeredAt` provide an audit trail. Recurring events retain explicit recurrence metadata rather than relying on a background timer.

## Reveal model and future player projections

Milestone 20 stores reveal records without computing a Player View. This is intentional. Milestone 22 can derive projections from:

- Reveal audience
- Revocation state
- Campaign entity public fields
- External location/NPC knowledge rules
- Active scene and session context

No GM-secret field needs to be filtered inside the current UI because no player client exists yet.

## Checkpoint boundaries

A campaign checkpoint snapshots:

- Run state
- Scene statuses
- Event statuses
- Objective statuses
- Reveal records

It intentionally excludes:

- Generated world
- World authoring overrides
- NPC biographies and schedules
- Campaign assets and note bodies
- Session/activity history

This prevents a live-session rollback from destroying preparation or world edits.

## Persistence

Schema-20 project data stores campaign state with existing authoring data. Import follows this sequence:

1. Parse and validate project root.
2. Normalize world/authoring/NPC-location data.
3. Normalize campaign data against the imported world reference.
4. Rebuild external-reference catalogs.
5. Restore campaign time/weather and active scene placement.
6. Render Campaign Studio and save a normalized autosave.

## Offline and deployment direction

Milestone 20 remains local-first. The immutable domain API is structured so later milestones can move persistence and authorization behind a service without rewriting campaign semantics.

For the seven-person deployment target, the Design Bible's future default remains:

```text
Cloudflare Pages
       ↓
Supabase Free
├── Postgres
├── Auth
├── Realtime
└── Storage
```

That backend is not introduced until Player View and Player Netcode need it.
