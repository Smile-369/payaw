# Milestone 18 Validation

Validation date: 2026-07-21

## Release gate

The PAYAW release gate intentionally excludes the legacy monolithic `npm run test:engine` stress suite.

### Passed

- `npm run check`
- `npm run test:ms18`
- `npm run test:ms171`
- `npm run test:ms164`
- `npm run test:ms162`
- `npm run test:ms82`
- `npm run build`

## Milestone 18 behavioral coverage

The focused suite verifies:

- Schema version 18 and generation version metadata
- Authored settlement creation at exact GM coordinates
- Settlement kinds, hierarchy, metadata, and per-settlement generation switches
- Generated settlement movement and override persistence
- Terrain paint and absolute elevation override
- Authored road generation without duplication during granular regeneration
- Hidden Payaw feature persistence
- Stable generated-road suppression
- Stable generated-building suppression
- Deterministic terrain restoration after removing an override
- Public npm lockfile and synchronized release version
- Required authoring UI controls and settlement kinds
- Authoring pipeline stages and renderer integration
- Infrastructure exceptions disabled by default
- Zoom-aware infrastructure rendering
- Manual infrastructure exception priority

## Retained regression coverage

- Milestone 17.1 NPC continuity, event persistence, timezone validation, and restricted infrastructure routing
- Milestone 16.4 cross-island settlement ownership and destination road activation
- Milestone 16.2 campaign clock and NPC schedule resolution
- Milestone 8.2 editor/DM workspace separation and collapsed editor modules

## Build output

Vite production build generated:

- `dist/index.html`
- `dist/assets/index-*.css`
- `dist/assets/index-*.js`
- `dist/assets/generation.worker-*.js`

## Known architectural boundary

Milestone 18 edits generated roads and buildings through non-destructive adoption and replacement geometry. It does not mutate generator graph nodes or building records in place. This is deliberate: the generated source remains recoverable, and authored replacements remain stable across regeneration.
