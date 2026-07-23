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
const invitationFixMigration = read('supabase', 'migrations', '202607230004_fix_invitation_identity_and_ambiguity.sql');
const edgeFunction = read('supabase', 'functions', 'campaign-command', 'index.ts');
const envExample = read('.env.example');

assert(packageJson.version === '0.23.2', 'Package version is not PAYAW 0.23.2.');
assert(packageJson.dependencies?.['@supabase/supabase-js'], 'Supabase JavaScript client dependency is missing.');
for (const id of ['player-slot-count', 'player-slot-count-apply', 'netcode-panel', 'netcode-status', 'netcode-gm-email', 'netcode-gm-password', 'netcode-sign-in', 'netcode-create-account', 'netcode-create-room', 'netcode-publish-all', 'netcode-invite-player', 'netcode-create-invite', 'netcode-invite-link', 'netcode-roster', 'netcode-commands']) {
  assert(html.includes(`id="${id}"`), `Hosted-room control missing: ${id}`);
}
assert(bootstrap.includes('installNetworkedPlayerApp') && bootstrap.includes('readNetcodeConfig'), 'Network Player View bootstrap is missing.');
assert(playerApp.includes('PlayerAppSession') && playerApp.includes('Private campaign room'), 'Player App is not transport-aware.');
assert(gateway.includes('assigned_user_id=eq.') && gateway.includes('parsePlayerProjection'), 'Recipient-filtered projection subscription is missing.');
assert(gateway.includes('signInWithPassword') && gateway.includes('createPasswordAccount') && gateway.includes('auth.signUp'), 'GM email/password authentication is missing.');
assert(!gateway.includes('signInWithOtp'), 'GM OTP authentication is still present.');
assert(gmPanel.includes('validatePasswordCredentials') && gmPanel.includes('createPasswordAccount'), 'GM password controls are not wired.');
assert(gateway.includes("config: { private: true"), 'Realtime channel is not private.');
assert(supabaseClient.includes('storageKey: `payaw-player-auth-${deviceId}`') && supabaseClient.includes("get('view') === 'player'") && supabaseClient.includes("has('invite')"), 'Player auth sessions are not isolated per invitation device.');
assert(networkBootstrap.includes('claimed.campaignId !== campaignId') && networkBootstrap.includes('openRoom(app, claimed.campaignId'), 'Invitation claims do not bind the player to the RPC-resolved campaign room.');
assert(session.includes('QUEUE_LIMIT') && session.includes('isOfflineSafeCommand') && session.includes('idempotencyKey'), 'Bounded offline-safe command queue is missing.');
assert(session.includes('projection.revision > this.projectionValue.revision + 1'), 'Revision gap recovery is missing.');
assert(session.includes('cachedProjection') && session.includes('connectRealtime'), 'Cold-start offline recovery is missing.');
assert(gmPanel.includes('mergePlayerOwnedProjection') && gmPanel.includes('publishCampaignSnapshot'), 'Atomic GM publish does not preserve player-owned changes.');
assert(gmPanel.includes('payaw:campaign-state-changed') && gmPanel.includes('schedulePublish'), 'Automatic debounced host synchronization is missing.');
assert(gmPanel.includes('Replace device') && gateway.includes('revoke_campaign_member'), 'Player device replacement controls are missing.');
assert(gmPanel.includes('uploadPlayerAsset') && gateway.includes("from('payaw-player-assets')"), 'Protected handout upload is not connected.');
for (const table of ['campaign_rooms', 'campaign_members', 'campaign_authority', 'campaign_player_slots', 'campaign_invitations', 'campaign_commands', 'campaign_events', 'campaign_client_acks', 'campaign_audit_log']) {
  assert(migration.includes(`alter table public.${table} enable row level security`), `RLS is not enabled on ${table}.`);
}
assert(migration.includes('claim_campaign_invitation') && migration.includes("digest(upper(trim(p_token)), 'sha256')"), 'Hashed invitation redemption is missing.');
assert(migration.includes('CAPABILITY_DENIED') && migration.includes('STALE_REVISION') && migration.includes('RATE_LIMITED'), 'Server command validation gates are incomplete.');
assert(migration.includes('realtime.messages') && migration.includes('private.is_campaign_member'), 'Private Realtime authorization policy is missing.');
assert(migration.includes('payaw-player-assets') && migration.includes('payaw-gm-assets'), 'Separated protected asset buckets are missing.');
assert(read('supabase', 'migrations', '202607230002_configurable_player_slots.sql').includes('prune_campaign_player_slots'), 'Configurable hosted player-slot migration is missing.');
assert(atomicMigration.includes('publish_campaign_snapshot') && atomicMigration.includes('SNAPSHOT_CONFLICT'), 'Atomic snapshot migration is missing its concurrency gate.');
assert(atomicMigration.includes('p_authority') && atomicMigration.includes('p_slots') && atomicMigration.includes('campaign.publish-atomic'), 'Atomic snapshot transaction is incomplete.');
assert(invitationFixMigration.includes('#variable_conflict use_column') && invitationFixMigration.includes('on conflict on constraint campaign_members_pkey'), 'Invitation claim ambiguity hotfix is missing.');
assert(edgeFunction.includes('SUPABASE_SERVICE_ROLE_KEY') && edgeFunction.includes("status: 'processing'") && edgeFunction.includes('REVISION_CONFLICT'), 'Privileged command processor is incomplete.');
assert(!read('src', 'netcode', 'SupabaseClient.ts').includes('SERVICE_ROLE'), 'Service-role key leaked into the browser client.');
assert(!envExample.includes('VITE_SUPABASE_SERVICE'), 'Service-role variable was exposed as VITE configuration.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const behavior = JSON.parse(execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone23Test.js')], { cwd: projectPath, encoding: 'utf8' }));
const result = {
  release: packageJson.version, hostedAuthority: true, rowLevelSecurity: true,
  privateRealtime: true, hashedInvitations: true, protectedAssets: true,
  serverCommands: true, reconnectQueue: true, behavior,
};
const output = `${JSON.stringify(result, null, 2)}\n`;
process.stdout.write(output);
writeFileSync(join(projectPath, 'docs', 'MS23_TEST_RESULTS.json'), output);
