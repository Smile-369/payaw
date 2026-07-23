# Milestone 20 Validation

## Release gates

Targeted release commands:

```bash
npm run check
npm run test:ms20
npm run test:ms19
npm run test:ms18
npm run test:ms171
npm run test:ms164
npm run test:ms162
npm run test:ms82
npm run build
```

`npm run test:engine` is intentionally excluded. It is a legacy stress/benchmark suite rather than a release criterion.

## Milestone 20 behavioral coverage

`npm run test:ms20` validates:

- Campaign and world schema version 20
- Campaign-to-world reference binding
- Valid timezone editing and invalid-timezone rejection
- Campaign asset registration
- Preparation checklist creation and completion
- Scene creation and participant staging
- Scene activation and author-driven NPC placement compatibility
- Clue, handout, and objective creation
- Audience-scoped reveal records
- Message-thread creation, drafts, and queued scheduling metadata
- Timeline event creation
- Time-jump preview and event eligibility
- Confirmation requirement
- Event idempotency
- Session start and completion
- Checkpoint creation and restoration
- Lightweight encounter state
- Campaign search and backlinks
- External-reference validation
- Session recap and unused-prepared-scene tracking
- Campaign normalization and export manifest

## Retained regression coverage

- `test:ms19` — NPC/location authoring, residential homes, weekly schedule precedence, venue status, community-anchor UI direction
- `test:ms18` — non-destructive world authoring, cross-island community movement, terrain override, authored roads, Hidden Payaw, generated-feature suppression
- `test:ms171` — persistence, timezone fallback, event serialization, and restricted transport behavior under author-driven NPC placement
- `test:ms164` — cross-island community-anchor reassignment and destination generation
- `test:ms162` — retained clock and NPC display compatibility
- `test:ms82` — editor/DM workspace separation and collapsed editor modules

## Static UI checks

The M20 release also checks:

- No duplicate HTML IDs
- Every required `#campaign-*` selector used by `CampaignStudio` exists in `index.html`
- No internal package-registry URLs in `package-lock.json`
- Project and package versions agree on 0.20.0 / schema 20

## Environment result

TypeScript checking and all targeted behavioral suites passed in the release environment.

The production Vite bundle could not be regenerated in the packaging environment because the configured package gateway returned HTTP 503 while fetching Vite. The stale Milestone 19 `dist` directory is therefore excluded from the release rather than represented as a current build. The source package remains buildable with:

```bash
npm install
npm run build
```

in an environment with normal npm registry access.
