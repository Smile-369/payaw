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
const playerApp = read('src', 'player', 'PlayerApp.ts');
const playerCss = read('src', 'player', 'player.css');
const profiles = read('src', 'player', 'CharacterProfiles.ts');
const projection = read('src', 'player', 'PlayerProjection.ts');
const commands = read('src', 'player', 'PlayerCommands.ts');
const gateway = read('src', 'netcode', 'SupabaseGateway.ts');
const session = read('src', 'netcode', 'PlayerNetworkSession.ts');
const edgeFunction = read('supabase', 'functions', 'campaign-command', 'index.ts');
const migration = read('supabase', 'migrations', '202607260020_character_profiles_and_images.sql');

for (const token of [
  'player-character-profile-tabs', 'renderPublicCharacterProfile', 'renderFullCharacterEditor',
  'uploadCharacterImage', 'Add gallery images', 'Ultimate skill', 'Hidden from other players',
]) assert(playerApp.includes(token), `Character-tab UI is missing: ${token}`);
for (const token of [
  '.player-character-profile-tabs', '.player-myspace-gallery', '.player-character-full-editor',
  '.player-character-private-section', '.player-character-ultimate-editor',
]) assert(playerCss.includes(token), `Character-tab styling is missing: ${token}`);
for (const token of ['PublicCharacterProfileProjection', 'partyCharacters', 'ultimateSkill']) {
  assert(projection.includes(token), `Player projection is missing: ${token}`);
}
assert(profiles.includes('Private wish, taboo, consequences, risk, NPC ties, debts'), 'Public profile sanitizer no longer documents its privacy boundary.');
for (const forbidden of ['warning:', 'warningConsequence:', 'privateWish:', 'usefulContact:', 'worriedPerson:', 'avoidedPlace:']) {
  assert(!profiles.includes(forbidden), `Private field is represented in the public profile sanitizer: ${forbidden}`);
}
assert(commands.includes("kind: 'character.sheet.update'"), 'Atomic full-sheet player command is missing.');
assert(gateway.includes("return `payaw-player-asset:${path}`"), 'Database-safe character image token is missing.');
assert(session.includes('50 * 60 * 1000'), 'Signed character image URLs are not refreshed before expiry.');
assert(edgeFunction.includes("kind === 'character.sheet.update'") && edgeFunction.includes("kind: 'character.party'"), 'Server party-profile synchronization is missing.');
for (const hidden of ['sheet?.warning', 'sheet?.warningConsequence', 'sheet?.privateWish', 'sheet?.risk', 'sheet?.usefulContact', 'sheet?.worriedPerson', 'sheet?.avoidedPlace', 'sheet?.notes']) {
  assert(!edgeFunction.includes(hidden), `Server public profile leaks a hidden sheet field: ${hidden}`);
}
for (const policy of ['players upload own character images', 'players update own character images', 'players delete own character images']) {
  assert(migration.includes(policy), `Character image storage policy is missing: ${policy}`);
}
assert(migration.includes("(storage.foldername(name))[2] = auth.uid()::text"), 'Players are not constrained to their own image folder.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const behavior = JSON.parse(execFileSync(process.execPath, [join(outputPath, 'tests', 'CharacterSocialTest.js')], { cwd: projectPath, encoding: 'utf8' }));
const result = {
  characterTabOnly: true,
  atomicSheetUpdate: true,
  privateStorageImages: true,
  sanitizedPartyProfiles: true,
  signedUrlRefresh: true,
  behavior,
};
const output = `${JSON.stringify(result, null, 2)}\n`;
process.stdout.write(output);
