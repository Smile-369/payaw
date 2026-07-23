# Milestone 16.1 Validation

## Completed checks

### Strict TypeScript

```text
npm run check
```

Passed with the project's strict TypeScript configuration.

### Focused Milestone 16 test

```text
npm run test:ms16
```

Passed checks for:

- Schema version 16
- Generation version `payaw-m16-npc-routing-v2`
- Deterministic NPC generation
- NPC travel-location registration
- Anchor graph minimum degree of two in the test world
- Arbitrary Point A and Point B location construction
- Three distinct driving-route results
- Category-toolbar presence
- NPC and travel controls
- No Story Flow controls or implementation references
- No duplicate HTML IDs

Focused output is stored in `MS16_TEST_RESULTS.json`.

### Production build

```text
npm run build
```

Passed with Vite 8.1.5:

- 110 modules transformed
- Main application bundle emitted
- Separate generation-worker bundle emitted
- Production `dist` directory rebuilt

### Extracted-archive verification

The release archive was extracted to a clean temporary directory. Using the installed dependency tree only as a local package cache, the extracted source passed:

- `npm run check`
- `npm run test:ms16`
- `npm run build`

The distributed archive excludes `node_modules` and includes the ready-built `dist` directory.

### Previous-system regression checks

Passed:

- Milestone 13 world-layout test
- Milestone 14 scheduler, cancellation, and satellite-count test

The legacy Milestone 15 focused test is pinned to schema 15 and generation version `payaw-m15-studio-ui-v1`, so it is not a valid version assertion for a schema-16 build. Its UI features are covered by TypeScript compilation, the production build, and the current Milestone 16 DOM assertions.

## Static DOM audit

Passed:

- 283 unique element IDs
- No duplicate IDs
- Nine toolbar category menus
- Point A / Point B controls present
- NPC generator controls present
- No legacy Story Flow form or flow-list placeholders

## Browser-test boundary

No automated interactive Chromium pass is claimed for this revision. Compilation, engine tests, DOM assertions, and production bundling passed, but UI interactions should still receive a manual browser QA pass before release tagging.

## Travel-model boundary

Travel results are deterministic campaign estimates derived from generated PAYAW data. They are not live navigation and do not include real-world traffic feeds, actual jeepney franchises, road restrictions, or external mapping data.
