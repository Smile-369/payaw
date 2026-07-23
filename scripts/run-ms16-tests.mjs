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
const css = readFileSync(join(projectPath, 'src', 'styles.css'), 'utf8');
const travel = readFileSync(join(projectPath, 'src', 'engine', 'travel', 'TravelPlanner.ts'), 'utf8');
const roads = readFileSync(join(projectPath, 'src', 'engine', 'infrastructure', 'RoadNetwork.ts'), 'utf8');
const npcGenerator = readFileSync(join(projectPath, 'src', 'engine', 'npc', 'NPCGenerator.ts'), 'utf8');

for (const id of [
  'npc-generate-button', 'npc-list', 'npc-roster-size', 'npc-layer',
  'travel-from-location', 'travel-to-location', 'travel-pick-from', 'travel-pick-to',
  'travel-calculate', 'travel-alternatives', 'travel-result', 'travel-path-layer',
]) assert(html.includes(`id="${id}"`), `Revised Milestone 16 UI element missing: ${id}`);
assert(!html.includes('>Story Flow Studio<'), 'Story Flow Studio is still visible.');
assert(!/story-(?:beat|flow)/i.test(html), 'Legacy story-flow controls are still present in the HTML.');
assert(!/StoryCampaign|storyCampaign|storyBeat|storyFlow/.test(main), 'Legacy Story Flow implementation remains in main.ts.');
assert(!existsSync(join(projectPath, 'src', 'story', 'StoryCampaign.ts')), 'Legacy StoryCampaign source file still exists.');
assert(html.includes('class="category-toolbar"'), 'Category toolbar is missing.');
assert((html.match(/class="category-menu"/g) ?? []).length >= 9, 'Expected category menus are missing.');

const idMatches = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert(new Set(idMatches).size === idMatches.length, 'Duplicate HTML IDs detected.');

for (const feature of [
  'renderNPCList', 'regenerateNpcRoster', 'setTravelPointFromMap', 'renderTravelAlternatives',
  'activeTravelAlternatives', 'customTravelLocations',
]) assert(main.includes(feature), `Revised Milestone 16 implementation missing: ${feature}`);
for (const feature of ['planTravelAlternatives', 'pointTravelLocation', 'penalizedIndices']) {
  assert(travel.includes(feature), `Travel engine feature missing: ${feature}`);
}
assert(roads.includes('at least two independent graph connections'), 'Forked anchor routing invariant is missing.');
assert(npcGenerator.includes('generateNPCPopulation'), 'NPC generator implementation is missing.');
assert(css.includes('.category-toolbar'), 'Category toolbar styling is missing.');
assert(css.includes('.npc-card'), 'NPC styling is missing.');
assert(css.includes('.travel-alternatives'), 'Alternate route styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone16Test.js')], { cwd: projectPath, stdio: 'inherit' });
