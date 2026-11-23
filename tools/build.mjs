/**
 * Build: typecheck (tsc) → bundle (esbuild) → assemble the deployable site
 * in dist/. The manifest is stamped from src/version.ts so every artifact
 * carries the identical version.
 *
 * Usage: npm run build
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dev = join(root, '..');
const dist = join(dev, 'dist');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// 1. typecheck
const tsc = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit'], { cwd: dev, encoding: 'utf8', stdio: 'pipe' });
if (tsc.status !== 0) {
  console.error(tsc.stdout || '');
  console.error(tsc.stderr || '');
  fail('TypeScript typecheck failed');
}

// 2. bundle
mkdirSync(join(dist, 'assets'), { recursive: true });
await build({
  entryPoints: [join(dev, 'src/main.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: join(dist, 'assets/index.js'),
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'error',
});
cpSync(join(dev, 'src/style.css'), join(dist, 'assets/index.css'));

// 3. static site chrome
for (const f of ['index.html', 'privacy.html', 'robots.txt', '.nojekyll']) {
  cpSync(join(dev, 'site', f), join(dist, f));
}

// 4. version stamping (single source: src/version.ts)
const versionSrc = readFileSync(join(dev, 'src/version.ts'), 'utf8');
const m = versionSrc.match(/VERSION\s*=\s*'([^']+)'/);
if (!m) fail('VERSION not found in src/version.ts');
const version = m[1];

const manifest = {
  name: 'Moongrove — Evolution Match Puzzle',
  short_name: 'Moongrove',
  description: 'Merge three alike and watch them evolve — grow a luminous night garden through 1000 levels.',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0b1026',
  theme_color: '#0b1026',
  version,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// package.json version must match (user checks versions everywhere)
const pkg = JSON.parse(readFileSync(join(dev, 'package.json'), 'utf8'));
if (pkg.version !== version) fail(`package.json version ${pkg.version} ≠ src/version.ts ${version} — keep them identical`);

// 5. icons
if (!existsSync(join(dist, 'icons/icon-512.png'))) {
  console.warn('⚠ dist/icons missing — run: python3 tools/icons.py');
}

// 6. report
const files = ['index.html', 'assets/index.js', 'assets/index.css', 'manifest.webmanifest', 'icons/icon-512.png'];
console.log(`✓ Moongrove v${version} built → dist/`);
for (const f of files) {
  const p = join(dist, f);
  const kb = existsSync(p) ? (statSync(p).size / 1024).toFixed(1) : '—';
  console.log(`   ${f.padEnd(24)} ${kb} KB`);
}
