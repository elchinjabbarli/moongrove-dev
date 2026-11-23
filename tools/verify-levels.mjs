/**
 * Level curve verification: generates all 1000 levels, proves every board
 * fully clears (merge-forest invariant), and prints the difficulty table.
 * Usage: npm run verify
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'mg-levels-'));
const outfile = join(tmp, 'levels.mjs');
await build({
  entryPoints: ['src/levels.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'error',
});
const { generateLevel, simulateClear, maskCells } = await import(`file://${outfile}`);

let min = Infinity;
let max = 0;
let fails = 0;
const bands = [1, 5, 10, 50, 100, 200, 500, 800, 999, 1000];
const rows = [];

for (let n = 1; n <= 1000; n++) {
  const lv = generateLevel(n);
  if (!simulateClear(lv)) {
    fails++;
    if (fails <= 3) console.error(`  ✗ level ${n} does not fully clear`);
  }
  const t = lv.tiles.length;
  if (t < min) min = t;
  if (t > max) max = t;
  if (bands.includes(n)) {
    rows.push({ n, tiles: t, layers: lv.layers, blossoms: lv.blossoms, species: lv.speciesCount, par: lv.parScore, mask: lv.mask, tray: lv.traySize });
  }
}

console.log('LEVEL CURVE (deterministic — same on every device)');
console.log('level | tiles | layers | blossoms | species | par  | mask       | tray');
for (const r of rows) {
  console.log(`${String(r.n).padStart(5)} | ${String(r.tiles).padStart(5)} | ${String(r.layers).padStart(6)} | ${String(r.blossoms).padStart(8)} | ${String(r.species).padStart(7)} | ${String(r.par).padStart(4)} | ${r.mask.padEnd(10)} | ${r.tray}`);
}
console.log(`\ntiles: min ${min}, max ${max} across 1000 levels`);
console.log(fails === 0 ? '✓ all 1000 levels are merge-complete (always fully clearable)' : `✗ ${fails} levels failed the clear simulation`);

console.log('\nBOARD MASKS (ASCII)');
for (const mask of ['orb', 'flower', 'hex', 'diamond', 'butterfly', 'heart']) {
  const cells = maskCells(mask);
  const grid = Array.from({ length: 10 }, () => Array(7).fill('·'));
  for (const c of cells) grid[c.r][c.c] = '█';
  console.log(`${mask} (${cells.length} cells)`);
  console.log(grid.map((r) => r.join(' ')).map((r) => `  ${r}`).join('\n'));
}

if (fails > 0) process.exit(1);
