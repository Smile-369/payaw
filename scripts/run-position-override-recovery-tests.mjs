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
const source = readFileSync(join(projectPath, 'src', 'EditorApplication.ts'), 'utf8');

assert(source.includes('recoverPositionOverrides('), 'The browser generation flow does not recover stale overrides.');
assert(source.includes('Reset ${recoveredOverrides.length} stale saved position'), 'The recovery status message is missing.');
assert(source.includes('saveMapCustomization(signature, mapCustomization)'), 'Recovered override state is not persisted.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'PositionOverrideRecoveryTest.js')], { cwd: projectPath, stdio: 'inherit' });
