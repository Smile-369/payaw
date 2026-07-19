# Terrain and hydrology note implementation

This document maps the requested terrain and river notes to the Milestone 5 implementation.

## Implemented

### Downstream hydraulic geometry

- Width: `W = a × Q^b`
- Depth: `D = c × Q^f`
- Default exponents: `b = 0.5`, `f = 0.4`
- Width and depth are stored both on river samples and affected terrain tiles.

### River shape

- Seeded multi-frequency centerline displacement
- Course-sensitive meander strength
- Curvature measurement
- Middle-course lateral channel expansion
- Downstream widening

### Hydraulic erosion

- Grid-based rainfall
- Surface gradient and water transfer
- Velocity estimate
- Sediment-capacity calculation
- Erosion below capacity
- Deposition above capacity
- Sediment transport
- Evaporation and infiltration

### Deltas

- Mouth detection near ocean-connected water
- Velocity-damping-derived deposition
- Shallow-water sediment bars
- Emergent delta land
- Configurable distributary branches
- Protected ocean outlet
- Post-deposition drainage repair

### River zones

- Upper course: vertical erosion and reduced meandering
- Middle course: maximum meandering, lateral erosion, and floodplain growth
- Lower course: widening and deposition
- Delta course: bars and distributaries

### Mountains

- Authored global range mask using a seeded spline centerline
- Ridged multifractal noise
- Voronoi/cellular fault ridges
- Thermal erosion and talus redistribution
- Hydraulic valley carving

## Explicitly deferred

A full multi-era channel-migration simulation with detached oxbow lakes is not implemented in this milestone. Configuration fields for cutoff distance and minimum loop length are retained for the future implementation. Current channels meander and widen laterally, but the engine does not label decorative ponds as oxbows without simulating the cutoff process.
