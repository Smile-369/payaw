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
const main = readFileSync(join(projectPath, 'src', 'EditorApplication.ts'), 'utf8');
const renderer = readFileSync(join(projectPath, 'src', 'engine', 'renderer', 'CanvasRenderer.ts'), 'utf8');
const pipeline = readFileSync(join(projectPath, 'src', 'engine', 'generation', 'GenerationPipeline.ts'), 'utf8');
const dependencyLock = readFileSync(join(projectPath, 'pnpm-lock.yaml'), 'utf8');

for (const id of [
  'authoring-card', 'authoring-settlement-name', 'authoring-settlement-kind',
  'authoring-place-settlement', 'authoring-settlement-list', 'authoring-feature-category',
  'authoring-feature-reality', 'authoring-feature-list', 'authoring-terrain-operation',
  'authoring-terrain-size', 'authoring-layer', 'hidden-payaw-layer',
]) assert(html.includes(`id="${id}"`), `Milestone 18 UI element missing: ${id}`);

for (const value of ['barangay', 'subdivision', 'neighborhood', 'sitio', 'compound']) {
  assert(html.includes(`value="${value}"`), `Settlement kind missing from authoring UI: ${value}`);
}
for (const feature of [
  'beginSettlementPlacement', 'commitSettlementMove', 'commitAuthoringTerrain',
  'adoptGeneratedRoad', 'adoptGeneratedBuilding', 'resetAuthoringSelection',
  'authoringLayer', 'generatedFeatureOverrides',
]) assert(main.includes(feature), `Milestone 18 browser integration missing: ${feature}`);
for (const feature of ['drawAuthoredFeature', "settlement.source === 'authored'", 'drawLiveInfrastructure']) {
  assert(renderer.includes(feature), `Milestone 18 renderer integration missing: ${feature}`);
}
for (const stage of ['AuthoringTerrainStage', 'GeneratedRoadOverrideStage', 'AuthoringRoadStage', 'GeneratedBuildingOverrideStage']) {
  assert(pipeline.includes(stage), `Milestone 18 generation stage missing: ${stage}`);
}
assert(/id="live-infrastructure-layer"(?![^>]*checked)/.test(html), 'Infrastructure exception overlay should not be enabled by default.');
assert(renderer.includes('zoom < 3.2') && renderer.includes('zoom < 2.25'), 'Infrastructure status overlay is not zoom-aware.');
assert(renderer.includes('manualRoadStatusById') && renderer.includes('manualBridgeStatusById'), 'Infrastructure overlay does not prioritize manual exceptions.');
assert(dependencyLock.includes("lockfileVersion: '9.0'"), 'Release dependency lockfile is invalid.');
assert(!dependencyLock.includes('applied-caas'), 'Release lockfile contains an internal registry URL.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const output = execFileSync(process.execPath, [join(outputPath, 'tests', 'MapAuthoringLayerTest.js')], { cwd: projectPath, encoding: 'utf8' });
process.stdout.write(output);
