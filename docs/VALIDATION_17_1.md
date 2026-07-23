# Milestone 17.1 Validation — QA Fixes and UI/UX Refinement

## Release version

- Package: `0.17.1`
- World schema: `17`
- Generation lineage: `payaw-m17-living-world-v1`

## Correctness fixes

1. NPC trips are evaluated across the previous/current schedule boundary. A trip that arrives after the boundary remains `delayed` until its ETA instead of snapping to the destination.
2. The simulation event log is serialized, restored, capped, deduplicated, filterable, and clearable.
3. Imported timezones are validated. Invalid values fall back to `Asia/Manila`, while schedule highlighting and date/time conversion use the stored simulation timezone.
4. Restricted roads, bridges, ports, and water routes are exposed through `TravelContext`; route finding and duration estimates apply appropriate penalties.
5. Venue, infrastructure, settlement activity, and supernatural states are passed into the canvas renderer as visible toggleable overlays.
6. The npm lockfile version matches `package.json` and contains only public npm registry URLs.

## Interface refinement

- DM-oriented world-clock header with timezone and active period.
- One-click Morning, Evening Rush, 3 AM, and Typhoon presets.
- Six operational status cards for weather, traffic, infrastructure, venues, NPC movement, and supernatural activity.
- Live map-overlay controls mirrored in the main layer system.
- Clearer infrastructure override workflow and selected-state feedback.
- Persistent event timeline with category filters, severity styling, timestamps, icons, and a clear action.
- Reduced initial editor clutter by keeping disclosure modules collapsed.
- Responsive layout and light-theme coverage for the refined controls.

## Automated verification

Passed:

- `npm run check`
- `npm run build`
- `npm run test:ms82`
- `npm run test:ms13`
- `npm run test:ms14`
- `npm run test:ms15`
- `npm run test:ms16`
- `npm run test:ms162`
- `npm run test:ms163`
- `npm run test:ms164`
- `npm run test:ms17`
- `npm run test:ms171`

The new `test:ms171` behaviorally verifies the 08:59 → 09:00 delayed-NPC transition, persistent events, timezone fallback, restored closures, restricted infrastructure routing context, and event-log clearing. The monolithic historical `test:engine` remains too resource-intensive for the bounded QA environment and is documented separately rather than counted as passed.
