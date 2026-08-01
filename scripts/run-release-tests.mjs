import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectPath = dirname(dirname(fileURLToPath(import.meta.url)));
const suites = [
  ['Campaign and DM view', 'run-campaign-management-tests.mjs'],
  ['GM workspace shell', 'run-campaign-studio-shell-tests.mjs'],
  ['Player projection', 'run-player-projection-privacy-tests.mjs'],
  ['Hosted player boundary', 'run-hosted-player-synchronization-tests.mjs'],
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
