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
const withoutComments = (value) => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const html = read('index.html');
const shell = read('src', 'ui', 'Milestone21Shell.ts');
const css = read('src', 'ui', 'ms21.css');
const pipeline = withoutComments(read('src', 'engine', 'generation', 'GenerationPipeline.ts'));
const world = withoutComments(read('src', 'engine', 'world', 'World.ts'));
const layers = withoutComments(read('src', 'engine', 'renderer', 'Layers.ts'));
const renderer = withoutComments(read('src', 'engine', 'renderer', 'CanvasRenderer.ts'));
const travel = withoutComments(read('src', 'engine', 'travel', 'TravelPlanner.ts'));
const simulationTypes = withoutComments(read('src', 'engine', 'simulation', 'SimulationTypes.ts'));
const main = withoutComments(read('src', 'main.ts'));
const packageJson = JSON.parse(read('package.json'));
const packageLock = read('package-lock.json');

for (const retiredClass of ['.bridge-editor', '.maritime-editor', '.naming-editor', '.zone-editor', '.asset-editor']) {
  assert(shell.includes(retiredClass), `Legacy editor is not retired by the shell: ${retiredClass}`);
}
assert(!shell.includes("key: 'transport'"), 'Transit returned to the World tool rail.');
assert(html.includes('id="world-story-list"') && main.includes('worldStoryList.append(createStoryListCard(item))'), 'Generated story points are not removable from the World Story panel.');
assert(css.includes('grid-template-rows: 27px 23px 50px'), 'Command row does not reserve enough height for the workspace switcher.');
assert(css.includes('height: 36px') && css.includes('min-height: 36px'), 'Workspace tabs do not have an explicit collision-safe height.');
assert(css.includes('#control-panel .regional-scale-readout') && css.includes('color: #111 !important') && css.includes('background: #fff !important'), 'Regional scale summary still lacks high-contrast colors.');
assert(css.includes('grid-template-columns: minmax(0, 1fr)') && css.includes('.maritime-columns'), 'Legacy drawer forms do not collapse safely to one column.');
assert(main.includes("setStudioTab(activeStudioTab === 'layers' || activeStudioTab === 'project' ? activeStudioTab : 'inspector', false)"), 'Inspector dock still opens during initialization.');

assert(!html.includes('id="water-route-'), 'Water-route UI controls remain in index.html.');
assert(!html.includes('value="mixed-ferry"'), 'Mixed/ferry travel mode remains in the active UI.');
assert(!pipeline.includes('WaterRouteStage'), 'Water-route generation stage remains active.');
assert(!world.includes('waterRoutes'), 'Water-route data remains in world persistence.');
assert(!layers.includes('WaterRoutes') && !layers.includes('WaterRouteLabels'), 'Water-route render layers remain active.');
assert(!renderer.includes('drawWaterRoutes') && !renderer.includes('drawWaterRouteLabels'), 'Water-route drawing remains active.');
assert(!travel.includes('MixedFerry') && !travel.includes("'ferry'"), 'Ferry route planning remains active.');
assert(!simulationTypes.includes('waterRouteStatusById') && !simulationTypes.includes('manualWaterRouteStatusById'), 'Water-route simulation state remains active.');
assert(!existsSync(join(projectPath, 'src', 'engine', 'infrastructure', 'WaterRoute.ts')), 'Water-route domain module still exists.');
assert(!existsSync(join(projectPath, 'src', 'engine', 'generation', 'stages', 'WaterRouteStage.ts')), 'Water-route generation module still exists.');
assert(packageLock.includes(`"version": "${packageJson.version}"`), 'Release lockfile version is out of sync.');
assert(!packageLock.includes('applied-caas'), 'Release lockfile contains an internal registry URL.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const milestone21 = JSON.parse(execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone21Test.js')], { cwd: projectPath, encoding: 'utf8' }));
const result = {
  release: packageJson.version,
  typecheck: 'passed',
  workspaceTabs: 'collision-safe',
  legacyEditors: 'retired',
  inspectorDefault: 'closed',
  storyPointRemoval: milestone21.storyPointsAfterRemoval === milestone21.baselineStoryPoints - 1,
  communityAnchors: true,
  waterRoutes: 'removed',
};
const output = `${JSON.stringify(result, null, 2)}\n`;
process.stdout.write(output);
writeFileSync(join(projectPath, 'docs', 'MS21_1_TEST_RESULTS.json'), output);
