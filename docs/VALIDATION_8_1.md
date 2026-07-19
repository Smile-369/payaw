# Milestone 8.1 Validation

## Passed

- Strict browser-source TypeScript compilation: `tsc --noEmit`
- Engine/test TypeScript compilation: `tsc -p tsconfig.test.json`
- Existing focused Milestone 8 runtime test
- Focused Milestone 8.1 runtime test
- Browser-authored custom story-point generation
- Six built-in story points plus one custom point
- Deterministic automatically generated encounter tables
- Non-empty encounters for every tested story point
- Key-based story position override
- Key-based name, wish, manifestation, radius, and encounter overrides
- Partial `story-layer` regeneration equals full generation
- Weighted encounter interval boundaries
- Bounded undo history
- Undo/redo state transfer and redo invalidation
- 142 required UI selectors found in `index.html`
- No missing required DOM ids
- Strict compilation after renderer viewport-culling changes

## Source/runtime results

See:

- `MS81_TEST_RESULTS.json`
- `DOM_AUDIT_8_1.json`

## PNG export validation boundary

The PNG export API, UI wiring, TypeScript types, detached-renderer path, canvas-size guard, and blob-download flow compile successfully. Automated PNG encoding was not executed in Node because `HTMLCanvasElement.toBlob()` requires a browser canvas implementation.

## Production bundle limitation

A fresh Vite bundle was not run in this environment because project dependencies are not installed and the package registry is unavailable. The project is intended to build normally after `pnpm install` in an environment with registry access.

## Legacy suite note

The broad legacy engine suite exceeded a five-minute validation window. It performs many complete terrain, erosion, hydrology, road, building, and profile generations. This timeout is recorded as an incomplete legacy-suite run, not as a failed Milestone 8.1 assertion. The focused Milestone 8 and 8.1 suites passed.

## Undo boundary

Undo/redo covers editor overrides and placed-image transforms. It does not restore deleted IndexedDB image binaries, reverse a newly generated seed/profile, or undo browser file imports themselves. Placements made from imported assets are included in history.
