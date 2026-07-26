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
const shell = readFileSync(join(projectPath, 'src', 'ui', 'Milestone21Shell.ts'), 'utf8');
const css = readFileSync(join(projectPath, 'src', 'ui', 'ms21.css'), 'utf8');
const main = readFileSync(join(projectPath, 'src', 'main.ts'), 'utf8');
const generationOptions = readFileSync(join(projectPath, 'src', 'engine', 'generation', 'GenerationOptions.ts'), 'utf8');
const storyGenerator = readFileSync(join(projectPath, 'src', 'story', 'StoryGenerator.ts'), 'utf8');
const dependencyLock = readFileSync(join(projectPath, 'pnpm-lock.yaml'), 'utf8');

assert(html.includes('/src/bootstrap.ts'), 'Milestone 21 bootstrap is not installed.');
assert(shell.includes('WORLD') && shell.includes('CAMPAIGN'), 'WORLD/CAMPAIGN workspace shell is missing.');
assert(shell.includes('Type category') && shell.includes('Community / settlement'), 'Settlement type-category UI is missing.');
assert(shell.includes('retireLegacyAuthoringUi'), 'Legacy authored-map feature retirement is missing.');
assert(shell.includes("sections.slice(1)"), 'Generalized authored-map feature panels are not retired from the visible UI.');
assert(css.includes('--win-face') && css.includes('--title-blue'), 'Messenger-inspired Win98 design tokens are missing.');
assert(css.includes('grid-template-columns: 70px 286px minmax(0, 1fr) 0'), 'Map-first application shell is missing.');
assert(main.includes('suppressStoryPoint') && main.includes('restoreAllSuppressedStoryPoints'), 'Story-point remove/restore workflow is missing.');
assert(generationOptions.includes('readonly suppressed?: boolean'), 'Story-rule suppression contract is missing.');
assert(storyGenerator.includes("suppressed !== true"), 'Suppressed story points are not excluded from generated output.');
assert(!/Island Editor/i.test(html), 'Removed Island Editor copy returned.');
assert(dependencyLock.includes("lockfileVersion: '9.0'"), 'Release dependency lockfile is invalid.');
assert(!dependencyLock.includes('applied-caas'), 'Release lockfile contains an internal registry URL.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
const output = execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone21Test.js')], { cwd: projectPath, encoding: 'utf8' });
process.stdout.write(output);
