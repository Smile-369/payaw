# Milestone 19 Validation

Release gates:

- `npm run check`
- `npm run test:ms19`
- `npm run test:ms18`
- `npm run test:ms171`
- `npm run test:ms164`
- `npm run test:ms162`
- `npm run test:ms82`
- `npm run build`

`npm run test:engine` is intentionally excluded.

Milestone 19 behavioral validation covers:

- Schema and generation lineage
- Residential-only home validation
- Explicit unusual-residence override
- Generated NPCs defaulting to Alive
- Weekly schedule overlap checks
- Scene → temporary override → weekly schedule → home precedence
- Venue open, closing-soon, and closed resolution
- NPC/location authoring normalization
- Anchor-based community UI
- Absence of satellite-settlement generation controls
- Absence of the Island Editor
- Public npm lockfile metadata
