# Milestone 8.2 — Editor / DM Workspaces

## Goal

Separate world creation from session operation so a DM can run PAYAW without navigating generation and authoring controls.

## Workspace model

### World Editor

Owns mutable authoring controls:

- Generation profile
- Map layers
- Anchor rules and positions
- Road and block names
- Zone painting
- Asset import and placement
- Label styling
- Story-point definitions and rules
- Export/import

### DM Mode

Owns session-facing controls:

- Story-focused map preset
- Story-site search
- Per-site encounter rolls
- Town-wide random encounter rolls
- Map focus
- Recent encounter log

Entering DM Mode calls both `setEditMode(false)` and `setZoneEditMode(false)`. This prevents accidental map edits during play.

## State boundaries

| State | Persistent | Regenerates world |
|---|---:|---:|
| Active workspace | Yes | No |
| DM search | No | No |
| DM session log | No | No |
| Map view preset | Presentation only | No |
| Editor overrides | Yes | Sometimes partially |
| Seed/profile | Yes | Yes |

## Story encounter flow

```text
Story site
→ weighted encounter selection
→ DM result card
→ session log entry
```

Town-wide rolls first select a story site with available encounters, then use that site's weighted table.

## UI hierarchy

The fixed sidebar shell contains:

1. Brand header
2. Workspace switcher
3. Workspace context
4. Independently scrolling workspace panel
5. Compact interaction footer

This keeps navigation visible while long authoring forms remain scrollable.
