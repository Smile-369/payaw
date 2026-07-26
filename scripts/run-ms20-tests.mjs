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
const html = readFileSync(join(projectPath, 'index.html'), 'utf8');
const main = readFileSync(join(projectPath, 'src', 'main.ts'), 'utf8');
const campaignSystem = readFileSync(join(projectPath, 'src', 'campaign', 'CampaignSystem.ts'), 'utf8');
const campaignStudio = readFileSync(join(projectPath, 'src', 'campaign', 'CampaignStudio.ts'), 'utf8');
const dependencyLock = readFileSync(join(projectPath, 'pnpm-lock.yaml'), 'utf8');
const worldSource = readFileSync(join(projectPath, 'src', 'engine', 'world', 'World.ts'), 'utf8');

for (const id of [
  'campaign-dashboard', 'campaign-start-session', 'campaign-end-session', 'campaign-scene-director',
  'campaign-scene-select', 'campaign-activate-scene', 'campaign-exact-time', 'campaign-weather',
  'campaign-participant-list', 'campaign-save-live-note', 'campaign-scene-list', 'campaign-event-list',
  'campaign-information-list', 'campaign-message-list', 'campaign-session-list', 'campaign-checkpoint-list',
  'campaign-search', 'campaign-reference-health', 'campaign-checklist-list', 'campaign-export', 'campaign-import-file',
  'campaign-asset-list', 'campaign-register-asset', 'campaign-timezone', 'campaign-message-schedule',
]) assert(html.includes(`id="${id}"`), `Milestone 20 UI element missing: ${id}`);

for (const feature of [
  'CampaignState', 'CampaignRunState', 'createCampaign', 'startSession', 'endSession', 'activateScene',
  'previewCampaignTimeAdvance', 'triggerTimelineEvent', 'revealCampaignEntity', 'createCheckpoint',
  'searchCampaign', 'campaignBacklinks', 'validateCampaignReferences', 'normalizeCampaignState',
  'createAsset', 'setCampaignTimezone', 'setCampaignNoteCompleted', 'createCampaignExport',
]) assert(campaignSystem.includes(feature), `Campaign domain feature missing: ${feature}`);

for (const feature of ['Scene Director', 'refreshExternalReferences', 'onActiveSceneChange', 'onTimeChange', 'onWeatherChange']) {
  assert(campaignStudio.includes(feature) || html.includes(feature), `Campaign Studio integration missing: ${feature}`);
}

assert(main.includes('campaign: campaignState'), 'Project export/autosave does not include the campaign container.');
assert(main.includes('pendingImportedCampaign'), 'Project import does not restore campaign state.');
assert(main.includes('syncCampaignScenePlacement'), 'Active scenes do not stage NPCs without overwriting schedules.');
assert(main.includes("weather === 'auto' ? null"), 'Campaign automatic weather is not synchronized safely.');
assert(worldSource.includes('schemaVersion: 20'), 'World schema version is not 20.');
assert(!dependencyLock.includes('applied-caas'), 'Release lockfile contains an internal registry URL.');
const releaseVersion = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf8')).version;
const [releaseMajor, releaseMinor] = releaseVersion.split('.').map(Number);
assert(releaseMajor > 0 || releaseMinor >= 20, 'Release version is older than Milestone 20.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const output = execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone20Test.js')], { cwd: projectPath, encoding: 'utf8' });
process.stdout.write(output);
