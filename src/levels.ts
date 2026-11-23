/**
 * Procedural level generator: all 1000 levels are derived from the level
 * number alone (seeded RNG), so every device plays the identical board.
 *
 * Solvability is guaranteed by construction: the board is a "merge forest".
 * For every harvest we emit a group of three Blooms; each group is either
 * placed directly on the board or expanded into three groups of the tier
 * below (3 Sprouts merge into 1 Bud, …). The multiset of tiles therefore
 * always partitions completely into merge triples — a full clear is always
 * possible with good play.
 */
import { Rng } from './rng';
import {
  BOUNTY_EVERY, BOUNTY_TILE_MULT, CHAPTER_SIZE, GRID_COLS, GRID_ROWS,
  LEVEL_COUNT, SPECIES, TIER_COUNT, TIER_PTS, BLOSSOM_PTS,
  TRAY_SIZE, TRAY_SIZE_TUTORIAL, TRAY_TUTORIAL_LEVELS,
} from './config';
import type { LevelSpec, TileSpec } from './types';

/* ---------- Board shape masks (u,v ∈ [-1,1]) ---------- */
type MaskFn = (u: number, v: number) => boolean;

function hexInside(u: number, v: number, r: number): boolean {
  const x = Math.hypot(u, v);
  if (x === 0) return true;
  const th = Math.atan2(v, u);
  const sec = Math.PI / 3;
  const m = (((th % sec) + sec) % sec) - sec / 2;
  return x * Math.cos(m) <= r;
}

const MASKS: Record<string, MaskFn> = {
  orb: (u, v) => u * u + (v * 1.04) ** 2 <= 0.78,
  flower: (u, v) => {
    const r = Math.hypot(u, v * 1.02);
    const th = Math.atan2(v, u);
    return r <= 0.4 + 0.52 * Math.pow(Math.abs(Math.cos(2 * th)), 1.25);
  },
  diamond: (u, v) => Math.abs(u) + Math.abs(v) <= 1.0,
  hex: (u, v) => hexInside(u, v, 0.88),
  heart: (u, v) => {
    const X = u * 1.06;
    const Y = -v * 1.0;
    const inL = (X + 0.32) ** 2 + (Y - 0.26) ** 2 <= 0.4 ** 2;
    const inR = (X - 0.32) ** 2 + (Y - 0.26) ** 2 <= 0.4 ** 2;
    const inT = Y <= 0.06 && Y >= -0.7 && Math.abs(X) <= 0.55 * ((Y + 0.7) / 0.76);
    return inL || inR || inT;
  },
  butterfly: (u, v) => {
    const X = u * 0.94;
    const Y = -v * 1.0;
    const el = (cx: number, cy: number, rx: number, ry: number, rot: number) => {
      const dx = X - cx;
      const dy = Y - cy;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      return (lx / rx) ** 2 + (ly / ry) ** 2 <= 1;
    };
    return (
      el(-0.46, 0.22, 0.46, 0.54, 0.32) || el(0.46, 0.22, 0.46, 0.54, -0.32) ||
      el(-0.4, -0.34, 0.36, 0.42, -0.24) || el(0.4, -0.34, 0.36, 0.42, 0.24) ||
      (Math.abs(X) <= 0.12 && Y >= -0.62 && Y <= 0.56)
    );
  },
};

const MASK_ORDER = ['orb', 'flower', 'hex', 'diamond', 'butterfly', 'heart'];

export function maskCells(mask: string): { c: number; r: number; u: number; v: number }[] {
  const fn = MASKS[mask] || MASKS.orb;
  const cells: { c: number; r: number; u: number; v: number }[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const u = (c - (GRID_COLS - 1) / 2) / ((GRID_COLS - 1) / 2);
      const v = (r - (GRID_ROWS - 1) / 2) / ((GRID_ROWS - 1) / 2);
      if (fn(u, v)) cells.push({ c, r, u, v });
    }
  }
  return cells;
}

/* ---------- Difficulty pacing ---------- */
function difficulty(n: number): { species: number; blossoms: number; targetTiles: number; p: [number, number, number] } {
  const species = n < 10 ? 1 : n < 40 ? 2 : n < 150 ? 3 : SPECIES.length;
  const bBase = n < 10 ? 1 : n < 40 ? 2 : n < 100 ? 3 : n < 250 ? 4 : n < 600 ? 5 : 6;
  const bounty = n % BOUNTY_EVERY === 0;
  const blossoms = bBase + (n > 60 && n % 3 === 0 ? 1 : 0);
  const grow = Math.pow(n / LEVEL_COUNT, 0.85);
  const targetTiles = Math.round((18 + 92 * grow) * (bounty ? BOUNTY_TILE_MULT : 1));
  // base expansion probabilities per tier boundary (bloom→bud, bud→sprout, sprout→seed)
  const p: [number, number, number] = [
    0.4 + 0.22 * grow, // tier 3 expands
    0.42 + 0.2 * grow, // tier 2
    0.38 + 0.18 * grow, // tier 1
  ];
  return { species, blossoms, targetTiles, p };
}

/* ---------- Generator ---------- */
function emitTiles(rng: Rng, species: number, blossoms: number, p: [number, number, number], forceTop: boolean) {
  const tiles: TileSpec[] = [];
  let par = 0;
  // p holds the expansion probability per tier boundary (bloom→bud, bud→sprout, sprout→seed).
  const emitGroup = (tier: number, ps: [number, number, number]) => {
    const expand = tier > 0 && (tier === TIER_COUNT - 1 ? forceTop || rng.chance(ps[tier - 1]) : rng.chance(ps[tier - 1]));
    if (expand) {
      emitGroup(tier - 1, ps);
      emitGroup(tier - 1, ps);
      emitGroup(tier - 1, ps);
    } else {
      for (let i = 0; i < 3; i++) tiles.push({ species, tier });
      par += tier === TIER_COUNT - 1 ? BLOSSOM_PTS : TIER_PTS[tier];
    }
  };
  for (let h = 0; h < blossoms; h++) emitGroup(TIER_COUNT - 1, p);
  return { tiles, par };
}

/** Expected placed tiles per blossom group for a tier-probability triplet. */
function expectedLeaves(p: [number, number, number], forceTop: boolean): number {
  const e0 = 3;
  const e1 = 3 * (1 - p[0]) + 3 * p[0] * e0;
  const e2 = 3 * (1 - p[1]) + 3 * p[1] * e1;
  return forceTop ? 3 * e2 : 3 * (1 - p[2]) + 3 * p[2] * e2;
}

/** Solve the tier-probability scale that hits the target tile count. */
function solveScale(base: [number, number, number], perGroup: number, forceTop: boolean): number {
  let lo = 0.15;
  let hi = 2.4;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    const p: [number, number, number] = [clampP(base[0] * mid), clampP(base[1] * mid), clampP(base[2] * mid)];
    if (expectedLeaves(p, forceTop) < perGroup) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function clampP(p: number): number {
  return Math.max(0.04, Math.min(0.86, p));
}

/**
 * Exact forest template for small blossom counts (B ≤ 2), where random
 * expansion variance would be too high. Solves the merge-forest equations
 * T_t + M_(t-1) = 3·M_t for tier counts close to the tile target.
 */
function forestTemplate(blossoms: number, target: number, rng: Rng): { counts: number[]; par: number } | null {
  if (blossoms > 2) return null;
  let best: number[] | null = null;
  let bestPar = 0;
  let bestScore = Infinity;
  for (let t0 = 0; t0 <= 30; t0 += 3) {
    const m0 = t0 / 3;
    for (let t1 = 0; t1 <= 12; t1++) {
      if ((t1 + m0) % 3 !== 0) continue;
      const m1 = (t1 + m0) / 3;
      for (let t2 = 0; t2 <= 12; t2++) {
        if ((t2 + m1) % 3 !== 0) continue;
        const m2 = (t2 + m1) / 3;
        const t3 = 3 * blossoms - m2;
        if (t3 < 0 || t3 > 9) continue;
        const total = t0 + t1 + t2 + t3;
        const variety = (t0 > 0 ? 0 : 5) + (t1 > 0 ? 0 : 5) + (t2 > 0 ? 0 : 5);
        const score = Math.abs(total - target) * 3 + variety + rng.next() * 6;
        if (score < bestScore) {
          bestScore = score;
          best = [t0, t1, t2, t3];
          bestPar = m0 * TIER_PTS[0] + m1 * TIER_PTS[1] + m2 * TIER_PTS[2] + blossoms * BLOSSOM_PTS;
        }
      }
    }
  }
  return best ? { counts: best, par: bestPar } : null;
}

const MIN_TILES = 14;
const MAX_TILES = 150;

export function generateLevel(n: number): LevelSpec {
  const num = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(n)));
  const rng = new Rng((Math.imul(num, 2654435761) + 0x5eed) >>> 0);
  const base = difficulty(num);
  const { species, blossoms, targetTiles } = base;
  const bounty = num % BOUNTY_EVERY === 0;

  const perSpecies = new Array(species).fill(0);
  for (let i = 0; i < blossoms; i++) perSpecies[i % species]++;

  let tiles: TileSpec[] = [];
  let par = 0;
  let small = false;
  for (let s = 0; s < species; s++) {
    const b = perSpecies[s];
    const subTarget = Math.max(MIN_TILES, Math.round(targetTiles / species));
    const tpl = forestTemplate(b, subTarget, rng);
    if (tpl) {
      for (let tier = 0; tier < TIER_COUNT; tier++) {
        for (let i = 0; i < tpl.counts[tier]; i++) tiles.push({ species: s, tier });
      }
      par += tpl.par;
    } else {
      small = true;
      break;
    }
  }

  if (small) {
    // stochastic path for B ≥ 3 per species: force the top tier to expand so
    // a level can never collapse into a handful of tiles
    const forceTop = true;
    const perGroup = targetTiles / blossoms;
    let scale = solveScale(base.p, perGroup, forceTop);
    let bestTiles: TileSpec[] | null = null;
    let bestPar = 0;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 6; attempt++) {
      const p: [number, number, number] = [clampP(base.p[0] * scale), clampP(base.p[1] * scale), clampP(base.p[2] * scale)];
      tiles = [];
      par = 0;
      for (let s = 0; s < species; s++) {
        const out = emitTiles(rng, s, perSpecies[s], p, forceTop);
        tiles = tiles.concat(out.tiles);
        par += out.par;
      }
      const score = Math.abs(tiles.length - targetTiles);
      if (tiles.length >= MIN_TILES && tiles.length <= MAX_TILES && score < bestScore) {
        bestScore = score;
        bestTiles = tiles;
        bestPar = par;
      }
      if (tiles.length < targetTiles * 0.6) scale *= 1.22;
      else if (tiles.length > targetTiles * 1.5) scale *= 0.82;
      else break;
    }
    if (bestTiles) {
      tiles = bestTiles;
      par = bestPar;
    }
  }

  const shuffled = rng.shuffle(tiles);
  const mask = MASK_ORDER[(Math.floor((num - 1) / CHAPTER_SIZE) * 3 + (num % 5)) % MASK_ORDER.length];
  const usable = maskCells(mask).length;
  const layers = Math.max(1, Math.min(8, Math.ceil(shuffled.length / (Math.max(usable, 20) * 0.55))));

  const traySize = num <= TRAY_TUTORIAL_LEVELS ? TRAY_SIZE_TUTORIAL : TRAY_SIZE;

  return {
    number: num,
    chapter: Math.floor((num - 1) / CHAPTER_SIZE),
    bounty,
    mask,
    layers,
    traySize,
    tiles: shuffled,
    parScore: par,
    blossoms,
    speciesCount: species,
  };
}

/** Dev check: simulate merges to prove a level always fully clears. */
export function simulateClear(level: LevelSpec): boolean {
  const counts = new Map<string, number>();
  for (const tl of level.tiles) counts.set(`${tl.species}:${tl.tier}`, (counts.get(`${tl.species}:${tl.tier}`) || 0) + 1);
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of Array.from(counts.keys())) {
      const c = counts.get(k)!;
      if (c >= 3) {
        counts.set(k, c - 3);
        if (k.endsWith(':3')) {
          // three blooms blossom out of existence
        } else {
          const nk = `${k.split(':')[0]}:${Number(k.split(':')[1]) + 1}`;
          counts.set(nk, (counts.get(nk) || 0) + 1);
        }
        changed = true;
      }
    }
  }
  let remaining = 0;
  counts.forEach((c) => (remaining += c));
  return remaining === 0;
}

/** Level layout: positions per layer for a given canvas geometry. */
export interface PlacedSpec { spec: TileSpec; cell: number; layer: number; jx: number; jy: number }

export function layoutLevel(level: LevelSpec, rng: Rng): PlacedSpec[] {
  const cells = maskCells(level.mask);
  const out: PlacedSpec[] = [];
  const perLayer = Math.ceil(level.tiles.length / level.layers);
  let idx = 0;
  for (let z = 0; z < level.layers && idx < level.tiles.length; z++) {
    const count = Math.min(perLayer, level.tiles.length - idx);
    const shuffled = rng.shuffle(cells.slice()).slice(0, Math.min(count, cells.length));
    for (let i = 0; i < count; i++) {
      const cell = shuffled[i % shuffled.length];
      out.push({
        spec: level.tiles[idx++],
        cell: cell.c + cell.r * GRID_COLS,
        layer: z,
        jx: (rng.next() - 0.5) * 0.62,
        jy: (rng.next() - 0.5) * 0.62,
      });
    }
  }
  // any overflow (mask smaller than expected) goes on top of the last layer
  while (idx < level.tiles.length) {
    const cell = rng.pick(cells);
    out.push({ spec: level.tiles[idx++], cell: cell.c + cell.r * GRID_COLS, layer: level.layers, jx: (rng.next() - 0.5) * 0.62, jy: (rng.next() - 0.5) * 0.62 });
  }
  return out;
}
