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
const source = readFileSync(join(projectPath, 'src', 'EditorApplication.ts'), 'utf8');
const css = readFileSync(join(projectPath, 'src', 'styles.css'), 'utf8');
for (const id of [
  'island-count-input',
  'island-spacing-input',
  'island-layer',
  'island-label-layer',
  'settlement-layer',
  'authoring-settlement-kind',
]) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) ?? [];
  assert.equal(matches.length, 1, `${id} must exist exactly once`);
}
assert(!html.includes('id="island-list"'), 'The retired Island Editor list is still present.');
assert(!html.includes('id="island-reset-all"'), 'The retired Island Editor reset control is still present.');
assert(source.includes('islandOverrides'), 'Legacy island overrides must remain import-compatible.');
assert(source.includes('authoring-settlement-kind'), 'Community anchors are not wired into the unified anchor editor.');
assert(css.includes('.authoring-card'), 'Unified anchor authoring styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) {
  execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
} else {
  execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
}
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'RegionalWorldGenerationTest.js')], { cwd: projectPath, stdio: 'inherit' });
