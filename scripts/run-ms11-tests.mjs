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
const pipeline = readFileSync(join(projectPath, 'src', 'engine', 'generation', 'GenerationPipeline.ts'), 'utf8');
const world = readFileSync(join(projectPath, 'src', 'engine', 'world', 'World.ts'), 'utf8');

assert(html.includes('id="port-count"'), 'Coastal reference port count is missing.');
assert(!html.includes('id="water-route-'), 'Retired water-route UI returned.');
assert(!pipeline.includes('WaterRouteStage'), 'Retired water-route stage returned to generation.');
assert(!world.includes('waterRoutes'), 'Retired water-route state returned to world persistence.');
assert(!existsSync(join(projectPath, 'src', 'engine', 'infrastructure', 'WaterRoute.ts')), 'Retired water-route domain module returned.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone11Test.js')], { cwd: projectPath, stdio: 'inherit' });
