/**
 * Procedural tile art. All 4 species × 4 evolution stages are drawn in code
 * on offscreen canvases (sprite cache) — sharp at any DPI, zero asset files,
 * and a fully ownable visual identity. Each species differs by silhouette
 * (petal count & shape), not just hue, so the board stays readable for
 * color-blind players too.
 */
import { SPECIES } from './config';
import type { SpeciesPalette } from './config';

export const SPRITE = 192; // sprite canvas size in px
const BASE = 158; // tile base side length (centered)
const R = 30; // corner radius of the base

type C2D = CanvasRenderingContext2D;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const f = Math.max(0, Math.min(1, k));
  return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function rr(ctx: C2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- organic shapes ---------- */
function glowOrb(ctx: C2D, x: number, y: number, r: number, inner: string, mid: string, glow: string): void {
  ctx.save();
  ctx.shadowColor = rgba(glow, 0.9);
  ctx.shadowBlur = r * 1.6;
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, inner);
  g.addColorStop(1, mid);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function leaf(ctx: C2D, x: number, y: number, len: number, wid: number, rot: number, light: string, mid: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createLinearGradient(0, -wid, 0, wid);
  g.addColorStop(0, light);
  g.addColorStop(1, mid);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
  ctx.fill();
  ctx.strokeStyle = rgba('#000000', 0.18);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.quadraticCurveTo(len * 0.5, 0, len - 4, 0);
  ctx.stroke();
  ctx.restore();
}

function stem(ctx: C2D, x: number, y0: number, y1: number, color: string, w = 6): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.quadraticCurveTo(x + 6, (y0 + y1) / 2, x, y1);
  ctx.stroke();
}

function petalPath(ctx: C2D, kind: string, len: number, wid: number): void {
  ctx.beginPath();
  if (kind === 'point') {
    ctx.moveTo(0, -wid * 0.35);
    ctx.quadraticCurveTo(wid * 0.7, -wid * 0.5, len, 0);
    ctx.quadraticCurveTo(wid * 0.7, wid * 0.5, 0, wid * 0.35);
    ctx.quadraticCurveTo(wid * 0.15, 0, 0, -wid * 0.35);
  } else if (kind === 'slim') {
    ctx.moveTo(0, -wid * 0.4);
    ctx.bezierCurveTo(wid * 0.7, -wid * 0.6, len * 0.92, -wid * 0.18, len, 0);
    ctx.bezierCurveTo(len * 0.92, wid * 0.18, wid * 0.7, wid * 0.6, 0, wid * 0.4);
    ctx.quadraticCurveTo(wid * 0.18, 0, 0, -wid * 0.4);
  } else if (kind === 'ray') {
    ctx.moveTo(0, -wid * 0.28);
    ctx.quadraticCurveTo(len * 0.55, -wid * 0.45, len, 0);
    ctx.quadraticCurveTo(len * 0.55, wid * 0.45, 0, wid * 0.28);
    ctx.quadraticCurveTo(wid * 0.22, 0, 0, -wid * 0.28);
  } else {
    // round
    ctx.moveTo(0, -wid * 0.5);
    ctx.bezierCurveTo(wid * 0.85, -wid * 0.62, len, -wid * 0.2, len, 0);
    ctx.bezierCurveTo(len, wid * 0.2, wid * 0.85, wid * 0.62, 0, wid * 0.5);
    ctx.bezierCurveTo(wid * 0.25, 0, wid * 0.25, 0, 0, -wid * 0.5);
  }
}

/* ---------- per-tier painters ---------- */
function paintSeed(ctx: C2D, cx: number, cy: number, s: SpeciesPalette): void {
  glowOrb(ctx, cx, cy + 4, 26 * 1, s.light, s.mid, s.glow);
  // tiny sprout tip
  ctx.strokeStyle = s.stem;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 16);
  ctx.quadraticCurveTo(cx + 8, cy - 30, cx + 2, cy - 36);
  ctx.stroke();
  leaf(ctx, cx + 2, cy - 33, 13, 6.5, -0.5, s.light, s.mid);
  // orbiting dew specks
  for (let i = 0; i < 3; i++) {
    const a = (Math.PI * 2 * i) / 3 + 0.6;
    const ox = cx + Math.cos(a) * 44;
    const oy = cy + Math.sin(a) * 40;
    ctx.fillStyle = rgba(s.glow, 0.85);
    ctx.beginPath();
    ctx.arc(ox, oy, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSprout(ctx: C2D, cx: number, cy: number, s: SpeciesPalette): void {
  stem(ctx, cx, cy + 46, cy - 2, s.stem, 6.5);
  leaf(ctx, cx - 2, cy + 12, 34, 15, Math.PI - 0.32, s.light, s.mid);
  leaf(ctx, cx + 2, cy + 24, 30, 13.5, 0.3, s.light, s.mid);
  leaf(ctx, cx - 1, cy - 2, 26, 11.5, Math.PI + 0.42, s.light, mix(s.mid, '#ffffff', 0.15));
  glowOrb(ctx, cx + 3, cy - 14, 9, s.light, s.mid, s.glow);
}

function paintBud(ctx: C2D, cx: number, cy: number, s: SpeciesPalette): void {
  stem(ctx, cx, cy + 50, cy + 16, s.stem, 7);
  // sepals
  ctx.fillStyle = mix(s.stem, s.deep, 0.35);
  for (const dx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 16);
    ctx.quadraticCurveTo(cx + dx * 22, cy + 14, cx + dx * 12, cy - 2);
    ctx.quadraticCurveTo(cx + dx * 4, cy + 6, cx, cy + 16);
    ctx.fill();
  }
  // closed bud (teardrop)
  ctx.save();
  ctx.shadowColor = rgba(s.glow, 0.55);
  ctx.shadowBlur = 22;
  const g = ctx.createLinearGradient(cx - 12, cy - 26, cx + 12, cy + 18);
  g.addColorStop(0, s.light);
  g.addColorStop(0.55, s.mid);
  g.addColorStop(1, s.deep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 34);
  ctx.bezierCurveTo(cx + 17, cy - 16, cx + 15, cy + 10, cx, cy + 18);
  ctx.bezierCurveTo(cx - 15, cy + 10, cx - 17, cy - 16, cx, cy - 34);
  ctx.fill();
  ctx.restore();
  // petal seams
  ctx.strokeStyle = rgba(s.deep, 0.5);
  ctx.lineWidth = 1.6;
  for (const dx of [-6, 6]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * 0.4, cy - 26);
    ctx.quadraticCurveTo(cx + dx, cy - 4, cx + dx * 0.35, cy + 14);
    ctx.stroke();
  }
  // highlight
  ctx.fillStyle = rgba('#ffffff', 0.35);
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy - 18, 3.6, 8, -0.35, 0, Math.PI * 2);
  ctx.fill();
}

function paintBloom(ctx: C2D, cx: number, cy: number, s: SpeciesPalette): void {
  const n = s.petals;
  const kind = s.petalKind;
  const len = kind === 'ray' ? 50 : kind === 'slim' ? 48 : 44;
  const wid = kind === 'ray' ? 13 : kind === 'slim' ? 13 : kind === 'point' ? 20 : 22;
  ctx.save();
  ctx.shadowColor = rgba(s.glow, 0.8);
  ctx.shadowBlur = 26;
  for (let i = 0; i < n; i++) {
    const rot = (Math.PI * 2 * i) / n + (kind === 'ray' ? 0 : 0.35);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, mix(s.mid, s.light, 0.35));
    g.addColorStop(0.75, s.light);
    g.addColorStop(1, mix(s.light, '#ffffff', 0.5));
    ctx.fillStyle = g;
    petalPath(ctx, kind, len, wid);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // stamen ring
  ctx.strokeStyle = rgba(s.deep, 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    ctx.fillStyle = s.light;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  glowOrb(ctx, cx, cy, 12, mix(s.light, '#ffffff', 0.6), s.mid, s.glow);
}

/* ---------- sprite factory ---------- */
const cache = new Map<string, HTMLCanvasElement>();

export function getTile(species: number, tier: number): HTMLCanvasElement {
  const key = `${species}:${tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = SPRITE;
  cv.height = SPRITE;
  const ctx = cv.getContext('2d')!;
  const s = SPECIES[Math.max(0, Math.min(SPECIES.length - 1, species))];
  const cx = SPRITE / 2;
  const cy = SPRITE / 2;

  // drop shadow beneath the base
  ctx.save();
  ctx.shadowColor = 'rgba(2,6,16,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  const bg = ctx.createLinearGradient(0, (SPRITE - BASE) / 2, 0, (SPRITE + BASE) / 2);
  bg.addColorStop(0, mix(s.deep, s.dark, 0.35));
  bg.addColorStop(1, s.dark);
  ctx.fillStyle = bg;
  rr(ctx, (SPRITE - BASE) / 2, (SPRITE - BASE) / 2, BASE, BASE, R);
  ctx.fill();
  ctx.restore();

  // rim light + top gloss
  ctx.save();
  rr(ctx, (SPRITE - BASE) / 2, (SPRITE - BASE) / 2, BASE, BASE, R);
  ctx.strokeStyle = rgba(s.light, 0.4);
  ctx.lineWidth = 2;
  ctx.stroke();
  const gloss = ctx.createLinearGradient(0, (SPRITE - BASE) / 2, 0, (SPRITE - BASE) / 2 + BASE * 0.45);
  gloss.addColorStop(0, 'rgba(255,255,255,0.14)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  rr(ctx, (SPRITE - BASE) / 2 + 2, (SPRITE - BASE) / 2 + 2, BASE - 4, BASE * 0.45, R - 4);
  ctx.fill();
  ctx.restore();

  // organism
  const cy2 = cy + (tier === 0 || tier === 3 ? 0 : 4);
  if (tier === 0) paintSeed(ctx, cx, cy2, s);
  else if (tier === 1) paintSprout(ctx, cx, cy2, s);
  else if (tier === 2) paintBud(ctx, cx, cy2, s);
  else paintBloom(ctx, cx, cy2, s);

  cache.set(key, cv);
  return cv;
}

/** Small solid circle avatar of a species (map + goal chips). */
export function speciesDot(species: number): string {
  return SPECIES[Math.max(0, Math.min(3, species))].mid;
}
