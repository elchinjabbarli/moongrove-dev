/**
 * Game-wide constants: art palettes, scoring, boosters, economy,
 * monetization products and difficulty pacing. Pure data — no DOM.
 */
import { BUNDLE_ID } from './version';

/* ---------- Board & tray ---------- */
export const LEVEL_COUNT = 1000;
export const CHAPTER_SIZE = 50;
export const GRID_COLS = 7;
export const GRID_ROWS = 10;
export const TRAY_SIZE = 7;
export const TRAY_SIZE_TUTORIAL = 8; // levels 1..TRAY_TUTORIAL_LEVELS
export const TRAY_TUTORIAL_LEVELS = 4;
export const BOUNTY_EVERY = 25; // every Nth level is a golden bounty level
export const BOUNTY_TILE_MULT = 1.3;
export const BOUNTY_DEW_MULT = 2.5;

/* ---------- Species (tile families) ---------- */
export interface SpeciesPalette {
  id: string;
  light: string;
  mid: string;
  deep: string;
  dark: string;
  glow: string;
  stem: string;
  petals: number;
  petalKind: 'round' | 'point' | 'slim' | 'ray';
}
export const SPECIES: SpeciesPalette[] = [
  { id: 'dewlily', light: '#8ff5e4', mid: '#2fd8c6', deep: '#0f8fa8', dark: '#072b3a', glow: '#b4fff2', stem: '#5fd8b0', petals: 5, petalKind: 'round' },
  { id: 'emberbud', light: '#ffd79a', mid: '#fb923c', deep: '#d9541f', dark: '#5c2408', glow: '#ffe3b0', stem: '#d8c25f', petals: 4, petalKind: 'point' },
  { id: 'moonveil', light: '#e8ccff', mid: '#a875f5', deep: '#7c3aed', dark: '#33195e', glow: '#f0d9ff', stem: '#9a8fe0', petals: 6, petalKind: 'slim' },
  { id: 'sunfrond', light: '#ffefa8', mid: '#ffd23f', deep: '#e59a12', dark: '#6b4506', glow: '#fff6c9', stem: '#d8d06f', petals: 8, petalKind: 'ray' },
];

/* ---------- Tiers (evolution stages) ---------- */
export const TIER_COUNT = 4;
export const TIER_PTS = [15, 30, 60, 120]; // points for merging a triple of that tier
export const BLOSSOM_PTS = 250; // harvesting 3 blooms
export const COMBO_WINDOW = 2.4; // seconds to keep the chain alive
export const COMBO_STEP = 0.4;
export const COMBO_MAX = 3.0;
export const STAR2_MULT = 1.05;
export const STAR3_MULT = 1.5;

/* ---------- Economy ---------- */
export const START_DEW = 250;
export const DEW_BASE = 20;
export const DEW_PER_STAR = 15;
export const DEW_PER_POINTS = 250; // 1 dew per 250 points
export const REVIVE_DEW = 150;
export const REWARDED_DEW = 40;
export interface BoosterDef { id: 'undo' | 'shuffle' | 'breeze'; cost: number; start: number; }
export const BOOSTERS: BoosterDef[] = [
  { id: 'undo', cost: 40, start: 3 },
  { id: 'shuffle', cost: 60, start: 2 },
  { id: 'breeze', cost: 80, start: 2 },
];

/* ---------- Ads (iOS build: fill IDs in src/config.ts, then rebuild) ---------- */
export const ADMOB_APP_ID = ''; // e.g. 'ca-app-pub-xxx~yyy'  (empty = ads disabled)
export const ADMOB_INTERSTITIAL_ID = '';
export const ADMOB_REWARDED_ID = '';
export const INTERSTITIAL_EVERY = 3; // after every Nth win
export const INTERSTITIAL_MIN_LEVEL = 6;
export const INTERSTITIAL_COOLDOWN = 90; // seconds

/* ---------- In-app purchases (App Store product ids) ---------- */
export interface ProductDef { id: string; kind: 'consumable' | 'nonconsumable'; dew: number; boosters?: number; price: string; }
export const PRODUCTS: ProductDef[] = [
  { id: `${BUNDLE_ID}.removeads`, kind: 'nonconsumable', dew: 0, price: '$2.99' },
  { id: `${BUNDLE_ID}.dew.small`, kind: 'consumable', dew: 500, price: '$0.99' },
  { id: `${BUNDLE_ID}.dew.medium`, kind: 'consumable', dew: 1500, price: '$2.99' },
  { id: `${BUNDLE_ID}.dew.large`, kind: 'consumable', dew: 5000, price: '$6.99' },
  { id: `${BUNDLE_ID}.bundle.gardener`, kind: 'consumable', dew: 2500, boosters: 10, price: '$4.99' },
];

/* ---------- Chapters (20 chapters × 50 levels) ---------- */
export const CHAPTERS_EN = [
  'Silverglade', 'Dewmeadow', 'Fernhollow', 'Glowfen', 'Emberwood',
  'Lumenmoss', 'Starthistle', 'Nightbriar', 'Crystalfen', 'Moonmarsh',
  'Gloomfern', 'Aurorvale', 'Wispgrove', 'Inkthorn', 'Dawnveil',
  'Opalfern', 'Cometree', 'Hollowroot', 'Eventide', 'Everbloom',
];
export const CHAPTERS_TR = [
  'Gümüşova', 'Çiğ Çayırı', 'Eğrelti Oyuğu', 'Işıltı Batağı', 'Kor Ormanı',
  'Ay Yosunu', 'Yıldırotu', 'Gece Dikeni', 'Kristal Çayır', 'Ayotu',
  'Karanlık Eğrelti', 'Şafak Vadisi', 'Fenerçiçek', 'Mürekkep Dikeni', 'Tan Perdesi',
  'Opal Eğreltisi', 'Kuyrukyıldız Ağacı', 'Oyukkök', 'Alacakaranlık', 'Sonsuzaçan',
];

/* Per-chapter background tint (top, bottom) for the night-garden gradient. */
export const CHAPTER_TINTS: [string, string][] = [
  ['#0d1330', '#1c1233'], ['#0a1530', '#122539'], ['#0c1428', '#152a2b'], ['#101136', '#1d1440'],
  ['#261226', '#3a1626'], ['#101a36', '#241a44'], ['#141733', '#22143a'], ['#0d1229', '#241527'],
  ['#0e1a38', '#16263e'], ['#0c1230', '#181f3b'], ['#0a1128', '#1a142f'], ['#131540', '#2a1848'],
  ['#0e1830', '#132335'], ['#150f24', '#28152c'], ['#131a2e', '#2a2140'], ['#121731', '#20364a'],
  ['#0f1434', '#1f1b44'], ['#0b0f26', '#181231'], ['#121436', '#20153a'], ['#160f38', '#2b1442'],
];
