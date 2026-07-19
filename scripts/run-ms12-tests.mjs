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
assert(html.includes('id="project-import-file"'), 'Project JSON import control is missing.');
assert(html.includes('id="project-json-dropzone"'), 'Project JSON drop zone is missing.');
assert(main.includes("root.format === 'payaw-world-overrides'"), 'Override JSON auto-detection is missing.');
assert(main.includes("root.format === 'payaw-project'"), 'Project JSON auto-detection is missing.');
assert(main.includes('schemaVersion > 12'), 'Future-schema rejection is missing.');
rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone12Test.js')], { cwd: projectPath, stdio: 'inherit' });
