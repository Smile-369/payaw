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
const main = readFileSync(join(projectPath, 'src', 'main.ts'), 'utf8');
const placement = readFileSync(join(projectPath, 'src', 'engine', 'regional', 'SettlementGenerator.ts'), 'utf8');
const css = readFileSync(join(projectPath, 'src', 'styles.css'), 'utf8');

assert(main.includes('findNearestValidSettlementTile'), 'The browser editor is not using validated settlement placement.');
assert(main.includes("dragPreview.kind === 'settlement'"), 'Settlement drag previews are not validated while moving.');
assert(main.includes("canvas.classList.add('entity-drag-invalid')"), 'Invalid settlement drag feedback is missing.');
assert(placement.includes("warnings.push('water')"), 'Water-placement warning is missing.');
assert(placement.includes('Milestone 18 deliberately treats terrain rules as warnings'), 'GM-authored placement freedom is missing.');
assert(css.includes('entity-drag-invalid'), 'Invalid-drop cursor styling is missing.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone163Test.js')], { cwd: projectPath, stdio: 'inherit' });
