# Milestone 17 Validation

## Completed checks

### TypeScript

`npm run check` completed with no TypeScript errors under the project’s strict configuration, including:

- `strict`
- `noUncheckedIndexedAccess`
- `noUnusedLocals`
- `noUnusedParameters`
- `exactOptionalPropertyTypes`

### Focused Milestone 17 test

`npm run test:ms17` passed.

Validated behavior:

- Schema version 17
- `payaw-m17-living-world-v1` generation version
- Campaign clock restoration and time advancement
- Metro-style evening rush profile
- Dynamic state for every generated NPC
- Live weather and traffic applied during pathfinding
- Current-condition travel slower than the normal estimate in the tested rainy rush-hour scenario
- Manual road closure exposed to routing
- Typhoon suspension of generated water routes
- Storm-amplified supernatural state
- Simulation JSON serialization
- Required simulation UI controls
- No duplicate HTML IDs

Focused test result:

```json
{
  "schemaVersion": 17,
  "generationVersion": "payaw-m17-living-world-v1",
  "npcCount": 30,
  "trafficProfile": "Evening rush",
  "normalTravelMinutes": 3.08,
  "liveTravelMinutes": 6.48,
  "waterRoutesSuspended": 1,
  "simulationRevision": 3
}
```

### Regression checks

The following retained systems passed their existing focused tests during this release build:

- Milestone 13 world layouts
- Milestone 14 staged generation, cancellation, deterministic async generation, and zero-satellite mode
- Milestone 15 Studio UI foundation
- Milestone 16 NPC generation, road forks, alternate routes, and Point A → Point B routing
- Milestone 16.2 NPC visibility and clock helpers
- Milestone 16.3 settlement placement safety
- Milestone 16.4 cross-island settlement reassignment

The Milestone 16 regression’s version assertion was updated to accept the Milestone 17 schema and generation lineage while retaining all routing, NPC, and road-network checks. Its behavior checks were not removed.

### Production build

`npm run build` passed.

- Vite 8.1.5
- 119 modules transformed
- Main application bundle emitted
- Separate generation-worker bundle emitted
- Source maps emitted
- Ready-built `dist` directory included

Build output:

```text
dist/index.html                             58.12 kB
dist/assets/generation.worker-B_4luZ6g.js  168.62 kB
dist/assets/index-COE_XnqI.css              49.00 kB
dist/assets/index-B487afzQ.js              382.47 kB
```

## Browser validation limitation

The Vite development server started successfully and returned HTTP 200. A container-based Chromium screenshot run did not terminate because Chromium could not initialize normally in the restricted container environment. The release therefore does not claim a completed automated interactive-browser screenshot pass.

The application did pass strict compilation, static DOM auditing, focused runtime tests, regression tests, and the production build.

## Extracted archive validation

The final `.tar.gz` was extracted into a clean temporary directory. From the extracted copy, the following commands passed:

```bash
npm ci
npm run check
npm run test:ms17
npm run build
```

The extracted build again transformed 119 modules and emitted the main and generation-worker bundles.
