# Milestone 9 Validation

Validation was run against the Milestone 9 source project on July 19, 2026.

## Passed

### TypeScript

- Strict browser/source compilation: `npx tsc --noEmit`
- Strict engine/test compilation: `npx tsc -p tsconfig.test.json --noEmit`

### Existing feature regression suites

- Milestone 8 zone and story authoring test
- Milestone 8.1 custom story, encounter, partial regeneration, and undo/redo test
- Milestone 8.2 Editor/DM workspace and collapsed-module audit

### Milestone 9 focused runtime test

A deterministic semi-urban archipelago generated:

- 5 physical landmasses
- 5 gameplay islands
- 4 settlements
- 22,000 allocated regional population
- 56 roads
- 32 blocks

The focused test verifies:

- Schema version 9
- At least three distinct archipelago landmasses and islands
- Every land tile belongs to a physical landmass
- Landmass tile membership is internally consistent
- Exactly one primary-settlement island
- Every island references an existing landmass
- Island population stays between zero and capacity
- Island ownership is written back to its landmass tiles
- Every settlement center is on its assigned island
- Settlement and island references agree in both directions
- Every generated settlement has valid road integration
- Same-seed regional output is deterministic
- Island name, role, development, population weight, settlement count, capability, nature, and lock overrides apply correctly
- An island override can regenerate two requested settlements

Results are stored in `docs/MS9_TEST_RESULTS.json`.

## Production bundle status

The Vite production bundle could not be rerun in this environment because the project did not contain installed `node_modules`, Corepack attempted to download pnpm, and the package registry was unavailable (`EAI_AGAIN registry.npmjs.org`).

This is an environment/dependency-availability limitation. TypeScript source and tests compiled successfully, and all four focused runtime/UI suites passed. After `pnpm install` in an online environment, run:

```bash
pnpm build
```

## Known milestone boundary

Milestone 9 exposes `allowPorts` and `allowBridges` island policies but does not create bridge, port, ferry, or shipping-route entities. Those are intentionally reserved for the next regional transport milestones.
