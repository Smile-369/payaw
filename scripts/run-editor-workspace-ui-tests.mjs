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
const commandPalette = readFileSync(join(projectPath, 'src', 'ui', 'CommandPalette.ts'), 'utf8');
const recentProjects = readFileSync(join(projectPath, 'src', 'project', 'RecentProjectStore.ts'), 'utf8');
const css = readFileSync(join(projectPath, 'src', 'styles.css'), 'utf8');

for (const id of [
  'studio-dock', 'studio-inspector-panel', 'studio-layers-panel', 'studio-project-panel',
  'minimap-canvas', 'studio-statusbar', 'command-palette-backdrop', 'toast-stack',
  'restore-session-button', 'recent-project-list', 'studio-theme-select',
]) assert(html.includes(`id="${id}"`), `Editor workspace UI element missing: ${id}`);

for (const feature of [
  'renderStudioLayerManager', 'rebuildMinimapBase', 'renderInspector', 'scheduleAutosave',
  'recordRecentProject', 'showToast', 'setTheme',
]) assert(main.includes(feature), `Editor workspace implementation missing: ${feature}`);

assert(commandPalette.includes('export class CommandPalette') && commandPalette.includes('public open()'), 'Command palette module is missing.');
assert(recentProjects.includes('saveRecentProject') && recentProjects.includes('loadRecentProjects'), 'Recent-project persistence module is missing.');

assert(css.includes("html[data-theme='light']"), 'Light appearance is missing.');
assert(css.includes("html[data-theme='contrast']"), 'High-contrast appearance is missing.');
assert(css.includes('.studio-dock'), 'Studio dock styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'EditorWorkspaceUiTest.js')], { cwd: projectPath, stdio: 'inherit' });
