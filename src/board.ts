/**
 * The layered board: tiles sit on a 7×10 grid in up to 8 layers with a bit of
 * organic jitter. A tile can only be tapped when no higher layer covers its
 * center — the classic "dig down" tension of the genre.
 */
import { GRID_COLS, GRID_ROWS } from './config';
import { maskCells } from './levels';
import { Rng } from './rng';
import type { LevelSpec, PlacedTile, TileSpec } from './types';

export class Board {
  tiles: PlacedTile[] = [];
  level: LevelSpec | null = null;
  cellW = 48;
  cellH = 48;
  originX = 0;
  originY = 0;
  drawSize = 44;
  private nextId = 1;
  private cells: { c: number; r: number }[] = [];

  setLevel(level: LevelSpec, rng: Rng): void {
    this.level = level;
    this.tiles = [];
    this.nextId = 1;
    this.cells = maskCells(level.mask).map((m) => ({ c: m.c, r: m.r }));
    const perLayer = Math.ceil(level.tiles.length / level.layers);
    let idx = 0;
    for (let z = 0; z < level.layers && idx < level.tiles.length; z++) {
      const count = Math.min(perLayer, level.tiles.length - idx);
      const shuffled = rng.shuffle(this.cells.slice()).slice(0, Math.min(count, this.cells.length));
      for (let i = 0; i < count; i++) {
        const cell = shuffled[i % shuffled.length];
        this.pushTile(level.tiles[idx++], cell.c + cell.r * GRID_COLS, z, rng);
      }
    }
    while (idx < level.tiles.length) {
      const cell = rng.pick(this.cells);
      this.pushTile(level.tiles[idx++], cell.c + cell.r * GRID_COLS, level.layers, rng);
    }
    this.recomputeBlocked();
  }

  private pushTile(spec: TileSpec, cell: number, z: number, rng: Rng): void {
    this.tiles.push({
      id: this.nextId++,
      spec,
      cx: 0,
      cy: 0,
      z,
      blocked: false,
      cell,
      jx: rng.next() - 0.5,
      jy: rng.next() - 0.5,
      popT: 0,
    });
  }

  resize(x: number, y: number, w: number, h: number): void {
    this.cellW = w / GRID_COLS;
    this.cellH = h / GRID_ROWS;
    this.originX = x;
    this.originY = y;
    this.drawSize = Math.min(this.cellW, this.cellH) * 0.94;
    for (const t of this.tiles) {
      t.cx = this.originX + ((t.cell % GRID_COLS) + 0.5) * this.cellW + t.jx * this.cellW * 0.6;
      t.cy = this.originY + (Math.floor(t.cell / GRID_COLS) + 0.5) * this.cellH + t.jy * this.cellH * 0.6;
    }
  }

  cellPos(cell: number, jx: number, jy: number): { x: number; y: number } {
    return {
      x: this.originX + ((cell % GRID_COLS) + 0.5) * this.cellW + jx * this.cellW * 0.6,
      y: this.originY + (Math.floor(cell / GRID_COLS) + 0.5) * this.cellH + jy * this.cellH * 0.6,
    };
  }

  recomputeBlocked(): void {
    const half = this.drawSize * 0.48;
    for (const t of this.tiles) {
      let blocked = false;
      for (const o of this.tiles) {
        if (o !== t && o.z > t.z && Math.abs(o.cx - t.cx) < half && Math.abs(o.cy - t.cy) < half) {
          blocked = true;
          break;
        }
      }
      if (t.blocked && !blocked && t.popT !== undefined) t.popT = 0.22;
      t.blocked = blocked;
    }
  }

  hitTest(px: number, py: number): PlacedTile | null {
    const half = this.drawSize * 0.5;
    let best: PlacedTile | null = null;
    for (const t of this.tiles) {
      if (t.blocked) continue;
      if (Math.abs(px - t.cx) > half || Math.abs(py - t.cy) > half) continue;
      if (!best || t.z > best.z || (t.z === best.z && t.id > best.id)) best = t;
    }
    return best;
  }

  remove(tile: PlacedTile): void {
    const i = this.tiles.indexOf(tile);
    if (i >= 0) this.tiles.splice(i, 1);
    this.recomputeBlocked();
  }

  restore(tile: PlacedTile): void {
    this.tiles.push(tile);
    this.recomputeBlocked();
  }

  /** Place a tile back (breeze/revive) on a fresh top layer — always tappable. */
  addBack(spec: TileSpec, rng: Rng): PlacedTile {
    const cell = rng.pick(this.cells);
    const z = this.tiles.reduce((m, t) => Math.max(m, t.z), 0) + 1;
    const tile: PlacedTile = {
      id: this.nextId++,
      spec,
      cx: 0,
      cy: 0,
      z,
      blocked: false,
      cell: cell.c + cell.r * GRID_COLS,
      jx: rng.next() - 0.5,
      jy: rng.next() - 0.5,
      popT: 0.3,
    };
    const p = this.cellPos(tile.cell, tile.jx, tile.jy);
    tile.cx = p.x;
    tile.cy = p.y;
    this.tiles.push(tile);
    return tile;
  }

  /** Permute identities among board tiles — multiset (and solvability) preserved. */
  shuffleIdentities(rng: Rng): void {
    const specs = rng.shuffle(this.tiles.map((t) => t.spec));
    this.tiles.forEach((t, i) => (t.spec = specs[i]));
  }
}
