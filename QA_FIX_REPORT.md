# PAYAW Milestone 17.1 — QA Fix and UI/UX Report

## Release verdict

**Ready for focused Milestone 17 deployment.** The previously identified living-world blockers are fixed and covered by a new behavioral regression suite.

## Fixed defects

- NPCs no longer teleport at schedule boundaries. In-progress trips remain travelling or delayed until their computed ETA.
- The simulation event timeline now persists across save/export and restore/import.
- Invalid imported IANA timezones safely fall back to `Asia/Manila` instead of crashing.
- Schedule periods, active NPC highlighting, and `datetime-local` conversion now use the simulation timezone consistently.
- Restricted bridges, ports, and water routes now affect route selection and/or duration instead of behaving as fully open.
- Venue, infrastructure, settlement-activity, and supernatural simulation states are now visible as live map overlays.
- The npm lockfile now matches version `0.17.1` and uses public `registry.npmjs.org` URLs only.
- The Milestone 8.2 disclosure regression is fixed; editor modules start collapsed.

## UI/UX refinement

- Rebuilt the living-world controls as a DM-oriented operations panel.
- Added world-clock hierarchy with current time, timezone, and schedule period.
- Added one-click Morning, Evening Rush, 3 AM, and Typhoon presets.
- Added six health cards: weather, traffic, infrastructure, venues, NPC movement, and supernatural activity.
- Added direct overlay controls for live infrastructure, venue hours, settlement activity, and supernatural activity.
- Added a filterable and clearable persistent event timeline with category icons, severity states, and timestamps.
- Improved infrastructure override selection, status visibility, responsive layout, spacing, and light-theme coverage.

## Verification

Passed from a clean install using the public npm registry:

- `npm ci`
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

The new `test:ms171` explicitly reproduced the 08:59 to 09:00 heavy-rain case and verified that the NPC stayed delayed with an eight-minute ETA. It also verifies persistent events, timezone fallback, restored closures, restricted infrastructure routing context, and event-log clearing.

## Known test-infrastructure limitation

The historical monolithic `npm run test:engine` remains too resource-intensive to finish within the bounded QA environment. It is not claimed as passed. The focused and retained milestone suites listed above completed successfully.
