# Milestone 16.4 Validation

## Validation performed

- Strict TypeScript compilation: passed
- Milestone 16.3 dry-land safety test: passed
- Milestone 16.4 cross-island reassignment test: passed
- Milestone 16 NPC and routing regression: passed
- Milestone 16.2 clock and NPC-position regression: passed
- Milestone 13 world-layout regression: passed
- Milestone 14 generation/cancellation regression: passed
- Milestone 15 UI schema/zero-satellite regression: passed
- Vite production build: passed

## Production build

- Vite: 8.1.5
- Modules transformed: 111
- Separate generation worker emitted
- Main JavaScript bundle emitted with source map
- Production `dist` included in the archive

## Cross-island test result

The focused test moved a generated satellite settlement from Payaw Island to a physically separate island. It confirmed:

- The settlement retained its stable key.
- Its final `islandId` changed to the destination.
- The source island no longer listed the settlement.
- The destination island listed the settlement.
- Destination road generation was enabled.
- The final tile's island identity matched the settlement.
- Legacy x/y-only overrides remained compatible.

## Safety regression

Ocean placement remains rejected both during drag lookup and deterministic regeneration. Locked and protected islands remain ineligible destinations by shared editor/generator validation.

