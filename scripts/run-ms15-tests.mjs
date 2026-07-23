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

for (const id of [
  'studio-dock', 'studio-inspector-panel', 'studio-layers-panel', 'studio-project-panel',
  'minimap-canvas', 'studio-statusbar', 'command-palette-backdrop', 'toast-stack',
  'restore-session-button', 'recent-project-list', 'studio-theme-select',
]) assert(html.includes(`id="${id}"`), `Milestone 15 UI element missing: ${id}`);

for (const feature of [
  'renderStudioLayerManager', 'rebuildMinimapBase', 'renderInspector', 'scheduleAutosave',
  'recordRecentProject', 'openCommandPalette', 'showToast', 'setTheme',
]) assert(main.includes(feature), `Milestone 15 implementation missing: ${feature}`);

assert(css.includes("html[data-theme='light']"), 'Light appearance is missing.');
assert(css.includes("html[data-theme='contrast']"), 'High-contrast appearance is missing.');
assert(css.includes('.studio-dock'), 'Studio dock styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone15Test.js')], { cwd: projectPath, stdio: 'inherit' });
