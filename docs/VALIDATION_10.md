# Milestone 10 Validation

Validation was run against the Milestone 10 source project on July 19, 2026.

## Passed

### Strict compilation

- Browser/source TypeScript: `tsc --noEmit`
- Engine/test TypeScript: `tsc -p tsconfig.test.json`

### Existing focused regressions

- Milestone 8 asset, zoning, and story authoring
- Milestone 8.1 custom story points, encounters, partial regeneration, and undo/redo
- Milestone 8.2 Editor/DM workspace audit
- Milestone 9 regional landmass, island, settlement, and population test

The Milestone 9 regression produced:

- 5 physical landmasses
- 5 gameplay islands
- 4 settlements
- 22,000 allocated population
- 65 roads after bridge integration
- 36 blocks

### Milestone 10 bridge runtime test

A deterministic semi-urban archipelago produced:

- 5 islands
- 3 generated bridges
- 71.49 tiles of total span
- 6 approach roads
- 3 bridge deck roads

The focused test verifies:

- Schema version 10
- At least one bridge on the archipelago profile
- Same-seed bridge-network determinism
- Different origin and destination islands
- Valid coast endpoints on their assigned islands
- Non-empty water deck for every bridge
- Bridge-owned deck road references
- Bridge-owned approach-road references
- Bidirectional island-to-bridge references
- Every deck tile is water, road-enabled, and bridge-enabled
- Editable name, type, road class, width, clearance, and lock state
- Suppression of a generated bridge
- Creation of a custom bridge
- Automatic duplicate prevention for a custom island pair
- Partial regeneration from the bridge stage matching a full generation

The focused result is stored in `docs/MS10_TEST_RESULTS.json`.

### UI wiring audit

- 184 HTML IDs found
- 184 unique HTML IDs
- 179 literal `requireElement()` selectors checked
- No missing selectors
- No duplicate IDs

## Long exhaustive suite

The legacy all-seed engine regression was started but exceeded the available validation window after fifteen minutes. It is substantially more expensive than the focused milestone suites because it repeatedly runs the full erosion, hydrology, regional, road, building, vegetation, and story pipeline.

This timeout is not reported as a pass. Strict compilation and all focused Milestone 8 through Milestone 10 tests completed successfully.

## Production bundle status

A fresh Vite production bundle was not rerun because project dependencies were not installed in the environment and registry access was unavailable. The source uses the existing Vite configuration and passed strict browser TypeScript compilation.

After installing dependencies in an online environment, run:

```bash
pnpm build
```

## Milestone boundary

This release creates road bridges and their approaches. It intentionally does not create ports, ferries, shipping routes, schedules, traffic simulation, or multimodal travel-time calculations.
