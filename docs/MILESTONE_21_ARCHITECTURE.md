# Milestone 21 Architecture

## Boot sequence

`index.html` now loads `src/bootstrap.ts`.

The bootstrap sequence is:

1. Import the global application styles.
2. Import the Milestone 21 shell styles.
3. Build and install the Milestone 21 shell around the existing application DOM.
4. Import `src/main.ts` to initialize the generator, authoring, campaign, persistence, and event-binding systems.

This approach restructures the interface without rewriting the complete Milestone 8–20 application domain in one release.

## Shell module

`src/ui/Milestone21Shell.ts` owns:

- WORLD/CAMPAIGN workspace switcher
- Top title/menu/command bars
- Tool rails
- Contextual drawer routing
- Inspector/layers dock behavior
- Anchor Type category control
- Relocation and retirement of legacy panels
- Migration of old controls into their new task-oriented groups

The shell keeps existing element IDs wherever domain code depends on them.

Milestone 21.1 narrows that compatibility boundary further: obsolete bridge, maritime, naming, and generalized authored-feature panels are retired rather than relocated into the new shell. `setStudioTab` can initialize a tool without opening the inspector, so the persisted/default closed-dock state is authoritative.

## Styling

`src/ui/ms21.css` defines the Milestone 21 visual system:

- Windows-style face, border, shadow, selection, and title-bar tokens
- Map-first desktop grid
- Compact tool rail
- Contextual drawer and collapsible inspector
- Light, inset form controls
- Beveled cards and buttons
- Responsive fallbacks for narrower desktop widths

The legacy stylesheet remains available for renderer and deep component compatibility, while Milestone 21 selectors override the visible shell.

Controls inside the contextual drawer are explicitly constrained to a one-column layout. Workspace tabs also receive fixed Milestone 21 dimensions so legacy minimum heights cannot cause command-row collisions.

## Water-route removal

Water routes were a generated transport network that did not support PAYAW's GM-authored TTRPG workflow. Milestone 21.1 removes their generation stage, world-state collection, renderer layers, simulation state, route customization, travel mode, and UI. Ports remain independent coastal reference anchors.

## Visible story suppression

The same suppression-backed story cards are rendered in the Campaign story list and WORLD > Story. Both surfaces use the same mutation/history action, so Remove and Restore removed remain persistent and undoable.

## Story suppression

`StoryRuleOverride` adds:

```ts
readonly suppressed?: boolean;
```

`StoryGenerator` excludes rules with `suppressed === true` from generated `world.storyObjects`.

The UI writes suppression through project mutation/history instead of deleting the story definition. Restoration clears suppression for all removed story points.

## Authoring normalization

Milestone 21 deliberately narrows active authoring state. During normalization, the application retains:

- `settlements`
- `settlementOverrides`
- point-geometry features where `category === "landmark"` and `subtype === "anchor-point"`

It resets or drops generalized terrain, generated-feature, and authored-feature state outside this allowed set.

This creates a compatibility boundary:

- Old types and engine paths can remain for migration and regression compatibility.
- The Milestone 21 application does not expose or persist those generalized records as active editing features after normalization.

## Settlement type category

The shell provides a semantic category above the existing anchor subtype selector:

- `community` maps to the settlement/community authoring workflow
- `point` maps to the point-anchor workflow

The category control synchronizes with existing authoring controls rather than creating a second source of truth.

## Persistence

Milestone 21 retains project schema 20 because the Campaign System domain model has not changed. UI preferences are local presentation state. Story suppression fits the existing rule-override structure and remains forward-compatible.

## Static QA build

`scripts/build-static.mjs` provides a dependency-light release inspection build when Vite cannot be installed. It:

1. Compiles TypeScript.
2. Rewrites emitted relative imports to browser-resolvable `.js` paths.
3. Copies CSS and required public files.
4. Rewrites the application entry to the compiled bootstrap.
5. Writes the result to `dist/`.

The canonical production command remains `npm run build` in a normal development environment.
