import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectPath = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(projectPath, '.test-build');
const compilerPath = join(projectPath, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(outputPath, { recursive: true, force: true });
if (existsSync(compilerPath)) {
  execFileSync(process.execPath, [compilerPath, '-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
} else {
  execFileSync('tsc', ['-p', 'tsconfig.test.json'], { cwd: projectPath, stdio: 'inherit' });
}
writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'EditorStatePersistenceTest.js')], {
  cwd: projectPath,
  stdio: 'inherit',
});
