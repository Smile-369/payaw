# Milestone 16.3 — Satellite Settlement Island Constraint

This patch prevents movable satellite settlements from leaving their assigned physical island.

## Editor behavior

- The drag preview is constrained continuously while the pointer moves.
- The marker snaps only among suitable dry tiles on its assigned island and landmass.
- Dragging over ocean or another island keeps the settlement at its last valid position.
- The cursor changes to `not-allowed` while the pointer is outside a valid placement area.
- Releasing the pointer can therefore never commit an off-island preview.

## Engine behavior

Imported JSON and saved overrides remain strictly validated during regeneration. An override is rejected when its target tile:

- belongs to another island,
- belongs to another physical landmass,
- is water or a river,
- is mountainous or too steep,
- is too flood-prone, or
- is too close to another settlement.

The editor and deterministic generator now share the same placement lookup instead of maintaining separate rules.
