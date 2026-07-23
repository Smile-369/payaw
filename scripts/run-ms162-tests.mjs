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
const clock = readFileSync(join(projectPath, 'src', 'engine', 'time', 'WorldClock.ts'), 'utf8');

for (const id of ['npc-view-toggle-button', 'realtime-clock', 'realtime-clock-time', 'realtime-clock-date', 'realtime-clock-period', 'npc-layer']) {
  assert(html.includes(`id="${id}"`), `Milestone 16.2 UI element missing: ${id}`);
}
assert((html.match(/data-layer-target="npc-layer"/g) ?? []).length >= 2, 'NPC view toggle is not exposed in both category and NPC menus.');
for (const feature of ['toggleNpcView', 'updateRealtimeClock', 'renderSimulationPanel', 'syncNpcViewToggle']) {
  assert(main.includes(feature), `Milestone 16.2 implementation missing: ${feature}`);
}
for (const feature of ['npcSchedulePeriodForHour', 'positionNpcPopulationForPeriod', 'liveClockSnapshot']) {
  assert(clock.includes(feature), `World clock engine feature missing: ${feature}`);
}
assert(css.includes('.realtime-clock'), 'Live clock styling is missing.');
assert(css.includes('#npc-view-toggle-button'), 'NPC toolbar-toggle styling is missing.');

const idMatches = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert(new Set(idMatches).size === idMatches.length, 'Duplicate HTML IDs detected.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone162Test.js')], { cwd: projectPath, stdio: 'inherit' });
