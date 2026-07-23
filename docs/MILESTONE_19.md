# Milestone 19 — NPC and Location Authoring

## Product intent

PAYAW supports a GM running a TTRPG campaign. It maintains continuity but does not autonomously decide campaign canon.

## Community anchors

Communities use the unified Anchor points UI. The GM selects Point of Interest, City, Town, Barangay, Subdivision, Neighborhood, Village, Sitio, District, Compound, or Custom Community and places the anchor directly on the map.

There is no satellite-settlement quantity in Generation, no separate Settlements toolbar category, and no Island Editor. Community anchors and point anchors share one authoring workflow. Geographic ownership is derived from the anchor's placed coordinates.

## NPC model

Generated NPCs are suggestions and authored NPCs are first-class records. Both expose the same editor. Generated data is overridden non-destructively and can be restored.

Home assignment accepts residential building types by default. An explicit unusual-residence override is required for any other building type. A missing residential assignment remains visibly unassigned rather than pretending the settlement center is a house.

## Schedule model

Weekly schedule entries contain:

- Day of week
- Start and end minute
- Activity
- Stable location reference
- Travel description
- Visibility

Overlaps are rejected. Gaps resolve to the residential home.

Placement precedence:

1. Active scene placement
2. Temporary GM override
3. Weekly schedule block
4. Residential home

The resolver answers where the NPC is for the current campaign time. It does not simulate a commute.

## Locations

Buildings, generated anchors, community anchors, and authored features can receive campaign metadata and venue hours. Manual statuses override weekly hours.

## Persistence

`npcLocationAuthoring` is stored with map customization, autosaves, project exports, imports, schema normalization, and undo-safe world regeneration.
