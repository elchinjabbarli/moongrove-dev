/** Shared types for the game model. */
export interface TileSpec {
  species: number; // 0..3 index into SPECIES
  tier: number; // 0 seed, 1 sprout, 2 bud, 3 bloom
}

/** A tile sitting on the board (visual coordinates are logical px). */
export interface PlacedTile {
  id: number;
  spec: TileSpec;
  cx: number;
  cy: number;
  z: number;
  blocked: boolean;
  cell: number; // index into the 7×10 grid
  jx: number; // jitter within the cell, -0.5..0.5
  jy: number;
  popT: number; // seconds of "just became tappable" pop animation
}

/** A tile logically inside the tray; visual fields are animated. */
export interface TrayItem {
  id: number;
  spec: TileSpec;
  slot: number;
  x: number; // current visual x
  y: number;
  mode: 'fly' | 'idle' | 'converge' | 'spawn';
  t: number; // animation clock (seconds)
  fromX: number;
  fromY: number;
}

export interface LevelSpec {
  number: number;
  chapter: number;
  bounty: boolean;
  mask: string;
  layers: number;
  traySize: number;
  tiles: TileSpec[]; // exact forest: multiset always fully mergeable
  parScore: number;
  blossoms: number;
  speciesCount: number;
}
