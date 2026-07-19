# Island Gen terrain compatibility

Milestone 5 preserves the uploaded Island Gen generator as the canonical base-elevation stage.

The compatibility boundary is intentionally precise:

```text
seed
  -> root deterministic RNG
  -> `terrain` fork
  -> vendored Noise2D
  -> five-octave FBM
  -> PAYAW regional bias
  -> source Float32 elevation field
```

The terrain-contract regression applies only to this source elevation field. Later Milestone 5 stages are expected to modify it:

```text
source elevation
  -> spline-masked mountain ridges
  -> thermal erosion
  -> hydraulic erosion
  -> river channel carving
  -> delta deposition
  -> final terrain
```

This arrangement preserves the authored Island Gen identity while allowing terrain processes to physically reshape the world.

## Why hydrology is a separate folder

`src/engine/hydrology` is separated from `src/engine/terrain` for cohesion and testing, not because rivers are an urban overlay.

The generation pipeline places `terrain-hydrology` before final terrain classification, anchors, roads, blocks, zoning, buildings, and vegetation. Its channel carving and deposition mutate tile elevation and bed elevation directly.

Therefore rivers are architecturally part of terrain generation while still having a maintainable hydrology domain module.
