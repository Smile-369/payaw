import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectPath = dirname(scriptDirectory);
const outputPath = join(projectPath, '.test-build');
const localCompilerPath = join(projectPath, 'node_modules', 'typescript', 'bin', 'tsc');
const html = readFileSync(join(projectPath, 'index.html'), 'utf8');
const source = readFileSync(join(projectPath, 'src', 'main.ts'), 'utf8');
const css = readFileSync(join(projectPath, 'src', 'styles.css'), 'utf8');

for (const id of [
  'port-count', 'port-summary', 'port-list', 'port-form', 'port-name', 'port-island', 'port-type', 'port-capacity', 'port-reset-all',
  'water-route-count', 'water-route-summary', 'water-route-list', 'water-route-form', 'water-route-name', 'water-route-from-port', 'water-route-to-port',
  'water-route-type', 'water-route-vessel', 'water-route-reset-all', 'port-layer', 'port-label-layer', 'water-route-layer', 'water-route-label-layer',
  'dm-maritime-list', 'dm-maritime-result',
]) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) ?? [];
  assert.equal(matches.length, 1, `${id} must exist exactly once`);
}
assert(source.includes('function renderPortList()'), 'Port editor renderer is missing.');
assert(source.includes('function renderWaterRouteList()'), 'Water-route editor renderer is missing.');
assert(source.includes("regenerateFrom('ports'"), 'Port edits must use port-stage regeneration.');
assert(source.includes("regenerateFrom('water-routes'"), 'Water-route edits must use route-stage regeneration.');
assert(css.includes('.port-item') && css.includes('.water-route-item'), 'Maritime editor styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone11Test.js')], { cwd: projectPath, stdio: 'inherit' });
