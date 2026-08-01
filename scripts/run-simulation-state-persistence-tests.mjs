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
const layers = readFileSync(join(projectPath, 'src', 'engine', 'renderer', 'Layers.ts'), 'utf8');
const dependencyLock = readFileSync(join(projectPath, 'pnpm-lock.yaml'), 'utf8');

for (const id of [
  'simulation-timezone-summary', 'simulation-now-summary', 'simulation-period-summary',
  'simulation-venue-summary', 'simulation-npc-summary', 'simulation-event-filter',
  'simulation-event-clear', 'live-infrastructure-layer', 'venue-status-layer',
  'settlement-activity-layer', 'supernatural-activity-layer',
]) assert(html.includes(`id="${id}"`), `Milestone 17.1 UI element missing: ${id}`);
for (const feature of ['timestampFromZonedLocal', 'simulationEventIcon', 'clearEventLog', 'simulationPreset']) {
  assert(main.includes(feature), `Milestone 17.1 browser integration missing: ${feature}`);
}
for (const feature of ['drawLiveInfrastructure', 'drawVenueStatus', 'drawSettlementActivity', 'drawSupernaturalActivity']) {
  assert(renderer.includes(feature), `Milestone 17.1 renderer overlay missing: ${feature}`);
}
for (const feature of ['LiveInfrastructure', 'VenueStatus', 'SettlementActivity', 'SupernaturalActivity']) {
  assert(layers.includes(feature), `Milestone 17.1 layer definition missing: ${feature}`);
}
assert(dependencyLock.includes("lockfileVersion: '9.0'"), 'Release dependency lockfile is invalid.');
assert(!dependencyLock.includes('applied-caas'), 'Release lockfile still contains an internal package registry URL.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const output = execFileSync(process.execPath, [join(outputPath, 'tests', 'SimulationStatePersistenceTest.js')], { cwd: projectPath, encoding: 'utf8' });
process.stdout.write(output);
