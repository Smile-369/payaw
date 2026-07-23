# Milestone 15 Validation

Validation date: 2026-07-19

## Release checks

Passed:

- `npm run check`
- `npm run test:ms15`
- `npm run test:ms14`
- `npm run test:ms13`
- `npm run test:ms12`
- `npm run test:ms111`
- `npm run test:ms11`
- `npm run test:ms10`
- `npm run test:ms9`
- `npm run test:ms82`
- `npm run test:ms81`
- `npm run test:ms8`
- `npm run build`

## Production build

- Vite: 8.1.5
- Modules transformed: 106
- HTML: 48.51 kB, 10.28 kB gzip
- CSS: 41.88 kB, 9.33 kB gzip
- Main JavaScript: 329.54 kB, 94.76 kB gzip
- Generation worker: 161.37 kB
- Source map emitted for the main bundle

## Focused Milestone 15 results

- World schema: 15
- Engine generation version: `payaw-m15-studio-ui-v1`
- Zero-satellite world: one primary settlement
- Default focused layout: Single Large Island
- Inspector markup and implementation: present
- Searchable layer manager: present
- Minimap and status bar: present
- Command palette: present
- Project autosave and restore: present
- Recent-world profiles: present
- Dark, Light, and High Contrast appearances: present
- Toast notification system: present
- Collapsible left and right panels: present

## Regression results

All focused Milestone 8–14 regression scripts completed after updating the schema-compatibility assertions to accept the Milestone 15 schema.

Core deterministic generation results remained stable for:

- World layouts
- Metro-scale island controls
- JSON import and normalization
- Stale-position recovery
- Maritime routes
- Bridges
- Regional settlements
- Editor/DM workspaces
- Story authoring and encounters

## Browser smoke-test note

The production application and worker bundles compiled successfully. A Chromium screenshot smoke test was attempted in the container, but the container's headless Chromium process did not terminate within the execution window. Its captured log contained environment-level DBus/inotify messages and no JavaScript exception output. The release gate therefore uses TypeScript, Vite production bundling, focused static UI assertions, and engine regression tests rather than claiming a completed interactive browser automation run.
