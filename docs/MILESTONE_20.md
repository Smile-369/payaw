# Milestone 20 — Campaign System

## Product intent

Milestone 20 changes PAYAW from a world-and-NPC authoring environment into a tool that can also organize and run a tabletop campaign. The system remains GM-directed: it records intent, continuity, reveals, and session state, but it never becomes the storyteller.

This milestone is local and single-GM. Player View, accounts, network synchronization, and hosted collaboration are explicitly deferred to Milestones 22 and 23.

## Core campaign container

A `CampaignState` is attached to a stable authored-world reference and stores:

- Campaign identity, status, tags, premise, themes, and safety notes
- Mutable run state for the active session, scene, time, timezone, weather, and encounter
- Scenes and scene presentation settings
- Timeline events and trigger state
- Clues, handouts, objectives, and reveal records
- Message threads and messages
- Campaign assets
- Notes and preparation checklists
- Sessions, encounters, checkpoints, and activity history
- Revision number and schema metadata

Campaign data is serialized with project exports, imports, and autosave. World generation and authoring remain separate layers so restoring a campaign checkpoint cannot silently rewrite terrain, roads, locations, or NPC biographies.

## Campaign dashboard

The dashboard is the campaign entry point. It exposes the live operational state without requiring the GM to inspect multiple authoring panels.

It reports:

- Campaign name and lifecycle state
- Current session and active scene
- Campaign date/time and timezone
- Current weather override
- Upcoming or eligible events
- Reveal, revision, and reference-health counts
- Preparation checklist
- Recent activity

The dashboard supports starting or continuing a session, ending the current session, adding preparation tasks, exporting/importing campaign JSON, and jumping to live tools.

## Scene Director

The Scene Director is the primary session-running surface. A scene contains authored material, links, and presentation defaults rather than autonomous game logic.

Scene records support:

- Draft, ready, active, paused, completed, and archived states
- Name, type, arc, target session, and tags
- Stable campaign-location reference or freeform location
- GM description, player description, sensory details, and read-aloud text
- Character, NPC, and group participants
- Clue, handout, message-thread, note, and asset references
- Exits to other scenes
- Ambient and reveal assets
- Default map focus, weather, and time

Activating a scene:

1. Marks the selected scene active.
2. Pauses any previously active scene.
3. Updates campaign run state.
4. Applies staged NPC placements through the existing author-driven placement system.
5. Records an activity entry and revision.
6. Evaluates scene-activation events without automatically executing consequential actions.

The GM can pause or complete the active scene, change weather/time, stage participants, reveal information, queue a message, start an encounter marker, or write a live note without leaving the director.

## Campaign time

Campaign time is explicit and deterministic. It does not run continuously unless the GM changes it.

Supported controls include:

- +5 minutes
- +15 minutes
- +30 minutes
- +1 hour
- Next morning
- Next evening
- Tomorrow
- Exact date and time
- Valid IANA timezone

Before a change is committed, the system can identify scheduled events crossed by the jump. A jump of four hours or more is classified as a large jump and is presented as consequential. Events crossed by time become eligible; they are not silently fired.

## Timeline and events

Timeline events support:

- Manual trigger
- Exact campaign time
- Scene activation
- Offset relative to another event
- Start/end time window
- Named condition
- Recurrence by minute interval

An event can be scheduled, eligible, triggered, skipped, delayed, completed, reverted, or failed. Events are enabled independently and can require confirmation. Trigger counts and last-triggered timestamps enforce idempotency for ordinary events.

Available event actions include:

- Activate a scene
- Queue a reveal
- Change weather
- Add a note
- Change an objective status
- Send a prepared message
- Advance campaign time

The default policy is **preview first, confirm second, execute third**. Event automation is assistance, not authority.

## Information model

### Clues

Clues separate GM-facing and player-facing titles. They store description, source, links to other campaign entities, and hidden/available/revealed state.

### Handouts

Handouts reference a campaign asset and store caption, alternate text, linked scenes, and presentation order.

### Objectives

Objectives separate GM intent from player wording and support dependencies, hidden/active/completed/failed/abandoned states, and completion notes.

### Reveal records

A reveal is an append-only record of what was exposed, to whom, when, and why. It stores:

- Entity type and ID
- Party, GM-only, or individual-player audience
- Source scene, session, and event
- Timestamp and GM note
- Whether it is reversible
- Revocation timestamp

Milestone 20 records reveals locally. Milestone 22 will transform those records into player-facing knowledge projections.

## In-world messaging

Message threads represent Messenger, SMS, email, letters, radio logs, supernatural contact, or another authored medium.

Each message stores:

- Sender reference and label
- Body and audience
- Draft, queued, sent, received, read, failed, or cancelled status
- Optional scheduled timestamp
- Linked scene
- Typing delay
- Glitch flag and corruption amount
- Optional sound asset

The Campaign Studio can create threads, save drafts, and queue scheduled messages. There is no remote delivery in this milestone.

## Assets

The campaign asset registry is metadata-first and can point to imported PAYAW assets or external URIs.

Asset records support:

- Image, audio, document, video, or external-link type
- URI and MIME type
- File size and dimensions
- Duration
- Alternate text and caption
- Tags and rights note
- Optional checksum

Reference validation detects missing assets used by scenes, handouts, messages, and encounters.

## Sessions and checkpoints

Sessions support planned, active, paused, and completed states. They retain:

- Number and title
- Planned, started, and ended timestamps
- Attendees
- Prepared and used scenes
- Opening scene/time
- Live logs and notes
- Recap and unresolved threads
- Next-session checklist
- Checkpoint references
- Unused prepared scenes

A checkpoint snapshots campaign run state plus scene, event, objective, and reveal status. Restoring one is revisioned and logged. It does not restore or mutate world-generation data.

## Encounters

An encounter is a lightweight campaign marker, not a combat engine. It records name, trigger, participants, notes, assets, start, and end time. It exists to help the GM organize a moment without imposing initiative, statistics, or rules.

## Search and reference health

Global campaign search returns campaign entities such as scenes, events, clues, handouts, objectives, message threads, notes, sessions, and assets. Backlink lookup reports which entities reference a selected record.

Reference validation checks stable IDs against:

- Campaign scenes and events
- Objectives, messages, notes, and assets
- External NPC, location, character, and imported-asset IDs supplied by the main application

Broken references remain visible to the GM instead of being silently discarded.

## Persistence and migration

Campaign schema version is 20. `normalizeCampaignState` accepts absent or partial campaign data, fills safe defaults, validates timezones, normalizes collections, and binds the state to the current world reference.

Project export/autosave includes the campaign next to world, authoring, simulation, and NPC/location data. Campaign-only export/import is also available for backup and transfer.

## Explicit exclusions

Milestone 20 does not include:

- Player-facing UI or knowledge projection rendering
- User accounts, authentication, or permissions
- Supabase or another hosted backend
- WebSocket or Realtime synchronization
- Remote message delivery
- Shared cursors or collaborative editing
- Rule-system combat automation
- Full Milestone 21 visual restructuring

## Definition of done

Milestone 20 is complete when the GM can:

- Create/import a campaign tied to an authored world
- Start and complete a session
- Create, prepare, activate, pause, and complete scenes
- Stage NPCs and characters in a scene
- Advance campaign time and see crossed events before triggering them
- Create and safely trigger timeline events
- Create clues, handouts, objectives, and reveal records
- Organize in-world message threads and scheduled drafts
- Register campaign assets
- Keep live notes and a preparation checklist
- Start and end lightweight encounter markers
- Create and restore checkpoints
- Search campaign content and inspect broken references
- Preserve all campaign state through save, autosave, export, and import
