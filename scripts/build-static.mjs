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
  source = source.replace(/^\s*await\s+import\(\s*['"][^'"]+\.css['"]\s*\);?\s*$/gm, '');
  source = source.replace(/(from\s+['"])([^'"]+)(['"])/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  source = source.replace(/(import\s*\(\s*['"])([^'"]+)(['"]\s*\))/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  source = source.replace(/(import\s+['"])([^'"]+)(['"])/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  source = source.replace(/(new URL\(\s*['"])([^'"]+\.ts)(['"])/g, (_m, a, spec, b) => `${a}${addJsExtension(spec)}${b}`);
  writeFileSync(file, source);
}

let html = readFileSync(join(projectPath, 'index.html'), 'utf8');
html = html.replace('<meta content="#0b0f0d" name="theme-color"/>', '<meta content="#0a246a" name="theme-color"/>');
html = html.replace('</head>', '<script src="./route-styles.js"></script></head>');
html = html.replace('/src/bootstrap.ts', './src/bootstrap.js');
writeFileSync(join(distPath, 'index.html'), html);
cpSync(join(projectPath, 'src', 'styles.css'), join(distPath, 'styles.css'));
cpSync(join(projectPath, 'src', 'ui', 'ms21.css'), join(distPath, 'ms21.css'));
cpSync(join(projectPath, 'src', 'player', 'player.css'), join(distPath, 'player.css'));
writeFileSync(join(distPath, 'route-styles.js'), `(() => {
  const isPlayer = new URLSearchParams(location.search).get('view') === 'player';
  const sheets = isPlayer ? ['./player.css?v=20260726-opaque-dice'] : ['./styles.css?v=20260726-opaque-dice', './ms21.css?v=20260726-opaque-dice'];
  for (const href of sheets) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
  }
})();
`);

console.log(`Static QA build written to ${relative(projectPath, distPath)}`);
