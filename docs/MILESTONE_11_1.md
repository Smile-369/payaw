# Milestone 11.1 — Saved Position Recovery

Milestone 11.1 is a compatibility and resilience patch for authored map positions.

## Problem

Manual anchor and story positions are stored against a generated-world signature. A position may still become invalid after terrain-generation changes, imported older customization data, or edits to the underlying profile. Previously, one stale position could abort the entire generation run with an error such as:

> Manual position for anchor “Town Plaza” must be on dry land.

## Behavior

Interactive edits remain strict: dragging an anchor or story point onto water, outside the map, onto a forbidden island, or into a disallowed zone is rejected.

Full world generation is now fault tolerant:

1. The pipeline identifies the exact stale anchor or story override with a typed error.
2. The browser removes only that invalid position record.
3. Generation retries automatically.
4. The object returns to its deterministic procedural location.
5. The repaired customization state is persisted.
6. A warning reports which saved position was reset.

All other authoring data remains intact, including names, zone edits, assets, islands, bridges, ports, water routes, and valid moved objects.
