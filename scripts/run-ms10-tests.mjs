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
  'bridge-count', 'bridge-summary', 'bridge-list', 'bridge-form', 'bridge-name',
  'bridge-from-island', 'bridge-to-island', 'bridge-type', 'bridge-road-class',
  'bridge-width', 'bridge-clearance', 'bridge-reset-all', 'bridge-layer', 'bridge-label-layer',
]) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) ?? [];
  assert.equal(matches.length, 1, `${id} must exist exactly once`);
}
assert(source.includes('function renderBridgeList()'), 'Bridge editor renderer is missing.');
assert(source.includes("regenerateFrom('bridges'"), 'Bridge edits must use bridge-stage regeneration.');
assert(source.includes('customBridges'), 'Custom bridge authoring state is missing.');
assert(css.includes('.bridge-item'), 'Bridge editor styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone10Test.js')], { cwd: projectPath, stdio: 'inherit' });
