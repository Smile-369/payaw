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
const travel = readFileSync(join(projectPath, 'src', 'engine', 'travel', 'TravelPlanner.ts'), 'utf8');
const simulation = readFileSync(join(projectPath, 'src', 'engine', 'simulation', 'WorldSimulation.ts'), 'utf8');

for (const id of [
  'simulation-clock-mode', 'simulation-speed', 'simulation-datetime', 'simulation-weather',
  'simulation-weather-summary', 'simulation-traffic-summary', 'simulation-infrastructure-summary',
  'simulation-supernatural-summary', 'simulation-event-log', 'simulation-infrastructure-kind',
  'simulation-infrastructure-target', 'simulation-infrastructure-status',
]) assert(html.includes(`id="${id}"`), `Milestone 17 UI element missing: ${id}`);
for (const feature of ['WorldSimulation', 'renderSimulationPanel', 'simulationAdvanceHour', 'setInfrastructureOverride']) {
  assert(main.includes(feature), `Milestone 17 browser integration missing: ${feature}`);
}
for (const feature of ['TravelContext', 'closedRoadIds', 'roadSpeedMultiplier', 'contextRevision']) {
  assert(travel.includes(feature), `Milestone 17 live routing feature missing: ${feature}`);
}
for (const feature of ['simulateWeather', 'simulateTraffic', 'simulateInfrastructure', 'simulateVenues', 'simulateSupernatural']) {
  assert(simulation.includes(feature), `Milestone 17 simulation stage missing: ${feature}`);
}
const idMatches = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert(new Set(idMatches).size === idMatches.length, 'Duplicate HTML IDs detected.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const output = execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone17Test.js')], { cwd: projectPath, encoding: 'utf8' });
process.stdout.write(output);
