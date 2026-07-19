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
  'island-count',
  'regional-summary',
  'island-list',
  'island-reset-all',
  'island-layer',
  'island-label-layer',
  'settlement-layer',
]) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) ?? [];
  assert.equal(matches.length, 1, `${id} must exist exactly once`);
}
assert(source.includes('function renderIslandList()'), 'Island editor renderer is missing.');
assert(source.includes("regenerateFrom('islands'"), 'Island edits must use stage-level regeneration.');
assert(source.includes('islandOverrides'), 'Island overrides are missing from editor state.');
assert(css.includes('.island-item'), 'Island editor styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) {
  execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
} else {
  execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
}
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone9Test.js')], { cwd: projectPath, stdio: 'inherit' });
