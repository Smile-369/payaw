import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectPath = dirname(scriptDirectory);
const outputPath = join(projectPath, '.test-build');
const localCompilerPath = join(projectPath, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(outputPath, { recursive: true, force: true });

if (existsSync(localCompilerPath)) {
  execFileSync(process.execPath, [localCompilerPath, '-p', 'tsconfig.test.json'], {
    cwd: projectPath,
    stdio: 'inherit',
  });
} else {
  // Useful for clean source archives in environments that already provide TypeScript.
  // Normal users will take the local branch after `pnpm install`.
  execFileSync('tsc', ['-p', 'tsconfig.test.json'], {
    cwd: projectPath,
    stdio: 'inherit',
  });
}

writeFileSync(join(outputPath, 'package.json'), '{"type":"commonjs"}\n');
execFileSync(process.execPath, [join(outputPath, 'tests', 'ZoningStoryAuthoringTest.js')], {
  cwd: projectPath,
  stdio: 'inherit',
});
