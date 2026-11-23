/**
 * Copies the built site (dist/) into the public game repo next door
 * (../moongrove). Commit & push from there.
 * Usage: npm run deploy
 */
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dev = dirname(fileURLToPath(import.meta.url));
const dist = join(dev, '..', 'dist');
const target = join(dev, '..', '..', 'moongrove');

if (!existsSync(dist)) {
  console.error('✗ dist/ missing — run npm run build first');
  process.exit(1);
}
if (!existsSync(target)) {
  console.error(`✗ ${target} not found — create the public repo folder first`);
  process.exit(1);
}
for (const entry of readdirSync(dist)) {
  cpSync(join(dist, entry), join(target, entry), { recursive: true });
}
console.log('✓ dist/ copied → ../moongrove');
console.log('  commit & push from the moongrove repo to publish');
