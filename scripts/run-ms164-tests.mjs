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
const options = readFileSync(join(projectPath, 'src', 'engine', 'generation', 'GenerationOptions.ts'), 'utf8');

assert(options.includes('readonly islandKey?: string'), 'Settlement overrides do not persist a stable destination island key.');
assert(placement.includes('targetIsland.allowRoads = true'), 'Cross-island placement does not activate destination infrastructure.');
assert(placement.includes('targetIsland.settlementIds.push(settlement.id)'), 'Settlement ownership is not transferred to the destination island.');
assert(!placement.includes('must remain on its assigned island'), 'The previous assigned-island restriction is still present.');
assert(main.includes('tile.islandKey'), 'The editor does not save the destination island during a drag.');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(localCompilerPath)) execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
else execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'Milestone164Test.js')], { cwd: projectPath, stdio: 'inherit' });
