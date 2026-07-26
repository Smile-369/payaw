# PAYAW Architecture and Security Boundaries

## Application surfaces

`src/bootstrap.ts` selects one of two surfaces before loading application code:

- The GM route loads the world engine, authoring tools, campaign system, and hosted-room controls.
- `?view=player` loads the Player Portal and never imports the GM application.

## World and authoring

The engine deterministically generates a `World` from a seed and generation profile. Authoring is stored as a separate override layer. Regeneration reapplies validated overrides instead of mutating the procedural source.

The GM renderer receives the full world and authoring state. Player maps are regenerated from a public world recipe and then decorated only with authorized projection data.

## Campaign state

Campaign state references stable world, NPC, location, character, and asset identities. Compact world exports contain the deterministic generation recipe, authored world changes, campaign state, and required assets, while NPC records travel in dedicated NPC or NPC-group JSON files. Campaign checkpoints restore campaign run state without rewriting the authored world.

## Player projection boundary

`ProjectionService` constructs a recipient-specific `PlayerProjection`. The player application parses that projection fail-closed and never falls back to the GM project.

Private character fields, unrevealed records, GM notes, secret schedules, future messages, and unauthorized assets are excluded before transport. Capabilities are enforced at the command boundary as well as in the UI.

## Hosted authority

Supabase stores:

- Campaign room metadata and membership
- GM authority documents
- Recipient-specific player slots
- Commands and transient campaign events
- Protected GM and player assets

Row-level security separates GM authority from player projections. Private Realtime channels require campaign membership. Privileged command processing is confined to the Edge Function using the service role.

Player Portal passwords are hashed in the database. Resetting or disabling credentials clears the previous assignment and membership so cached credentials cannot regain access.

## Persistence

- Local preferences and autosave metadata: browser storage
- Imported local image binaries: IndexedDB
- Portable backup: exported PAYAW JSON
- Hosted authority and projections: Supabase

All imported JSON passes through bounded normalizers before it reaches runtime state.

## Release invariants

- The Player Portal must not import or query the GM authority document.
- A projection must be rejected when its schema version is unsupported.
- Unknown or unauthorized records are absent by default.
- Service-role credentials must never appear in Vite configuration or browser source.
- Applied migrations are immutable.
- User-authored text is rendered as text, not interpreted as HTML.
