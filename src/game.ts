/**
 * The play screen controller: taps, tray, auto-merges, evolution cascades,
 * blossoms, scoring, combos, boosters, revive, win/fail detection.
 *
 * Tray logic is fully synchronous (animations are visual only), so the game
 * state is always consistent and rapid tapping is safe.
 */
import {
  BLOSSOM_PTS, BOUNTY_DEW_MULT, COMBO_MAX, COMBO_STEP, COMBO_WINDOW,
  DEW_BASE, DEW_PER_POINTS, DEW_PER_STAR, SPECIES, STAR2_MULT, STAR3_MULT,
  TIER_PTS,
} from './config';
import { Board } from './board';
import { Rng } from './rng';
import { getTile, rgba } from './art';
import { audio, haptic } from './audio';
import { FX } from './fx';
import type { LevelSpec, PlacedTile, TileSpec, TrayItem } from './types';

export interface WinResult { stars: number; score: number; dew: number; bounty: boolean; }

interface Snapshot {
  traySpecs: { spec: TileSpec; slot: number }[];
  removed: PlacedTile;
  score: number;
  chain: number;
  lastMergeAt: number;
  blossomsDone: number;
}

export type GameEvent =
  | 'tapFirst' | 'firstMerge' | 'firstSpawn' | 'firstBlossom' | 'trayWarn' | 'trayReject'
  | 'boost.empty' | 'boost.undo' | 'boost.shuffle' | 'boost.breeze' | 'boost.breezePick';

const FLY_DUR = 0.26;
const CONVERGE_DUR = 0.2;

export class GameScreen {
  level: LevelSpec | null = null;
  board = new Board();
  tray: TrayItem[] = [];
  fx = new FX();
  state: 'playing' | 'win' | 'fail' | 'paused' = 'playing';
  score = 0;
  blossomsDone = 0;
  totalTiles = 0;
  chain = 0;
  lastMergeAt = -10;
  time = 0;
  revived = false;
  awaitingBreeze = false;
  hudDirty = true;
  onWin: ((r: WinResult) => void) | null = null;
  onFail: ((canRevive: boolean) => void) | null = null;
  onEvent: ((e: GameEvent) => void) | null = null;
  boosterCount: (id: string) => number = () => 0;
  consumeBooster: (id: string) => void = () => undefined;

  private undoStack: Snapshot[] = [];
  private rng = new Rng(1);
  private W = 390;
  private H = 700;
  private trayY = 600;
  private slotW = 50;
  private firstTap = false;

  start(level: LevelSpec): void {
    this.level = level;
    this.rng = new Rng(((Date.now() & 0x7fffffff) ^ (level.number * 7919)) >>> 0);
    this.board.setLevel(level, this.rng);
    this.board.tiles.forEach((t) => {
      t.popT = -(t.z * 0.05 + Math.random() * 0.08);
    });
    this.tray = [];
    this.undoStack = [];
    this.fx.clear();
    this.score = 0;
    this.blossomsDone = 0;
    this.totalTiles = level.tiles.length;
    this.chain = 0;
    this.lastMergeAt = -10;
    this.revived = false;
    this.awaitingBreeze = false;
    this.firstTap = false;
    this.state = 'playing';
    this.hudDirty = true;
    this.layout();
  }

  resize(w: number, h: number, hudH: number, boosterH: number): void {
    this.W = w;
    this.H = h;
    const trayH = 104;
    this.trayY = h - boosterH - trayH;
    this.slotW = Math.min(54, (w - 24) / Math.max(7, this.level?.traySize || 7));
    this.layout();
  }

  private layout(): void {
    if (!this.level) return;
    const top = (this.H * 0.0) + 118; // below HUD
    const bottom = this.trayY - 14;
    const pad = 8;
    this.board.resize(pad, top, this.W - pad * 2, Math.max(120, bottom - top));
  }

  private slotX(i: number): number {
    const n = this.level?.traySize || 7;
    const total = this.slotW * n;
    const x0 = (this.W - total) / 2 + this.slotW / 2;
    return x0 + i * this.slotW;
  }

  /* ---------- input ---------- */
  pointerDown(px: number, py: number): void {
    if (this.state !== 'playing') return;
    if (py >= this.trayY - 12) {
      if (this.awaitingBreeze) this.tryBreeze(px);
      return;
    }
    const tile = this.board.hitTest(px, py);
    if (tile) this.tapTile(tile);
  }

  tapTile(tile: PlacedTile): void {
    if (this.state !== 'playing' || tile.blocked) return;
    const n = this.tray.length;
    const limit = this.level?.traySize || 7;
    const cnt = this.countSpec(tile.spec);
    if (n >= limit && cnt < 2) {
      // tray is full: a completing tile still may enter; otherwise this is
      // a dead end unless a booster can free the tray
      const freeable = this.board.tiles.some((t) => !t.blocked && this.countSpec(t.spec) >= 2);
      if (!freeable) {
        this.fail();
        return;
      }
      this.fx.shake(6, 0.3);
      audio.warn();
      this.onEvent?.('trayReject');
      return;
    }
    this.pushUndo(tile);
    this.board.remove(tile);
    this.lastSpec = tile.spec;
    const slot = this.firstFreeSlot();
    this.tray.push({
      id: tile.id,
      spec: tile.spec,
      slot,
      x: tile.cx,
      y: tile.cy,
      mode: 'fly',
      t: 0,
      fromX: tile.cx,
      fromY: tile.cy,
    });
    audio.tap(tile.spec.tier, tile.spec.species);
    haptic(8);
    if (!this.firstTap) {
      this.firstTap = true;
      this.onEvent?.('tapFirst');
    }
    this.hudDirty = true;
  }

  private countSpec(spec: TileSpec): number {
    let c = 0;
    for (const it of this.tray) if (it.spec.species === spec.species && it.spec.tier === spec.tier) c++;
    return c;
  }

  private firstFreeSlot(): number {
    const used = new Set(this.tray.map((i) => i.slot));
    const n = this.level?.traySize || 7;
    for (let i = 0; i < n; i++) if (!used.has(i)) return i;
    // tray already full — only a completing triple may enter: park it on a
    // matching partner slot so it visually joins its pair before merging.
    const partner = this.tray.find((i) => i.spec.species === this.lastSpec?.species && i.spec.tier === this.lastSpec?.tier);
    return partner ? partner.slot : 0;
  }

  private lastSpec: TileSpec | null = null;

  /* ---------- merge resolution ---------- */
  private findTriple(): TrayItem[] | null {
    const map = new Map<string, TrayItem[]>();
    for (const it of this.tray) {
      const k = `${it.spec.species}:${it.spec.tier}`;
      const arr = map.get(k) || [];
      arr.push(it);
      map.set(k, arr);
    }
    let best: TrayItem[] | null = null;
    for (const arr of map.values()) {
      if (arr.length >= 3 && (!best || arr[0].id < best[0].id)) best = arr;
    }
    return best ? best.slice(0, 3) : null;
  }

  private resolve(): void {
    const triple = this.findTriple();
    if (!triple) {
      this.checkEnd();
      return;
    }
    const { species, tier } = triple[0].spec;
    const now = this.time;
    if (now - this.lastMergeAt <= COMBO_WINDOW) this.chain++;
    else this.chain = 1;
    this.lastMergeAt = now;
    const mult = Math.min(COMBO_MAX, 1 + COMBO_STEP * (this.chain - 1));
    const pts = Math.round(TIER_PTS[tier] * mult);
    this.score += pts;

    const sx = (triple[0].x + triple[1].x + triple[2].x) / 3;
    const sy = this.trayY + 34;
    for (const it of triple) {
      it.mode = 'converge';
      it.t = 0;
      (it as TrayItem & { tx?: number }).tx = sx;
    }
    // remove from the logical tray right away; visuals fade out via a ghost list
    for (const it of triple) this.tray.splice(this.tray.indexOf(it), 1);
    this.ghosts.push({ items: triple, x: sx, y: sy, t: 0, spec: triple[0].spec });

    audio.merge(tier, species);
    haptic(12);
    this.fx.petalBurst(sx, sy, species, 8, 0.8);
    this.fx.popup(sx, sy - 26, `+${pts}`, SPECIES[species].light);
    if (this.chain >= 2) {
      audio.combo(this.chain);
      this.fx.popup(this.W / 2, this.trayY - 18, `×${mult.toFixed(1)}`, '#ffe9a3', true);
    }

    if (tier < 3) {
      // evolve into the next stage
      const slot = this.firstFreeSlot();
      const evolved: TrayItem = {
        id: 1e9 + Math.floor(Math.random() * 1e6),
        spec: { species, tier: tier + 1 },
        slot,
        x: sx,
        y: sy,
        mode: 'spawn',
        t: -CONVERGE_DUR,
        fromX: sx,
        fromY: sy,
      };
      this.tray.push(evolved);
      this.onEvent?.('firstMerge');
    } else {
      // three blooms blossom: big score, goal progress
      const bpts = Math.round(BLOSSOM_PTS * mult);
      this.score += bpts;
      this.blossomsDone++;
      audio.blossom();
      haptic([12, 40, 24]);
      this.fx.bloomRing(sx, sy, SPECIES[species].glow, 110);
      this.fx.petalBurst(sx, sy, species, 22, 1.6);
      this.fx.sparkBurst(sx, sy, SPECIES[species].glow, 14, 1.4);
      this.fx.flash(SPECIES[species].glow.replace('#', ''), 0.14);
      this.fx.popup(this.W / 2, this.trayY - 60, `+${bpts}`, SPECIES[species].light, true);
      this.onEvent?.('firstBlossom');
    }
    this.reassignSlots();
    this.hudDirty = true;
    // cascades: merged output may complete another triple
    setTimeout(() => {
      if (this.state === 'playing') this.resolve();
    }, 260);
  }

  private ghosts: { items: TrayItem[]; x: number; y: number; t: number; spec: TileSpec }[] = [];

  private reassignSlots(): void {
    const order = this.tray.slice().sort((a, b) => a.slot - b.slot);
    order.forEach((it, i) => (it.slot = i));
  }

  private checkEnd(): void {
    if (this.state !== 'playing') return;
    if (this.board.tiles.length === 0 && this.tray.length === 0) {
      this.win();
      return;
    }
    const limit = this.level?.traySize || 7;
    if (this.tray.length >= limit) {
      const freeable = this.board.tiles.some((t) => !t.blocked && this.countSpec(t.spec) >= 2);
      if (!freeable) this.fail();
    }
    if (this.tray.length === limit - 1) this.onEvent?.('trayWarn');
  }

  private win(): void {
    this.state = 'win';
    const par = this.level?.parScore || 1;
    let stars = 1;
    if (this.score >= par * STAR2_MULT) stars = 2;
    if (this.score >= par * STAR3_MULT) stars = 3;
    let dew = DEW_BASE + stars * DEW_PER_STAR + Math.floor(this.score / DEW_PER_POINTS);
    if (this.level?.bounty) dew = Math.round(dew * BOUNTY_DEW_MULT);
    audio.win();
    haptic([10, 60, 10, 60, 30]);
    for (let s = 0; s < 4; s++) this.fx.petalRain(s, this.W);
    this.fx.flash('255,240,200', 0.2);
    this.hudDirty = true;
    this.onWin?.({ stars, score: this.score, dew, bounty: !!this.level?.bounty });
  }

  private fail(): void {
    this.state = 'fail';
    audio.fail();
    haptic([30, 80, 30]);
    this.fx.shake(7, 0.4);
    this.onFail?.(!this.revived);
  }

  revive(): void {
    if (this.state !== 'fail' || this.revived || this.tray.length < 3) return;
    this.revived = true;
    const n = Math.min(3, this.tray.length);
    for (let i = 0; i < n; i++) {
      const it = this.tray.shift()!;
      const tile = this.board.addBack(it.spec, this.rng);
      this.fx.petalBurst(tile.cx, tile.cy, it.spec.species, 6, 0.7);
    }
    this.state = 'playing';
    this.hudDirty = true;
    audio.booster();
  }

  /* ---------- boosters ---------- */
  useBooster(id: string): boolean {
    if (this.state !== 'playing') return false;
    if (this.boosterCount(id) <= 0) {
      this.onEvent?.('boost.empty');
      return false;
    }
    if (id === 'undo') return this.undo();
    if (id === 'shuffle') return this.shuffle();
    if (id === 'breeze') {
      this.awaitingBreeze = !this.awaitingBreeze;
      if (this.awaitingBreeze) this.onEvent?.('boost.breezePick');
      return true; // consumed when a tile is actually blown back
    }
    return false;
  }

  private tryBreeze(px: number): void {
    const hit = this.tray.find((it) => Math.abs(px - this.slotX(it.slot)) < this.slotW * 0.55);
    if (!hit) return;
    if (this.boosterCount('breeze') <= 0) {
      this.onEvent?.('boost.empty');
      this.awaitingBreeze = false;
      return;
    }
    this.consumeBooster('breeze');
    this.tray.splice(this.tray.indexOf(hit), 1);
    const tile = this.board.addBack(hit.spec, this.rng);
    this.reassignSlots();
    this.awaitingBreeze = false;
    audio.booster();
    haptic([8, 30, 8]);
    this.fx.petalBurst(tile.cx, tile.cy, hit.spec.species, 10, 1);
    this.onEvent?.('boost.breeze');
    this.hudDirty = true;
    this.checkEnd();
  }

  private pushUndo(removed: PlacedTile): void {
    if (this.undoStack.length >= 12) this.undoStack.shift();
    this.undoStack.push({
      traySpecs: this.tray.map((i) => ({ spec: { ...i.spec }, slot: i.slot })),
      removed,
      score: this.score,
      chain: this.chain,
      lastMergeAt: this.lastMergeAt,
      blossomsDone: this.blossomsDone,
    });
  }

  private undo(): boolean {
    const snap = this.undoStack.pop();
    if (!snap) {
      this.onEvent?.('boost.empty');
      return false;
    }
    this.board.restore(snap.removed);
    this.tray = snap.traySpecs.map((s) => ({
      id: Math.floor(Math.random() * 1e6),
      spec: s.spec,
      slot: s.slot,
      x: this.slotX(s.slot),
      y: this.trayY + 34,
      mode: 'spawn' as const,
      t: 0,
      fromX: this.slotX(s.slot),
      fromY: this.trayY + 34,
    }));
    this.score = snap.score;
    this.chain = snap.chain;
    this.lastMergeAt = snap.lastMergeAt;
    this.blossomsDone = snap.blossomsDone;
    this.reassignSlots();
    this.consumeBooster('undo');
    audio.booster();
    this.onEvent?.('boost.undo');
    this.hudDirty = true;
    return true;
  }

  private shuffle(): boolean {
    if (this.board.tiles.length === 0) return false;
    this.board.shuffleIdentities(this.rng);
    this.board.tiles.forEach((t) => (t.popT = 0.18 + Math.random() * 0.1));
    this.consumeBooster('shuffle');
    audio.booster();
    haptic([10, 20, 10]);
    this.fx.shake(4, 0.25);
    this.onEvent?.('boost.shuffle');
    return true;
  }

  /* ---------- frame loop ---------- */
  update(dt: number): void {
    this.time += dt;
    this.fx.update(dt);
    for (const t of this.board.tiles) if (t.popT !== 0) t.popT += dt;
    for (let i = this.tray.length - 1; i >= 0; i--) {
      const it = this.tray[i];
      it.t += dt;
      const tx = this.slotX(it.slot);
      const ty = this.trayY + 34;
      if (it.mode === 'fly') {
        if (it.t >= FLY_DUR) {
          it.mode = 'idle';
          it.x = tx;
          it.y = ty;
          this.resolve();
        } else {
          const k = it.t / FLY_DUR;
          const e = 1 - (1 - k) * (1 - k);
          it.x = it.fromX + (tx - it.fromX) * e;
          const arc = Math.sin(Math.PI * k) * 46;
          it.y = it.fromY + (ty - it.fromY) * e - arc * (1 - k * 0.4);
        }
      } else if (it.mode === 'spawn') {
        if (it.t > 0) {
          const k = Math.min(1, it.t / 0.2);
          it.x = tx;
          it.y = ty;
          if (k >= 1) it.mode = 'idle';
        }
      } else {
        it.x += (tx - it.x) * Math.min(1, dt * 14);
        it.y += (ty - it.y) * Math.min(1, dt * 14);
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.t += dt;
      if (g.t > CONVERGE_DUR) this.ghosts.splice(i, 1);
    }
    // safety reconcile: cascades scheduled while paused must not stall
    this.reconcile -= dt;
    if (this.reconcile <= 0) {
      this.reconcile = 0.6;
      if (this.state === 'playing' && !this.tray.some((i) => i.mode === 'fly') && this.findTriple()) {
        this.resolve();
      }
    }
  }

  private reconcile = 0.6;

  /* ---------- render ---------- */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.level) return;
    const sh = this.fx.shakeOffset();
    ctx.save();
    ctx.translate(sh.x, sh.y);

    // board tiles
    const sorted = this.board.tiles.slice().sort((a, b) => a.z - b.z || a.id - b.id);
    for (const t of sorted) {
      let scale = 1;
      if (t.popT !== 0) {
        if (t.popT < 0) continue;
        scale = easeOutBack(Math.min(1, t.popT / 0.22));
      }
      const s = this.board.drawSize * scale;
      const spr = getTile(t.spec.species, t.spec.tier);
      ctx.drawImage(spr, t.cx - s / 2, t.cy - s / 2, s, s);
      if (t.blocked) {
        ctx.fillStyle = 'rgba(4,8,22,0.52)';
        roundRect(ctx, t.cx - s / 2, t.cy - s / 2, s, s, s * 0.19);
        ctx.fill();
      }
    }

    // tray wells
    const n = this.level.traySize;
    const warn = this.tray.length >= n - 1 && this.state === 'playing';
    for (let i = 0; i < n; i++) {
      const x = this.slotX(i) - this.slotW / 2 + 3;
      const y = this.trayY + 6;
      const w = this.slotW - 6;
      const h = 58;
      ctx.fillStyle = warn ? `rgba(255,120,120,${0.1 + 0.08 * Math.sin(this.time * 6)})` : 'rgba(255,255,255,0.055)';
      roundRect(ctx, x, y, w, h, 12);
      ctx.fill();
      ctx.strokeStyle = warn ? 'rgba(255,150,150,0.4)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // merging ghosts (converging trio)
    for (const g of this.ghosts) {
      const k = Math.min(1, g.t / CONVERGE_DUR);
      for (const it of g.items) {
        const cx = it.x + (g.x - it.x) * k;
        const cy = it.y + (g.y - it.y) * k;
        const s = this.slotW * 0.86 * (1 - k * 0.5);
        ctx.globalAlpha = 1 - k * 0.7;
        ctx.drawImage(getTile(g.spec.species, g.spec.tier), cx - s / 2, cy - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
      if (k > 0.55) {
        const kk = (k - 0.55) / 0.45;
        const r = 26 + kk * 26;
        ctx.globalAlpha = 1 - kk;
        ctx.fillStyle = rgba(SPECIES[g.spec.species].glow, 0.55 * (1 - kk));
        ctx.beginPath();
        ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // tray items
    for (const it of this.tray) {
      let s = this.slotW * 0.86;
      if (it.mode === 'fly') {
        const k = Math.min(1, it.t / FLY_DUR);
        s = this.board.drawSize * (1 - k) + this.slotW * 0.86 * k;
      } else if (it.mode === 'spawn') {
        if (it.t < 0) continue;
        const k = Math.min(1, it.t / 0.2);
        s *= easeOutBack(k);
        if (k < 1) {
          ctx.save();
          ctx.shadowColor = rgba(SPECIES[it.spec.species].glow, 0.8);
          ctx.shadowBlur = 22 * (1 - k);
        }
      }
      ctx.drawImage(getTile(it.spec.species, it.spec.tier), it.x - s / 2, it.y - s / 2, s, s);
      if (it.mode === 'spawn') {
        ctx.restore();
      }
    }

    // breeze selection hint
    if (this.awaitingBreeze) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
      for (const it of this.tray) {
        ctx.strokeStyle = `rgba(160,220,255,${0.3 + pulse * 0.5})`;
        ctx.lineWidth = 2.5;
        roundRect(ctx, it.x - this.slotW * 0.5, this.trayY + 2, this.slotW, 66, 13);
        ctx.stroke();
      }
    }

    this.fx.render(ctx);
    ctx.restore();
  }

  /* ---------- HUD data ---------- */
  hud(): { score: number; tilesLeft: number; blooms: number; bloomGoal: number; tray: number; traySize: number; combo: number } {
    return {
      score: this.score,
      tilesLeft: this.board.tiles.length + this.tray.length,
      blooms: this.blossomsDone,
      bloomGoal: this.level?.blossoms || 0,
      tray: this.tray.length,
      traySize: this.level?.traySize || 7,
      combo: this.chain,
    };
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
