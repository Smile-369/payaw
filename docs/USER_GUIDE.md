# PAYAW User Guide

## WORLD workspace

### Generate

Choose a seed, terrain extent, density, world layout, climate, island count, and spacing. The same seed and profile regenerate the same procedural foundation.

Generating a new profile can invalidate manual positions. PAYAW attempts to recover stale positions and reports anything it cannot preserve.

### Map and authoring

Use the WORLD tools to:

- Inspect terrain, roads, buildings, communities, anchors, and story sites.
- Add or override communities and point anchors.
- Draw authored map features and replace supported generated features.
- Move supported objects while retaining their stable identity.
- Paint zoning and terrain overrides.
- Import images, assign procedural targets, and place decorations.
- Configure road and block labels.

Authoring is non-destructive. Generated data remains underneath, and removing an override restores the generated result.

### NPCs and locations

NPCs can have profiles, portraits, relationships, schedules, temporary overrides, and scene placements. Locations can have player-facing descriptions, owners, visibility, hours, and operational state.

Use **Export selected NPC** to move one profile. **Export NPC group** exports
the current NPC search results, or the entire roster when the search is empty.
**Import NPC JSON** accepts either form and adds the records as authored NPCs.
Relationships within an imported group are retained. World-specific homes,
workplaces, and schedule locations are restored when they still exist and
otherwise fall back safely in the destination world.

Use GM-only visibility for information that must never enter a player projection.

### Project and recovery

The Project panel provides:

- Compact, reproducible world/project JSON export and backward-compatible import
- PNG map export
- Browser autosave recovery
- Recent-world shortcuts
- Appearance settings

World JSON stores the seed, generation profile, authoring changes, campaign
state, and required assets. It does not duplicate reconstructible generated
tiles, roads, buildings, vegetation, story objects, or NPC records. Export
important NPCs separately from the NPC Generator.

Autosave is a convenience, not a backup. Export the world and relevant NPC
groups after meaningful edits.

## CAMPAIGN workspace

### Dashboard and preparation

The dashboard summarizes preparation health and campaign time. Campaign preparation includes scenes, timeline events, clues, handouts, objectives, messages, assets, notes, sessions, checkpoints, and search.

### Run

The Run panel focuses the active scene and player-facing controls. Confirm secret-revealing or state-changing actions before applying them.

### Players

Configure the table size, player identities, character ownership, capabilities, knowledge grants, and map policy. Preview every player before publishing.

The safe preview is recipient-specific. Information absent from that projection is not sent to the Player Portal.

## Hosted rooms

1. Configure Supabase and deploy the backend.
2. Sign in with the GM account.
3. Create or load a campaign room.
4. Synchronize player views.
5. Create credentials for each player slot.
6. Give each player the permanent portal URL, campaign ID, username, and password.

Resetting or disabling a player login revokes the previous account’s access.

After GM sign-in, **Previously hosted campaigns** lists every room available to
that GM account. Selecting one fills the Campaign ID; press **Load campaign** to
confirm replacing the local campaign state with its hosted authority document.

## Player Portal

Players open `?view=player`, enter their campaign ID and credentials, and receive only their authorized projection.

After a successful join, the portal remembers that campaign name, Campaign ID,
and username on the current device. The next visit can select it under **Recent
campaigns** and enter only the password. Players can forget individual entries;
passwords are never stored.

Player modules include campaign overview, map, scenes, journal, people, places, evidence, handouts, objectives, character sheets, messages, travel, and dice. Available actions depend on capabilities granted by the GM.

The Player map supports drag-to-pan, mouse-wheel or button zoom, touch panning,
Fit, Region/Town/Terrain/Hydrology/Planning views, and individual recipient-safe
layer toggles. NPC, hidden-story, and GM-authoring layers are never sent to the
Player Portal. Player pings are shared with the party, and private messages sent
to the GM appear in the GM’s **Player messages & actions** panel.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd + P | Open commands |
| Ctrl/Cmd + S | Save compact World JSON |
| Ctrl/Cmd + O | Open project JSON |
| F | Fit the map or focus the selection |
| Arrow keys / + / - | Pan or zoom the focused Player map |
| `[` / `]` | Toggle workspace panels |

## Backup checklist

- Export a world project before a session.
- Export important NPC groups separately.
- Export both again after major authoring, NPC, or campaign changes.
- Keep important handouts outside browser storage.
- Confirm a recent export imports successfully before relying on it.
- For hosted play, retain an offline campaign export in addition to Supabase data.
