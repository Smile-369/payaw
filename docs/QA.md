# PAYAW v1 Release QA

## Automated gate

Run from a clean checkout:

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The release test command covers:

- Campaign state and session workflows
- GM shell and active workspace structure
- Hosted projection, authentication, reconnect, and command boundaries
- Character privacy and party-safe profiles
- Editor persistence, migrations, and corrupt-storage recovery

The procedural engine regression is intentionally separate because it
generates several large deterministic worlds and can take multiple minutes:

```powershell
pnpm test:engine
```

## GM browser matrix

Test the latest Chrome, Edge, and Firefox desktop releases at 1280×720 and 1440×900.

- Load the studio without console errors.
- Generate each world layout and at least one medium world.
- Switch every WORLD tool and CAMPAIGN panel.
- Verify Project, Commands, View, Campaign, and Help actions.
- Exercise save/open JSON, autosave recovery, PNG export, and recent projects.
- Confirm a new World JSON omits `tiles`, generated entity arrays, `npcs`,
  `npcRosterSize`, and `npcLocationAuthoring`, then imports by regenerating the
  same world recipe.
- Export one NPC and a search-filtered NPC group. Import both into the same
  world and a different world; verify relationships within groups survive and
  invalid location references fall back without breaking the schedule editor.
- Add, edit, hide, restore, and move authored records.
- Use undo/redo and keyboard shortcuts.
- Confirm the GM studio displays a narrow-screen guidance state instead of unusable horizontal overflow.

## Player browser matrix

Test at 390×844, 768×1024, and desktop widths.

- Render the login form without horizontal overflow.
- Verify Turnstile success, expiry, and failure messaging when enabled.
- Sign in, refresh, reconnect, sign out, and change credentials.
- Reopen a previously joined campaign from **Recent campaigns** without
  re-entering its Campaign ID, then verify **Forget** removes only that entry.
- Open every player module and mobile navigation surface.
- Confirm the Player map has exactly one canvas and each projected marker is
  drawn once. Exercise Region/Town/Terrain/Hydrology/Planning, layer toggles,
  drag/touch pan, wheel/button zoom, Fit, Grid, and keyboard navigation.
- Exercise each granted command and confirm denied capabilities stay unavailable.
- Confirm another player’s private data is absent from the projection and DOM.
- Verify offline recovery never bypasses revocation.

## Hosted integration

Use a fresh Supabase staging project.

- Apply all migrations from zero.
- Deploy the Edge Function.
- Create a room with at least two players.
- Sign in as GM, choose a room from **Previously hosted campaigns**, and verify
  the Campaign ID fills without loading until **Load campaign** is pressed.
- Verify RLS with owner GM, player A, player B, revoked player, and unauthenticated clients.
- Publish simultaneous GM and player changes and confirm conflict handling.
- Exercise dice, journal sharing/unsharing, messages, pings, character updates, assets, and history pruning.
- Confirm a Player map ping appears for the other Players, a private Player
  message appears with its body in the GM panel, and dice banners remain visible
  for four seconds.
- Interrupt Realtime and confirm revision-gap recovery.

## Accessibility

- Navigate both surfaces with keyboard only.
- Verify focus remains inside open dialogs and returns to the invoking control.
- Confirm visible controls have names and status updates use live regions.
- Check light, dark, and high-contrast themes.
- Test 200% zoom and reduced motion.
- Provide non-canvas controls for essential map actions.

## Release sign-off

- Working tree contains no generated logs, source maps, or temporary office files.
- Version labels match `package.json`.
- README and deployment instructions match the release.
- A recent compact world export and a separate NPC group export both import successfully.
- Staging passes GM and Player QA.
- Production hostnames are authorized for Turnstile.
- Backup and rollback owners are identified.
