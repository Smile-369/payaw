import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectPath = dirname(scriptDirectory);
const distPath = join(projectPath, 'dist');
const srcOut = join(distPath, 'src');
rmSync(distPath, { recursive: true, force: true });
mkdirSync(srcOut, { recursive: true });

execFileSync('tsc', [
  '-p', join(projectPath, 'tsconfig.json'),
  '--noEmit', 'false',
  '--outDir', srcOut,
  '--rootDir', join(projectPath, 'src'),
  '--sourceMap', 'true',
], { cwd: projectPath, stdio: 'inherit' });

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function addJsExtension(specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const extension = extname(specifier);
  if (extension === '.js' || extension === '.json' || extension === '.css') return specifier;
  if (extension === '.ts') return specifier.slice(0, -3) + '.js';
  return specifier + '.js';
}

for (const file of walk(srcOut).filter((path) => path.endsWith('.js'))) {
  let source = readFileSync(file, 'utf8');
  source = source.replace(/^import\s+['"]([^'"]+\.css)['"];?\s*$/gm, '');
  source = source.replace(/(from\s+['"])([^'"]+)(['"])/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  source = source.replace(/(import\s*\(\s*['"])([^'"]+)(['"]\s*\))/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  source = source.replace(/(import\s+['"])([^'"]+)(['"])/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  source = source.replace(/(new URL\(\s*['"])([^'"]+\.ts)(['"])/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  writeFileSync(file, source);
}

let html = readFileSync(join(projectPath, 'index.html'), 'utf8');
html = html.replace('<meta content="#0b0f0d" name="theme-color"/>', '<meta content="#0a246a" name="theme-color"/>');
html = html.replace('</head>', '<link rel="stylesheet" href="./styles.css"/><link rel="stylesheet" href="./ms21.css"/></head>');
html = html.replace('/src/bootstrap.ts', './src/bootstrap.js');
writeFileSync(join(distPath, 'index.html'), html);
cpSync(join(projectPath, 'src', 'styles.css'), join(distPath, 'styles.css'));
cpSync(join(projectPath, 'src', 'ui', 'ms21.css'), join(distPath, 'ms21.css'));

console.log(`Static QA build written to ${relative(projectPath, distPath)}`);
