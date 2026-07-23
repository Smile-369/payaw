# Milestone 22 Validation

## Automated checks

- Strict TypeScript check: passed.
- Production Vite build: passed.
- Milestone 22 behavioral suite: passed.
- Milestone 21.1 UI and water-route retirement regression: passed.
- Milestone 20 Campaign System regression: passed.
- Milestone 19 NPC/location authoring regression: passed.
- Milestone 18 authoring regression: passed.
- Milestone 17.1 persistence/routing regression: passed.
- Public lockfile and version audit: passed.

The Milestone 22 suite proves:

- party knowledge reaches both players;
- individual knowledge reaches only its audience;
- hidden scene participants are omitted;
- revoked knowledge is omitted;
- future queued messages are omitted;
- GM scene descriptions, clue titles, objective intent, and asset rights notes do not leak;
- disabled capabilities reject player commands;
- enabled capabilities accept player commands;
- safe projections round-trip through the parser;
- incompatible projection versions fail closed.

## Interactive browser QA

Verified against the local Vite application:

- GM Campaign → Players panel is readable in its narrow drawer and has no horizontal overflow.
- Generation field labels and the regional-scale presentation have readable light-theme contrast.
- The projection safety badge has explicit dark-on-light contrast.
- Player route does not contain the GM canvas or GM workspaces.
- Desktop Player View has no horizontal overflow and renders the revealed map correctly.
- Compact tablet layout switches to a fixed bottom navigation.
- Phone layout at 390 × 844 has no horizontal overflow.
- Mobile **More** sheet exposes Character, Campaign, People, Places, Clues, Handouts, Objectives, Travel, and Dice.
- Private journal creation works.
- Dice roll workflow works.
- Missing projection displays a fail-closed privacy message.
- Browser console contained no warnings or errors during the validated flows.

## Not run

`npm run test:engine` was not run, per the established release policy.
