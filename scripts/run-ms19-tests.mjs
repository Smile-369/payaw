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
const npcAuthoring = readFileSync(join(projectPath, 'src', 'campaign', 'NPCLocationAuthoring.ts'), 'utf8');
const npcGenerator = readFileSync(join(projectPath, 'src', 'engine', 'npc', 'NPCGenerator.ts'), 'utf8');
const packageLock = readFileSync(join(projectPath, 'package-lock.json'), 'utf8');

for (const id of [
  'npc-create-button', 'npc-edit-home', 'npc-edit-unusual-home', 'npc-schedule-day-tabs',
  'npc-schedule-add', 'npc-relationship-add', 'npc-override-add', 'npc-scene-place',
  'location-source', 'location-save', 'location-hours-save', 'authoring-settlement-kind',
]) assert(html.includes(`id="${id}"`), `Milestone 19 UI element missing: ${id}`);

assert(html.includes('<strong>Anchor points</strong>'), 'Settlement UI was not consolidated into the anchor-point editor.');
assert(html.includes('Community anchor'), 'NPC editor does not use the anchor-based community model.');
assert(!html.includes('id="satellite-count-input"'), 'Settlement generation count still appears in the Generation profile.');
assert(!/<summary>Settlements<\/summary>/i.test(html), 'Settlements still appear as a separate top-level map category.');
assert(html.includes('Community anchors'), 'The unified community-anchor label is missing.');
assert(html.includes('Point anchors'), 'The point-anchor label is missing.');

assert(!/Island Editor/i.test(html), 'Island Editor tab or copy still exists.');
assert(!main.includes('enable bridges in the island editor'), 'Runtime still directs the GM to the removed Island Editor.');
assert(main.includes('satelliteSettlementCount: 0'), 'Generation profile still creates satellite settlements automatically.');

for (const feature of [
  'saveSelectedNpc', 'createAuthoredNpc', 'updateSelectedNpcSchedule', 'resolveNpcPlacement',
  'saveLocationRecord', 'validateNpcHome', 'scheduleLocationFromRef', 'NPCTemporaryOverride', 'NPCScenePlacement',
]) assert(main.includes(feature) || npcAuthoring.includes(feature), `Milestone 19 integration missing: ${feature}`);
assert(npcAuthoring.includes('NPC homes must be residential'), 'Residential-only home validation is missing.');
assert(npcAuthoring.includes("source: 'scene' | 'override' | 'schedule' | 'home'"), 'NPC placement precedence is missing.');
assert(npcGenerator.includes('status: NPCStatus.Alive'), 'Generated NPCs still receive random story conditions.');
assert(!packageLock.includes('applied-caas'), 'Release lockfile contains an internal registry URL.');
const releaseVersion = JSON.parse(packageLock).version;
const [releaseMajor, releaseMinor] = releaseVersion.split('.').map(Number);
assert(releaseMajor > 0 || releaseMinor >= 19, 'Release lockfile version is older than Milestone 19.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const output = execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone19Test.js')], { cwd: projectPath, encoding: 'utf8' });
process.stdout.write(output);
writeFileSync(join(projectPath, 'docs', 'MS19_TEST_RESULTS.json'), output.trim() + '\n');
