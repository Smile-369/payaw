# PAYAW UI and schema-cache hotfix

This build fixes the oversized shared dice overlay shown in the GM/player interface.

## UI changes

- Replaced the near-full-width dice banner with a compact Windows 98/early-2000s-style toast.
- Desktop placement is bottom-right; narrow screens use a compact top-right placement.
- The toast no longer creates a full-screen overlay layer or obscures the map.
- Roll notifications display for 2.3 seconds and the pending notification queue is capped at five.
- Player rolls use the projected player display name instead of the opaque portal login ID.
- Existing hexadecimal portal IDs are rendered as `PLAYER` rather than exposed in the notification.

## Supabase compatibility fix

When PostgREST returns `PGRST202` for `publish_campaign_snapshot_optimized`, the frontend now temporarily falls back to the existing atomic `publish_campaign_snapshot` RPC. This prevents campaign create, reset, login, and initial publication from failing while the optimized migration or schema-cache refresh is pending.

The optimized migration should still be deployed so subsequent snapshots use changed-slot-only writes.

## Validation

- Strict TypeScript: passed
- Milestone 22 suite: passed
- Milestone 23 suite: passed
- Static production build: passed
