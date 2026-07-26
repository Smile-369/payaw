import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectPath = dirname(scriptDirectory);
const outputPath = join(projectPath, '.test-build');
const localCompilerPath = join(projectPath, 'node_modules', 'typescript', 'bin', 'tsc');
const read = (...parts) => readFileSync(join(projectPath, ...parts), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const html = read('index.html');
const bootstrap = read('src', 'bootstrap.ts');
const playerApp = read('src', 'player', 'PlayerApp.ts');
const gateway = read('src', 'netcode', 'SupabaseGateway.ts');
const supabaseClient = read('src', 'netcode', 'SupabaseClient.ts');
const networkBootstrap = read('src', 'netcode', 'NetworkPlayerBootstrap.ts');
const session = read('src', 'netcode', 'PlayerNetworkSession.ts');
const gmPanel = read('src', 'netcode', 'GmNetcodePanel.ts');
const migration = read('supabase', 'migrations', '202607230001_milestone_23_netcode.sql');
const atomicMigration = read('supabase', 'migrations', '202607230003_atomic_campaign_publish.sql');
const portalMigration = read('supabase', 'migrations', '202607230006_player_portal_login.sql');
const edgeFunction = read('supabase', 'functions', 'campaign-command', 'index.ts');
const envExample = read('.env.example');

assert(packageJson.version === '0.24.0', 'Package version is not PAYAW 0.24.0.');
assert(packageJson.dependencies?.['@supabase/supabase-js'], 'Supabase JavaScript client dependency is missing.');
for (const id of [
  'player-slot-count', 'player-slot-count-apply', 'netcode-panel', 'netcode-status',
  'netcode-gm-email', 'netcode-gm-password', 'netcode-sign-in', 'netcode-create-account',
  'netcode-create-room', 'netcode-publish-all', 'netcode-portal-player',
  'netcode-create-player-login', 'netcode-copy-player-login', 'netcode-player-portal-url',
  'netcode-player-login-id', 'netcode-player-login-password', 'netcode-roster', 'netcode-commands',
]) assert(html.includes(`id="${id}"`), `Hosted-room control missing: ${id}`);
for (const removedId of ['netcode-invite-player', 'netcode-create-invite', 'netcode-invite-link']) {
  assert(!html.includes(`id="${removedId}"`), `Legacy one-time invitation control remains: ${removedId}`);
}
assert(bootstrap.includes('installNetworkedPlayerApp') && bootstrap.includes('readNetcodeConfig'), 'Network Player View bootstrap is missing.');
assert(playerApp.includes('PlayerAppSession') && playerApp.includes('Player portal'), 'Player App is not portal transport-aware.');
assert(!playerApp.includes('baseImageDataUrl') && !playerApp.includes('drawProjectedMapFallback'), 'Player App still contains a baked PNG map path.');
assert(playerApp.includes('generatePlayerWorld') && playerApp.includes("stopAfterStageId: 'vegetation'"), 'Player map is not regenerated locally from the public recipe.');
assert(gateway.includes('assigned_user_id=eq.') && gateway.includes('parsePlayerProjection'), 'Recipient-filtered projection subscription is missing.');
assert(gateway.includes('signInWithPassword') && gateway.includes('createPasswordAccount') && gateway.includes('auth.signUp'), 'Email/password authentication is missing.');
assert(!gateway.includes('signInWithOtp'), 'OTP authentication is still present.');
assert(gmPanel.includes('validatePasswordCredentials') && gmPanel.includes('createPasswordAccount'), 'GM password controls are not wired.');
assert(gateway.includes("config: { private: true"), 'Realtime channel is not private.');
assert(supabaseClient.includes('createPlayerSupabaseClient') && supabaseClient.includes('payaw-player-auth-'), 'Persistent player auth namespaces are missing.');
assert(supabaseClient.includes("clientOptions('payaw-gm-auth'"), 'GM authentication is not isolated from player sessions.');
assert(networkBootstrap.includes('PLAYER_PORTAL_SESSION_KEY') && networkBootstrap.includes('readStoredPortalSession'), 'Player portal session is not persisted across portal visits.');
assert(networkBootstrap.includes('resolvePlayerPortal') && networkBootstrap.includes('claimPlayerPortal'), 'Player portal login flow is incomplete.');
assert(networkBootstrap.includes("url.searchParams.delete('invite')") && networkBootstrap.includes("url.searchParams.delete('device')"), 'Legacy invitation parameters are not cleared.');
assert(session.includes('QUEUE_LIMIT') && session.includes('isOfflineSafeCommand') && session.includes('idempotencyKey'), 'Bounded offline-safe command queue is missing.');
assert(session.includes('projection.revision > this.projectionValue.revision + 1'), 'Revision gap recovery is missing.');
assert(session.includes('cachedProjection') && session.includes('connectRealtime'), 'Cold-start offline recovery is missing.');
assert(gmPanel.includes('mergePlayerOwnedProjection') && gmPanel.includes('publishCampaignSnapshot'), 'Atomic GM publish does not preserve player-owned changes.');
assert(gmPanel.includes('payaw:campaign-state-changed') && gmPanel.includes('schedulePublish'), 'Automatic debounced host synchronization is missing.');
assert(gmPanel.includes('configurePlayerPortal') && gmPanel.includes('Reset login') && gmPanel.includes('disablePlayerPortal'), 'Persistent player-login management controls are missing.');
assert(!gmPanel.includes('createInvitation') && !gmPanel.includes('Replace device'), 'Legacy one-time invitation/device UI remains.');
assert(gmPanel.includes('uploadPlayerAsset') && gateway.includes("from('payaw-player-assets')"), 'Protected handout upload is not connected.');
for (const table of ['campaign_rooms', 'campaign_members', 'campaign_authority', 'campaign_player_slots', 'campaign_invitations', 'campaign_commands', 'campaign_events', 'campaign_client_acks', 'campaign_audit_log']) {
  assert(migration.includes(`alter table public.${table} enable row level security`), `RLS is not enabled on ${table}.`);
}
assert(migration.includes('CAPABILITY_DENIED') && migration.includes('STALE_REVISION') && migration.includes('RATE_LIMITED'), 'Server command validation gates are incomplete.');
assert(migration.includes('realtime.messages') && migration.includes('private.is_campaign_member'), 'Private Realtime authorization policy is missing.');
assert(migration.includes('payaw-player-assets') && migration.includes('payaw-gm-assets'), 'Separated protected asset buckets are missing.');
assert(read('supabase', 'migrations', '202607230002_configurable_player_slots.sql').includes('prune_campaign_player_slots'), 'Configurable hosted player-slot migration is missing.');
assert(atomicMigration.includes('publish_campaign_snapshot') && atomicMigration.includes('SNAPSHOT_CONFLICT'), 'Atomic snapshot migration is missing its concurrency gate.');
assert(atomicMigration.includes('p_authority') && atomicMigration.includes('p_slots') && atomicMigration.includes('campaign.publish-atomic'), 'Atomic snapshot transaction is incomplete.');
assert(portalMigration.includes('private.player_portal_credentials'), 'Private player portal credential storage is missing.');
assert(portalMigration.includes("extensions.crypt(v_password, extensions.gen_salt('bf', 10))"), 'Player portal passwords are not hashed.');
for (const fn of ['configure_player_portal', 'list_player_portal_logins', 'resolve_player_portal_login', 'claim_player_portal', 'disable_player_portal']) {
  assert(portalMigration.includes(`function public.${fn}`), `Player portal function is missing: ${fn}`);
}
assert(portalMigration.includes('update public.campaign_invitations') && portalMigration.includes('revoke all on function public.claim_campaign_invitation'), 'Legacy invitation access is not revoked.');
assert(portalMigration.includes("projection #- '{baseImageDataUrl}' #- '{map,baseImageDataUrl}'"), 'Legacy baked-map fields are not removed from hosted projections.');
assert(edgeFunction.includes('SUPABASE_SERVICE_ROLE_KEY') && edgeFunction.includes("status: 'processing'") && edgeFunction.includes('REVISION_CONFLICT'), 'Privileged command processor is incomplete.');
assert(!supabaseClient.includes('SERVICE_ROLE'), 'Service-role key leaked into the browser client.');
assert(!envExample.includes('VITE_SUPABASE_SERVICE'), 'Service-role variable was exposed as VITE configuration.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const behavior = JSON.parse(execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone23Test.js')], { cwd: projectPath, encoding: 'utf8' }));
const result = {
  release: packageJson.version,
  hostedAuthority: true,
  rowLevelSecurity: true,
  privateRealtime: true,
  persistentPlayerPortal: true,
  oneTimeInvitationsDisabled: true,
  locallyGeneratedPlayerMap: true,
  protectedAssets: true,
  serverCommands: true,
  reconnectQueue: true,
  behavior,
};
const output = `${JSON.stringify(result, null, 2)}\n`;
process.stdout.write(output);
writeFileSync(join(projectPath, 'docs', 'MS23_TEST_RESULTS.json'), output);
