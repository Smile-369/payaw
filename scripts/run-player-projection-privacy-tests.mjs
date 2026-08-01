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
const read = (...parts) => readFileSync(join(projectPath, ...parts), 'utf8');
const withoutComments = (value) => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const html = read('index.html');
const bootstrap = read('src', 'bootstrap.ts');
const projection = read('src', 'player', 'PlayerProjection.ts');
const service = read('src', 'player', 'ProjectionService.ts');
const app = read('src', 'player', 'PlayerApp.ts');
const css = read('src', 'player', 'player.css');
const staticBuild = read('scripts', 'build-static.mjs');
const main = read('src', 'EditorApplication.ts');
const dependencyLock = read('pnpm-lock.yaml');

for (const id of [
  'player-preview-panel', 'player-preview-viewer', 'player-capability-grid', 'player-grant-type',
  'player-grant-entity', 'player-grant-list', 'player-projection-summary', 'player-projection-safety',
  'player-preview-open', 'player-preview-download',
]) assert(html.includes(`id="${id}"`), `Milestone 22 GM preview control missing: ${id}`);

assert(bootstrap.indexOf("requestedView === 'player'") < bootstrap.indexOf("import('./main')"), 'Player bootstrap does not branch before loading GM state.');
assert(bootstrap.includes("import('./netcode/NetworkPlayerBootstrap')") || bootstrap.includes("import('./player/PlayerApp')"), 'Separate Player App entry point is missing.');
assert(projection.includes('PLAYER_PROJECTION_VERSION') && projection.includes('parsePlayerProjection'), 'Versioned PlayerProjection boundary is missing.');
assert(service.includes('createPlayerProjection') && service.includes('knowledgeFor'), 'Knowledge-filtered projection service is missing.');
assert(!withoutComments(app).includes("import '../main'"), 'Player App imports the raw GM application.');
assert(css.includes('@media (max-width: 980px)') && css.includes('position: fixed') && css.includes('.player-nav'), 'Responsive mobile Player View navigation is missing.');
assert(app.includes('player-mobile-menu') && css.includes('.player-mobile-more'), 'Mobile access to campaign records and utilities is missing.');

assert(app.includes("player-utility-dialog player-dice-dialog") && app.includes("player-utility-panel player-dice-panel"), 'Dice tray is missing its dedicated opaque dialog classes.');
assert(css.includes('#player-dice-dialog .player-dice-panel') && css.includes('background-color: #d4d0c8 !important'), 'Player dice tray does not enforce an opaque panel surface.');
assert(css.includes('#player-dice-dialog .player-list') && css.includes('background: #fff !important'), 'Player dice history does not enforce an opaque history surface.');
assert(staticBuild.includes("'player.css'") && staticBuild.includes('route-styles.js'), 'Static build does not ship and select the Player View stylesheet.');
assert(staticBuild.includes('await\\s+import') || staticBuild.includes('await\s+import'), 'Static build does not remove browser-invalid dynamic CSS imports.');
assert(app.includes("if (child !== app) child.remove()"), 'Player bootstrap does not remove the static GM DOM outside the player root.');
assert(main.includes('playerView: playerViewState') && main.includes('pendingImportedPlayerView'), 'Player View state is not persisted through save/import.');
assert(dependencyLock.includes("lockfileVersion: '9.0'"), 'Release dependency lockfile is invalid.');
assert(!dependencyLock.includes('applied-caas'), 'Release lockfile contains an internal registry URL.');

const retiredSources = [
  ['src', 'engine', 'infrastructure', 'WaterRoute.ts'],
  ['src', 'engine', 'generation', 'stages', 'WaterRouteStage.ts'],
];
for (const path of retiredSources) assert(!existsSync(join(projectPath, ...path)), `Retired water-route source returned: ${path.join('/')}`);

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const behavior = JSON.parse(execFileSync(process.execPath, [join(outputPath, 'tests', 'PlayerProjectionPrivacyTest.js')], { cwd: projectPath, encoding: 'utf8' }));
const result = {
  release: packageJson.version,
  typecheck: 'passed',
  playerProjection: behavior,
  separatePlayerEntry: true,
  responsivePlayerUi: true,
  persistence: true,
  waterRoutes: 'removed',
};
const output = `${JSON.stringify(result, null, 2)}\n`;
process.stdout.write(output);
