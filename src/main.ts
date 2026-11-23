/**
 * Bootstrap: wiring, game loop, screen routing, monetization flow,
 * tutorial toasts and the QA hook (?qa=1) used by automated browser tests.
 */
import { CHAPTER_TINTS, LEVEL_COUNT, REVIVE_DEW, REWARDED_DEW, BOOSTERS } from './config';
import { generateLevel } from './levels';
import { GameScreen } from './game';
import { MapView } from './mapview';
import { ui } from './ui';
import { store } from './save';
import { audio } from './audio';
import { createAds } from './ads';
import { createIap, grant } from './iap';
import { initLang, t } from './i18n';
import { Rng } from './rng';
import { VERSION } from './version';

const game = new GameScreen();
const map = new MapView();
const ads = createAds();
const iap = createIap();

let screen: 'home' | 'map' | 'game' = 'home';
let winCount = 0;
let lastWinDew = 0;
let winDoubled = false;
let currentLevel = 1;
let trayWarnAt = -10;
let trayRejectAt = -10;

/* ---------- canvas ---------- */
const canvas = document.getElementById('cv') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 390;
let H = 700;
let dpr = 1;
const starRng = new Rng(20260101);
const stars: { x: number; y: number; r: number; a: number }[] = [];
for (let i = 0; i < 46; i++) stars.push({ x: starRng.next(), y: starRng.next(), r: 0.5 + starRng.next() * 1.3, a: 0.12 + starRng.next() * 0.5 });

function resize(): void {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  map.resize(W, H);
  game.resize(W, H, 118, 86);
}

/* ---------- level flow ---------- */
function startLevel(n: number): void {
  n = Math.max(1, Math.min(LEVEL_COUNT, n));
  currentLevel = n;
  const level = generateLevel(n);
  game.start(level);
  ui.setGameHeader(n, level.chapter);
  ui.refreshBoosters();
  ui.hideWinFail();
  ui.showModal(null);
  ui.setBase('game');
  screen = 'game';
  trayWarnAt = -10;
  trayRejectAt = -10;
}

function toMap(): void {
  ui.showModal(null);
  ui.setBase('map');
  screen = 'map';
  map.open(store.data.level);
}

function persistWin(): void {
  const n = game.level!.number;
  const prev = store.data.stars[n] || 0;
  store.data.stars[n] = Math.max(prev, gameWin!.stars);
  store.data.dew += gameWin!.dew;
  if (n < LEVEL_COUNT) store.data.level = Math.max(store.data.level, n + 1);
  store.data.totals.score += gameWin!.score;
  store.data.totals.blossoms += game.blossomsDone;
  store.data.totals.plays++;
  store.data.totals.bestCombo = Math.max(store.data.totals.bestCombo, game.chain);
  store.mark();
  store.flush();
  ui.refreshBoosters();
}

/* ---------- win / fail ---------- */
let gameWin: { stars: number; score: number; dew: number; bounty: boolean } | null = null;

game.onWin = (r) => {
  gameWin = r;
  lastWinDew = r.dew;
  winDoubled = false;
  winCount++;
  persistWin();
  ui.showWin(r, ads.available);
};

game.onFail = (canRevive) => {
  ui.showFail(canRevive && ads.available, store.data.dew >= REVIVE_DEW);
};

game.boosterCount = (id) => store.data.boosters[id] || 0;
game.consumeBooster = (id) => {
  store.data.boosters[id] = Math.max(0, (store.data.boosters[id] || 0) - 1);
  store.mark();
  ui.refreshBoosters();
};

/* ---------- tutorial toasts ---------- */
game.onEvent = (ev) => {
  const lvl = game.level?.number || 1;
  const now = performance.now() / 1000;
  switch (ev) {
    case 'tapFirst':
      if (lvl <= 2) ui.toast(t('tut.tap'), 3400);
      break;
    case 'firstMerge':
      if (lvl <= 3) ui.toast(t('tut.triple'), 3400);
      break;
    case 'firstBlossom':
      if (lvl <= 3) ui.toast(t('tut.blossom'), 3400);
      break;
    case 'trayWarn':
      if (now - trayWarnAt > 14) {
        trayWarnAt = now;
        ui.toast(lvl <= 5 ? t('tut.tray', { n: 7 }) : t('tray.warn'), 2800);
      }
      break;
    case 'trayReject':
      if (now - trayRejectAt > 6) {
        trayRejectAt = now;
        ui.toast(t('tray.full'), 2200);
      }
      break;
    case 'boost.empty':
      ui.toast(t('boost.empty'), 2400);
      break;
    case 'boost.undo':
      ui.toast(t('boost.usedUndo'), 2000);
      break;
    case 'boost.shuffle':
      ui.toast(t('boost.usedShuffle'), 2000);
      break;
    case 'boost.breezePick':
      ui.toast(t('boost.breeze.pick'), 2600);
      break;
    case 'boost.breeze':
      ui.toast(t('boost.usedBreeze'), 2000);
      break;
  }
  ui.setBreezeActive(game.awaitingBreeze);
};

/* ---------- UI hooks ---------- */
ui.build(document.getElementById('app') as HTMLElement, {
  play() {
    if (ads.needsConsent()) {
      ui.showModal('adchoice');
      return;
    }
    startLevel(store.data.level);
  },
  pause() {
    game.state = 'paused';
    ui.showModal('pause');
  },
  resume() {
    ui.showModal(null);
    game.state = 'playing';
  },
  restart() {
    startLevel(currentLevel);
  },
  quitToMap() {
    game.state = 'paused';
    toMap();
  },
  nextLevel() {
    ads.maybeInterstitial(winCount, currentLevel);
    startLevel(Math.min(LEVEL_COUNT, currentLevel + 1));
  },
  replayLevel() {
    startLevel(currentLevel);
  },
  booster(id) {
    game.useBooster(id);
    ui.refreshBoosters();
    ui.setBreezeActive(game.awaitingBreeze);
  },
  reviveAd() {
    void ads.showRewarded('revive').then((ok) => {
      if (ok) {
        game.revive();
        ui.showModal(null);
        ui.toast(t('fail.revived'), 2400);
      }
    });
  },
  reviveDew() {
    if (store.data.dew < REVIVE_DEW) {
      ui.toast(t('store.needDew'));
      return;
    }
    store.data.dew -= REVIVE_DEW;
    store.mark();
    game.revive();
    ui.showModal(null);
    ui.refreshBoosters();
    ui.toast(t('fail.revived'), 2400);
  },
  doubleDew() {
    if (winDoubled) return;
    void ads.showRewarded('double_win').then((ok) => {
      if (!ok) return;
      winDoubled = true;
      store.data.dew += lastWinDew;
      store.mark();
      ui.refreshBoosters();
      ui.toast(t('store.dewGain', { n: lastWinDew }), 2600);
      const dewEl = document.querySelector('.scr-win .win-dew span') as HTMLElement | null;
      if (dewEl) dewEl.textContent = `+${lastWinDew * 2}`;
    });
  },
  buyBooster(id) {
    const def = BOOSTERS.find((b) => b.id === id)!;
    if (store.data.dew < def.cost) {
      ui.toast(t('store.needDew'));
      return;
    }
    store.data.dew -= def.cost;
    store.data.boosters[id] = (store.data.boosters[id] || 0) + 1;
    store.mark();
    ui.refreshStore();
    audio.ui();
  },
  buyProduct(def) {
    void iap.purchase(def).then((ok) => {
      if (ok) {
        ui.toast(t('iap.granted'), 2600);
      } else {
        ui.toast(t('iap.failed'));
      }
      ui.refreshStore();
      ui.refreshBoosters();
    });
  },
  watchAdDew() {
    void ads.showRewarded('store_dew').then((ok) => {
      if (ok) {
        store.data.dew += REWARDED_DEW;
        store.mark();
        ui.refreshStore();
        ui.toast(t('store.dewGain', { n: REWARDED_DEW }), 2400);
      }
    });
  },
  restore() {
    void iap.restore().then((ok) => {
      ui.toast(ok ? t('iap.restored') : t('iap.failed'));
      ui.refreshStore();
    });
  },
  resetProgress() {
    store.reset();
    ui.setContinueLabel(1);
    ui.refreshBoosters();
    ui.showModal(null);
    ui.setBase('home');
    screen = 'home';
  },
  jumpToCurrent() {
    map.jumpToCurrent();
  },
  setPersonalized(v) {
    ads.setPersonalized(v);
    ui.showModal(null);
    startLevel(store.data.level);
  },
}, ads, iap);

map.onPickLevel = (n) => {
  audio.ui();
  startLevel(n);
};

/* ---------- input ---------- */
function unlockAudio(): void {
  audio.unlock();
  audio.updateAmbience();
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const x = e.clientX;
  const y = e.clientY;
  if (screen === 'map') {
    map.pointerDown(x, y);
  } else if (screen === 'game' && !ui.modalOpen()) {
    game.pointerDown(x, y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (screen === 'map') map.pointerMove(e.clientX, e.clientY);
});
window.addEventListener('pointerup', (e) => {
  if (screen === 'map') map.pointerUp(e.clientX, e.clientY);
});
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && screen === 'game' && game.state === 'playing') {
    game.state = 'paused';
    ui.showModal('pause');
  }
});

/* ---------- render loop ---------- */
let last = performance.now();
let clock = 0;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  // background: chapter-tinted night gradient + stars + moon halo
  const tint = screen === 'game' && game.level
    ? CHAPTER_TINTS[game.level.chapter % CHAPTER_TINTS.length]
    : CHAPTER_TINTS[0];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, tint[0]);
  g.addColorStop(1, tint[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    ctx.fillStyle = `rgba(230,235,255,${s.a * (0.7 + 0.3 * Math.sin(clock * 0.7 + s.x * 20))})`;
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H * 0.7, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const moon = ctx.createRadialGradient(W * 0.78, H * 0.1, 0, W * 0.78, H * 0.1, 130);
  moon.addColorStop(0, 'rgba(226,232,255,0.22)');
  moon.addColorStop(1, 'rgba(226,232,255,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, W, H * 0.5);

  if (screen === 'map') {
    map.update(dt);
    map.render(ctx);
  } else if (screen === 'game') {
    if (game.state === 'playing') game.update(dt);
    else game.update(Math.min(dt, 0.02)); // keep cosmetic timers alive while paused
    game.render(ctx);
    if (game.hudDirty) {
      game.hudDirty = false;
      const h = game.hud();
      ui.updateHud(h.score, h.blooms, h.bloomGoal, h.tilesLeft, !!game.level?.bounty);
    }
  }

  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
function boot(): void {
  store.load();
  initLang();
  ui.setContinueLabel(store.data.level);
  ui.refreshBoosters();
  resize();
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('gone');
    setTimeout(() => splash.remove(), 480);
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* ---------- QA hook for automated tests (?qa=1) — never active for players ---------- */
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa') === '1') {
  const w = window as unknown as Record<string, unknown>;
  w.__mg = {
    version: VERSION,
    state: () => ({
      screen,
      level: game.level?.number ?? null,
      phase: game.state,
      score: game.score,
      tilesLeft: game.board.tiles.length + game.tray.length,
      tray: game.tray.length,
      blossoms: game.blossomsDone,
      goal: game.level?.blossoms ?? 0,
      dew: store.data.dew,
      savedLevel: store.data.level,
    }),
    boardTiles: () => game.board.tiles.map((tl) => ({
      x: Math.round(tl.cx), y: Math.round(tl.cy), z: tl.z, blocked: tl.blocked,
      species: tl.spec.species, tier: tl.spec.tier,
    })),
    tapAt: (x: number, y: number) => game.pointerDown(x, y),
    traySpecs: () => game.tray.map((it) => ({ species: it.spec.species, tier: it.spec.tier, x: Math.round(it.x), y: Math.round(it.y) })),
    mapNode: (n: number) => map.nodeScreenPos(n),
    start: (n: number) => startLevel(n),
    toMap: () => toMap(),
    home: () => {
      ui.setBase('home');
      screen = 'home';
    },
    buyBooster: (id: string) => {
      const def = BOOSTERS.find((b) => b.id === id)!;
      if (store.data.dew >= def.cost) {
        store.data.dew -= def.cost;
        store.data.boosters[id] = (store.data.boosters[id] || 0) + 1;
        store.mark();
      }
    },
    flush: () => store.flush(),
    grantAll: () => grant({ id: 'qa', kind: 'consumable', dew: 10000, price: '' }),
  };
}
