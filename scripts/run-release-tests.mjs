import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectPath = dirname(dirname(fileURLToPath(import.meta.url)));
const suites = [
  ['Campaign and DM view', 'run-ms20-tests.mjs'],
  ['GM workspace shell', 'run-ms21-tests.mjs'],
  ['Player projection', 'run-ms22-tests.mjs'],
  ['Hosted player boundary', 'run-ms23-tests.mjs'],
  ['Character privacy', 'run-character-social-tests.mjs'],
  ['Editor persistence', 'run-editor-state-tests.mjs'],
];

for (const [label, script] of suites) {
  process.stdout.write(`\n=== ${label} ===\n`);
  execFileSync(process.execPath, [join(projectPath, 'scripts', script)], {
    cwd: projectPath,
    stdio: 'inherit',
  });
}

process.stdout.write(`\nPAYAW release regression: ${suites.length}/${suites.length} suites passed.\n`);
