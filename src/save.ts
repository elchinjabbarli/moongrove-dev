/**
 * Local persistence via localStorage. No network, no accounts — progress
 * lives only on the device (see privacy.html).
 */
import { BOOSTERS, START_DEW } from './config';

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
}

export interface SaveData {
  v: number;
  level: number; // current level to play (1..1000)
  stars: Record<number, number>; // level -> 0..3
  dew: number;
  boosters: Record<string, number>;
  settings: Settings;
  totals: { score: number; blossoms: number; plays: number; bestCombo: number };
  purchases: { removeAds: boolean };
  adConsent: 'unset' | 'personalized' | 'nonpersonalized';
  seenTutorial: number; // tutorial steps already shown (bitmask-ish counter)
}

const KEY = 'moongrove.save.v1';

function defaults(): SaveData {
  const boosters: Record<string, number> = {};
  for (const b of BOOSTERS) boosters[b.id] = b.start;
  return {
    v: 1,
    level: 1,
    stars: {},
    dew: START_DEW,
    boosters,
    settings: { sound: true, music: true, haptics: true },
    totals: { score: 0, blossoms: 0, plays: 0, bestCombo: 0 },
    purchases: { removeAds: false },
    adConsent: 'unset',
    seenTutorial: 0,
  };
}

function clone(d: SaveData): SaveData {
  return JSON.parse(JSON.stringify(d)) as SaveData;
}

class Store {
  data: SaveData = defaults();
  private dirty = false;
  private started = false;

  load(): void {
    if (this.started) return;
    this.started = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const base = defaults();
        this.data = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) }, boosters: { ...base.boosters, ...(parsed.boosters || {}) }, purchases: { ...base.purchases, ...(parsed.purchases || {}) }, totals: { ...base.totals, ...(parsed.totals || {}) }, stars: parsed.stars || {} };
      }
    } catch {
      this.data = defaults();
    }
    setInterval(() => this.flush(), 1200);
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  mark(): void {
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* private mode / quota: play on without persistence */
    }
  }

  snapshot(): SaveData {
    return clone(this.data);
  }

  reset(): void {
    this.data = defaults();
    this.mark();
    this.flush();
  }
}

export const store = new Store();
