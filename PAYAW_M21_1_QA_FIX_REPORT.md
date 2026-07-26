# PAYAW Milestone 21.1 - QA Fix Report

## Verdict

PASS - release-ready for the scoped Milestone 21.1 source release.

The supplied Milestone 21 UI wrapped several legacy editor layouts that were incompatible with the new compact shell. This caused tab collisions, crushed multi-column controls, low-contrast status text, and an inspector that reopened during startup. Those defects are fixed.

## User-reported UI fixes

### WORLD / CAMPAIGN collision

- The command row has a stable 50 px height.
- Workspace tabs have explicit 36 px dimensions and no longer inherit the legacy 58 px minimum height.
- The title, menu, workspace, and command areas remain visually separated.

### Crushed road/block and port panels

- The old road/block naming editor, bridge editor, and port-management editor are retired from the active Milestone 21 shell.
- Generalized authored-map features remain removed except for community settlements and point anchors.
- Any retained contextual form grid stacks into a readable single column inside the drawer.

### Unreadable regional-scale summary

- The pale-on-pale inherited theme colors were replaced with dark green text on a light green surface and a visible border.
- Browser-computed colors changed from `rgb(201, 219, 201)` on a near-transparent surface to `rgb(23, 53, 27)` on `rgb(228, 238, 225)`.

### Settlements and story points

- Settlements remain consolidated under Anchors.
- The Type category switches between Community / settlement and Point anchor.
- Generated story points now have visible Remove actions in WORLD > Story.
- Restore removed reinstates suppressed points without destructive deletion.

## Water routes removed

Water routes were removed as a city-simulation feature that does not fit the product direction. The release removes:

- water-route generation;
- water-route state and serialization;
- map layers and labels;
- route status simulation and infrastructure overrides;
- ferry travel mode and route-time calculations;
- customization targets and route UI;
- water-route source modules.

Ports remain as coastal anchors and campaign references. They do not automatically create or simulate ferry networks.

## UI and performance optimization

- Inspector and layers dock remain closed on first launch and initialization.
- Anchor templates are collapsed until requested.
- Hidden legacy bridge, port, and name lists are no longer rebuilt on every world refresh.
- Water-route generation, rendering, and status calculations are gone.
- Responsive layouts were verified without horizontal page overflow.

## Browser verification

Verified at 1024x768, 1366x768, and 1920x1080:

- no workspace-tab collision;
- no horizontal document overflow;
- no visible retired editors;
- no water-route controls;
- readable regional summary;
- working anchor Type category;
- working story Remove / Restore removed cycle;
- closed inspector by default;
- zero browser console errors or warnings.

At 1366x768 the closed-dock map occupies approximately 73% of the application width. At 1920x1080 it occupies approximately 81%.

## Automated validation

Passed TypeScript checking, the production Vite build, Milestone 21 and 21.1 behavioral tests, and retained Milestone 11, 13-20 regressions relevant to generation, settlement movement, NPC/location authoring, campaign persistence, routing, and UI behavior.

`npm run test:engine` was not run, per the explicit project QA policy.

The production build has one non-blocking Vite advisory: the primary application chunk is slightly above 500 kB. The release already removes unnecessary route and hidden-list work; further code splitting can be handled as a later optimization without blocking this fix.
