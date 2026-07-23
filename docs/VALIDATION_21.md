# Milestone 21.1 Validation

## Release

- Version: `0.21.1`
- Project schema: `20`
- Test policy: TypeScript, production build, focused Milestone 21.1 behavior, and retained milestone regressions
- Explicitly excluded: `npm run test:engine`

## QA verdict

PASS. The supplied Milestone 21 archive was not release-ready because its new shell still exposed and inherited incompatible legacy layouts. Milestone 21.1 repairs those defects and removes the water-route subsystem.

## Browser QA

The application was inspected in the in-app browser at 1024x768, 1366x768, and 1920x1080.

- WORLD and CAMPAIGN tabs remain inside their own 50 px command row and no longer collide with the menu/title bars.
- The default inspector dock remains closed after initialization.
- The map occupies approximately 73% of the 1366 px layout and 81% of the 1920 px layout.
- No horizontal document overflow was found at any tested width.
- Legacy road/block naming, bridge, port, and generalized authored-map forms are not visible.
- Anchors expose a Type category for Community / settlement and Point anchor.
- Anchor templates are collapsed until requested.
- WORLD > Story exposes a Remove action for every generated story point and Restore removed restores suppressed points.
- The regional-scale summary uses dark text on a light high-contrast surface.
- No browser console errors or warnings were observed.

## Water-route retirement

- Water-route generation stage removed.
- Water-route world state, rendering layers, labels, simulation statuses, routing mode, customization targets, and UI removed.
- Ports remain as coastal reference anchors; they no longer imply an automatically simulated ferry network.

## Performance work

- Removed water-route generation and draw work.
- Removed active route status calculations.
- Avoided rebuilding hidden bridge, port, and road/block name lists during every world refresh.
- Inspector and secondary anchor templates remain closed by default.

## Automated checks

Passed:

- `pnpm run check`
- `pnpm run build`
- `pnpm run test:ms11`
- `pnpm run test:ms13`
- `pnpm run test:ms14`
- `pnpm run test:ms15`
- `pnpm run test:ms16`
- `pnpm run test:ms162`
- `pnpm run test:ms163`
- `pnpm run test:ms164`
- `pnpm run test:ms171`
- `pnpm run test:ms18`
- `pnpm run test:ms19`
- `pnpm run test:ms20`
- `pnpm run test:ms21`
- `pnpm run test:ms211`

The standard Vite production build completes successfully. Vite reports that the primary application chunk is slightly over its 500 kB advisory threshold; this is a non-blocking optimization target for a later code-splitting pass.
