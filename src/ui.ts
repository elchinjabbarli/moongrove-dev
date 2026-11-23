/**
 * DOM screens: home, HUD, booster bar, pause, win, fail, settings, store,
 * ad consent, toasts. The canvas renders the game field; everything crisp
 * and text-like lives here for native-feeling iOS UI.
 */
import { BOOSTERS, PRODUCTS, REWARDED_DEW, REVIVE_DEW } from './config';
import { t, chapterName } from './i18n';
import { store } from './save';
import type { ProductDef } from './config';
import { VERSION } from './version';
import type { AdsAdapter } from './ads';
import type { IapAdapter } from './iap';
import type { WinResult } from './game';

export interface UIHooks {
  play(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  quitToMap(): void;
  nextLevel(): void;
  replayLevel(): void;
  booster(id: string): void;
  reviveAd(): void;
  reviveDew(): void;
  doubleDew(): void;
  buyBooster(id: string): void;
  buyProduct(def: ProductDef): void;
  watchAdDew(): void;
  restore(): void;
  resetProgress(): void;
  jumpToCurrent(): void;
  setPersonalized(v: boolean): void;
}

const el = (tag: string, cls?: string, html?: string): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const svgPause = '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1.4" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.4" fill="currentColor"/></svg>';
const svgHome = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/></svg>';
const svgGear = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></svg>';
const svgStore = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16l-1.2 11H5.2z"/><path d="M8.5 12h7"/><circle cx="9" cy="7.5" r="0" /></svg>';
const svgUndo = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h10a5 5 0 0 1 0 10h-4"/><path d="M8 5L4 9l4 4"/></svg>';
const svgShuffle = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l4 5 4-5h4"/><path d="M3 17h4l4-5"/><path d="M17 4l3 3-3 3"/><path d="M17 14l3 3-3 3"/></svg>';
const svgWind = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M3 8h9a3 3 0 1 0-3-3"/><path d="M3 13h13a3 3 0 1 1-3 3"/><path d="M3 18h6"/></svg>';
const svgDew = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2.7c3.4 4.2 6 7.3 6 10.3a6 6 0 0 1-12 0c0-3 2.6-6.1 6-10.3z"/></svg>';
const svgStar = '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M12 2.6l2.8 6 6.6.8-4.9 4.5 1.3 6.5L12 17.2l-5.8 3.2 1.3-6.5-4.9-4.5 6.6-.8z"/></svg>';
const svgMap = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/></svg>';
const svgAd = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/></svg>';
const svgCompass = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none"/></svg>';

const LOGO = `
<svg class="logo-bloom" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="lgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f4e9ff" stop-opacity="0.9"/>
      <stop offset="45%" stop-color="#b07cf7" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lgPetal" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="60%" stop-color="#a875f5"/>
      <stop offset="100%" stop-color="#e8ccff"/>
    </linearGradient>
    <linearGradient id="lgPetal2" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#0f8fa8"/>
      <stop offset="60%" stop-color="#2fd8c6"/>
      <stop offset="100%" stop-color="#b4fff2"/>
    </linearGradient>
    <radialGradient id="lgCore" cx="42%" cy="38%" r="60%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#ffd76e"/>
      <stop offset="100%" stop-color="#e0952b"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="72" fill="url(#lgGlow)"/>
  ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="100" cy="56" rx="17" ry="34" fill="url(#lgPetal)" transform="rotate(${a} 100 100)"/>`).join('')}
  ${[30, 90, 150, 210, 270, 330].map((a) => `<ellipse cx="100" cy="68" rx="12" ry="24" fill="url(#lgPetal2)" opacity="0.85" transform="rotate(${a} 100 100)"/>`).join('')}
  <circle cx="100" cy="100" r="24" fill="url(#lgCore)"/>
  <circle cx="100" cy="100" r="24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.6"/>
  <circle cx="160" cy="52" r="5" fill="#b4fff2" opacity="0.9"/>
  <circle cx="42" cy="150" r="4" fill="#ffd76e" opacity="0.85"/>
  <circle cx="150" cy="150" r="3" fill="#e8ccff" opacity="0.8"/>
</svg>`;

export class UI {
  private root!: HTMLElement;
  private hooks!: UIHooks;
  private ads!: AdsAdapter;
  private iap!: IapAdapter;
  private screens: Record<string, HTMLElement> = {};
  private hud!: { level: HTMLElement; chapter: HTMLElement; score: HTMLElement; goal: HTMLElement; tiles: HTMLElement; };
  private boostBtns: Record<string, { btn: HTMLElement; count: HTMLElement }> = {};
  private dewChips: HTMLElement[] = [];
  private toastsBox!: HTMLElement;
  private winStars: HTMLElement[] = [];

  build(root: HTMLElement, hooks: UIHooks, ads: AdsAdapter, iap: IapAdapter): void {
    this.root = root;
    this.hooks = hooks;
    this.ads = ads;
    this.iap = iap;
    root.innerHTML = '';
    root.append(
      this.buildHud(),
      this.buildMapHud(),
      this.buildHome(),
      this.buildPause(),
      this.buildWin(),
      this.buildFail(),
      this.buildSettings(),
      this.buildStore(),
      this.buildAdChoice(),
      this.buildBoostbar(),
    );
    this.toastsBox = el('div', 'toasts');
    root.append(this.toastsBox);
    const vig = el('div', 'vignette');
    root.append(vig);
    this.setBase('home');
  }

  /* ---------- screens ---------- */
  /** Base screens: home / map / game (hud + boostbar). */
  setBase(name: 'home' | 'map' | 'game'): void {
    this.screens['home']?.classList.toggle('active', name === 'home');
    this.screens['hud']?.classList.toggle('active', name === 'game');
    this.screens['boostbar']?.classList.toggle('active', name === 'game');
    this.screens['maphud']?.classList.toggle('active', name === 'map');
  }

  /** Modals overlay the current base (game/map/home keeps rendering below). */
  showModal(name: string | null): void {
    for (const k of ['pause', 'win', 'fail', 'settings', 'store', 'adchoice']) {
      this.screens[k]?.classList.toggle('active', k === name);
    }
  }

  register(id: string, e: HTMLElement): void {
    this.screens[id] = e;
  }

  modalOpen(): boolean {
    for (const k of ['pause', 'win', 'fail', 'settings', 'store', 'adchoice']) {
      if (this.screens[k]?.classList.contains('active')) return true;
    }
    return false;
  }

  /* ---------- builders ---------- */
  private buildHud(): HTMLElement {
    const hud = el('div', 'hud screen', '');
    hud.id = 'hud';
    const pauseBtn = el('button', 'iconbtn', svgPause);
    pauseBtn.setAttribute('aria-label', 'pause');
    pauseBtn.onclick = () => this.hooks.pause();
    const mid = el('div', 'hud-mid');
    const lvl = el('div', 'hud-level', 'Level 1');
    const chap = el('div', 'hud-chapter', '');
    const sub = el('div', 'hud-sub');
    const goal = el('div', 'hud-goal');
    const tiles = el('div', 'hud-tiles', '');
    sub.append(goal, tiles);
    mid.append(lvl, chap, sub);
    const score = el('div', 'hud-score', '0');
    hud.append(pauseBtn, mid, score);
    this.hud = { level: lvl, chapter: chap, score, goal, tiles };
    this.register('hud', hud);
    return hud;
  }

  private buildMapHud(): HTMLElement {
    const bar = el('div', 'maphud screen');
    bar.id = 'maphud';
    const home = el('button', 'iconbtn', svgHome);
    home.onclick = () => this.hooks.quitToMap();
    home.setAttribute('aria-label', 'home');
    const title = el('div', 'maphud-title', t('ui.map'));
    const jump = el('button', 'chipbtn', svgCompass + `<span>${t('map.jump')}</span>`);
    jump.onclick = () => this.hooks.jumpToCurrent();
    const storeBtn = el('button', 'iconbtn', svgStore);
    storeBtn.onclick = () => this.openStore();
    const gear = el('button', 'iconbtn', svgGear);
    gear.onclick = () => this.openSettings();
    bar.append(home, title, jump, storeBtn, gear);
    this.register('maphud', bar);
    return bar;
  }

  private buildHome(): HTMLElement {
    const scr = el('div', 'screen scr-home');
    scr.id = 'scr-home';
    const logo = el('div', 'home-logo', LOGO);
    const word = el('div', 'home-word', 'Moon<span>grove</span>');
    const tag = el('div', 'home-tag', t('game.tagline'));
    const play = el('button', 'btn primary big', t('ui.play'));
    play.onclick = () => this.hooks.play();
    const row = el('div', 'home-row');
    const mapBtn = el('button', 'btn ghost', svgMap + `<span>${t('ui.map')}</span>`);
    mapBtn.onclick = () => this.hooks.quitToMap();
    const store = el('button', 'btn ghost', svgStore + `<span>${t('ui.store')}</span>`);
    store.onclick = () => this.openStore();
    const settings = el('button', 'btn ghost', svgGear + `<span>${t('ui.settings')}</span>`);
    settings.onclick = () => this.openSettings();
    row.append(mapBtn, store, settings);
    const foot = el('div', 'home-foot', `${t('ui.version', { v: VERSION })} · © 2027 Elchin Jabbarli`);
    scr.append(logo, word, tag, play, row, foot);
    this.register('home', scr);
    return scr;
  }

  setContinueLabel(level: number): void {
    const btn = this.root.querySelector('.scr-home .btn.primary') as HTMLElement | null;
    if (btn) btn.textContent = level > 1 ? t('ui.continue', { n: level }) : t('ui.play');
  }

  private buildPause(): HTMLElement {
    const scr = el('div', 'screen modal scr-pause');
    const card = el('div', 'card');
    card.append(el('div', 'modal-title', t('hud.paused')));
    const resume = el('button', 'btn primary', t('ui.resume'));
    resume.onclick = () => this.hooks.resume();
    const restart = el('button', 'btn ghost', t('ui.restart'));
    restart.onclick = () => this.hooks.restart();
    const quit = el('button', 'btn ghost', t('ui.quit'));
    quit.onclick = () => this.hooks.quitToMap();
    card.append(resume, restart, quit);
    scr.append(card);
    this.register('pause', scr);
    return scr;
  }

  private buildWin(): HTMLElement {
    const scr = el('div', 'screen modal scr-win');
    const card = el('div', 'card');
    card.append(el('div', 'modal-title win-title', t('win.title')));
    const stars = el('div', 'win-stars');
    for (let i = 0; i < 3; i++) {
      const s = el('div', 'win-star', svgStar);
      stars.append(s);
      this.winStars.push(s);
    }
    const scoreRow = el('div', 'win-score-row');
    scoreRow.append(el('span', 'win-score-label', t('win.score')));
    const scoreVal = el('span', 'win-score-val', '0');
    scoreRow.append(scoreVal);
    const dewRow = el('div', 'win-dew', `${svgDew}<span>+0</span>`);
    const double = el('button', 'btn reward', `${svgAd}<span>${t('win.double')}</span>`);
    double.onclick = () => this.hooks.doubleDew();
    const row = el('div', 'modal-row');
    const mapBtn = el('button', 'btn ghost small', t('ui.map'));
    mapBtn.onclick = () => this.hooks.quitToMap();
    const replay = el('button', 'btn ghost small', t('ui.retry'));
    replay.onclick = () => this.hooks.replayLevel();
    row.append(mapBtn, replay);
    const next = el('button', 'btn primary big', t('ui.next'));
    next.onclick = () => this.hooks.nextLevel();
    card.append(stars, scoreRow, dewRow, double, row, next);
    scr.append(card);
    this.register('win', scr);
    this.scrWinRefs = { scoreVal, dewRow, double, next, title: card.querySelector('.win-title') as HTMLElement };
    return scr;
  }

  private scrWinRefs!: { scoreVal: HTMLElement; dewRow: HTMLElement; double: HTMLElement; next: HTMLElement; title: HTMLElement };

  showWin(r: WinResult, canDouble: boolean): void {
    const refs = this.scrWinRefs;
    refs.scoreVal.textContent = String(r.score);
    refs.dewRow.querySelector('span')!.textContent = `+${r.dew}`;
    refs.double.style.display = canDouble ? '' : 'none';
    const msg = r.stars === 3 ? t('win.stars3') : r.stars === 2 ? t('win.stars2') : t('win.stars1');
    refs.title.textContent = r.bounty ? `${msg} · ${t('game.bounty')}` : msg;
    this.winStars.forEach((s, i) => {
      s.classList.remove('earned');
      if (i < r.stars) {
        setTimeout(() => s.classList.add('earned'), 350 + i * 320);
      }
    });
    this.showModal('win');
  }

  private buildFail(): HTMLElement {
    const scr = el('div', 'screen modal scr-fail');
    const card = el('div', 'card');
    card.append(el('div', 'modal-title', t('fail.title')));
    card.append(el('div', 'modal-text', t('fail.text')));
    const adRevive = el('button', 'btn reward', `${svgAd}<span>${t('fail.reviveAd')}</span>`);
    adRevive.onclick = () => this.hooks.reviveAd();
    const dewRevive = el('button', 'btn primary', t('fail.reviveDew', { n: REVIVE_DEW }));
    dewRevive.onclick = () => this.hooks.reviveDew();
    const retry = el('button', 'btn ghost', t('ui.retry'));
    retry.onclick = () => this.hooks.restart();
    const mapBtn = el('button', 'btn ghost', t('ui.quit'));
    mapBtn.onclick = () => this.hooks.quitToMap();
    card.append(adRevive, dewRevive, retry, mapBtn);
    this.scrFailRefs = { adRevive, dewRevive };
    scr.append(card);
    this.register('fail', scr);
    return scr;
  }

  private scrFailRefs!: { adRevive: HTMLElement; dewRevive: HTMLElement };

  showFail(canReviveAd: boolean, canReviveDew: boolean): void {
    this.scrFailRefs.adRevive.style.display = canReviveAd ? '' : 'none';
    this.scrFailRefs.dewRevive.style.display = canReviveDew ? '' : 'none';
    this.showModal('fail');
  }

  private buildSettings(): HTMLElement {
    const scr = el('div', 'screen modal scr-settings');
    const card = el('div', 'card');
    card.append(el('div', 'modal-title', t('ui.settings')));
    const mkToggle = (label: string, key: 'sound' | 'music' | 'haptics'): HTMLElement => {
      const row = el('div', 'set-row');
      row.append(el('span', 'set-label', label));
      const tg = el('button', 'toggle');
      const sync = () => tg.classList.toggle('on', store.data.settings[key]);
      sync();
      tg.onclick = () => {
        store.data.settings[key] = !store.data.settings[key];
        store.mark();
        sync();
      };
      row.append(tg);
      return row;
    };
    card.append(
      mkToggle(t('set.sound'), 'sound'),
      mkToggle(t('set.music'), 'music'),
      mkToggle(t('set.haptics'), 'haptics'),
    );
    const privacy = el('button', 'btn ghost small', t('ui.privacy'));
    privacy.onclick = () => window.open('privacy.html', '_blank');
    const reset = el('button', 'btn danger small', t('set.reset'));
    reset.onclick = () => {
      if (reset.classList.contains('confirm')) {
        this.hooks.resetProgress();
        reset.classList.remove('confirm');
        reset.textContent = t('set.reset');
        this.toast(t('set.resetDone'));
      } else {
        reset.classList.add('confirm');
        reset.textContent = t('set.resetConfirm');
        setTimeout(() => {
          reset.classList.remove('confirm');
          reset.textContent = t('set.reset');
        }, 3500);
      }
    };
    const about = el('div', 'set-about', `${t('set.about')} · ${t('ui.version', { v: VERSION })}`);
    const close = el('button', 'btn primary', t('ui.ok'));
    close.onclick = () => this.closeModal();
    card.append(privacy, reset, about, close);
    scr.append(card);
    this.register('settings', scr);
    return scr;
  }

  private buildStore(): HTMLElement {
    const scr = el('div', 'screen modal scr-store');
    const card = el('div', 'card store-card');
    card.append(el('div', 'modal-title', t('store.title')));
    const dew = el('div', 'store-dew', `${svgDew}<span class="dew-val">0</span>`);
    card.append(dew);
    this.dewChips.push(dew.querySelector('.dew-val') as HTMLElement);
    card.append(el('div', 'store-sec-title', t('store.boosters')));
    for (const b of BOOSTERS) {
      const icon = b.id === 'undo' ? svgUndo : b.id === 'shuffle' ? svgShuffle : svgWind;
      const row = el('div', 'store-row');
      row.innerHTML = `<div class="store-ico">${icon}</div>
        <div class="store-info"><div class="store-name">${t(`boost.${b.id}`)}</div>
        <div class="store-desc">${t(`boost.${b.id}.desc`)} · <span class="store-have" data-b="${b.id}">0</span></div></div>`;
      const buy = el('button', 'btn primary small', `${svgDew}<span>${b.cost}</span>`);
      buy.onclick = () => this.hooks.buyBooster(b.id);
      row.append(buy);
      card.append(row);
    }
    if (this.ads.available) {
      const adRow = el('button', 'btn reward wide', `${svgAd}<span>${t('store.adDew', { n: REWARDED_DEW })}</span>`);
      adRow.onclick = () => this.hooks.watchAdDew();
      card.append(adRow);
    }
    card.append(el('div', 'store-sec-title', t('store.removeads')));
    const iapBox = el('div', 'store-iap');
    card.append(iapBox);
    const restore = el('button', 'btn ghost small', t('ui.restore'));
    restore.style.display = this.iap.available ? '' : 'none';
    restore.onclick = () => this.hooks.restore();
    card.append(restore);
    const close = el('button', 'btn primary', t('ui.ok'));
    close.onclick = () => this.closeModal();
    card.append(close);
    scr.append(card);
    this.register('store', scr);
    this.scrStoreIap = iapBox;
    return scr;
  }

  private scrStoreIap!: HTMLElement;

  refreshStore(): void {
    for (const c of this.dewChips) c.textContent = String(store.data.dew);
    this.root.querySelectorAll<HTMLElement>('.store-have').forEach((h) => {
      h.textContent = String(store.data.boosters[h.dataset.b || ''] || 0);
    });
    const box = this.scrStoreIap;
    if (!box) return;
    box.innerHTML = '';
    if (store.data.purchases.removeAds) {
      box.append(el('div', 'store-owned', `✓ ${t('store.removed')}`));
      return;
    }
    for (const p of PRODUCTS) {
      const row = el('div', 'store-row');
      const name = p.id.endsWith('.removeads') ? t('store.removeads') : p.dew >= 5000 ? `${t('store.dew')} ×${p.dew}` : `${t('store.dew')} +${p.dew}`;
      row.innerHTML = `<div class="store-info"><div class="store-name">${name}</div>
        <div class="store-desc">${p.kind === 'nonconsumable' ? t('store.removeads') : t('store.dew')}</div></div>`;
      const buy = el('button', 'btn primary small', p.price);
      if (!this.iap.available) {
        buy.classList.add('off');
        buy.title = t('store.iosOnly');
        buy.onclick = () => this.toast(t('store.iosOnly'));
      } else {
        buy.onclick = () => this.hooks.buyProduct(p);
      }
      row.append(buy);
      box.append(row);
    }
    if (!this.iap.available) {
      box.append(el('div', 'store-ios-note', t('store.iosOnly')));
    }
  }

  openStore(): void {
    this.refreshStore();
    this.showModal('store');
  }

  openSettings(): void {
    this.showModal('settings');
  }

  private buildAdChoice(): HTMLElement {
    const scr = el('div', 'screen modal scr-adchoice');
    const card = el('div', 'card');
    card.append(el('div', 'modal-title', t('ad.consentTitle')));
    card.append(el('div', 'modal-text', t('ad.consentText')));
    const yes = el('button', 'btn primary', t('ad.personalized'));
    yes.onclick = () => this.hooks.setPersonalized(true);
    const no = el('button', 'btn ghost', t('ad.nonpersonalized'));
    no.onclick = () => this.hooks.setPersonalized(false);
    card.append(yes, no);
    scr.append(card);
    this.register('adchoice', scr);
    return scr;
  }

  private buildBoostbar(): HTMLElement {
    const bar = el('div', 'boostbar screen');
    bar.id = 'boostbar';
    for (const b of BOOSTERS) {
      const icon = b.id === 'undo' ? svgUndo : b.id === 'shuffle' ? svgShuffle : svgWind;
      const btn = el('button', 'boostbtn', `${icon}<span class="boost-count">0</span>`);
      btn.setAttribute('aria-label', t(`boost.${b.id}`));
      btn.onclick = () => this.hooks.booster(b.id);
      bar.append(btn);
      this.boostBtns[b.id] = { btn, count: btn.querySelector('.boost-count') as HTMLElement };
    }
    const dew = el('div', 'dew-chip', `${svgDew}<span class="dew-val">0</span>`);
    dew.onclick = () => this.openStore();
    bar.append(dew);
    this.dewChips.push(dew.querySelector('.dew-val') as HTMLElement);
    this.register('boostbar', bar);
    return bar;
  }

  refreshBoosters(): void {
    for (const b of BOOSTERS) {
      const ref = this.boostBtns[b.id];
      if (!ref) continue;
      const n = store.data.boosters[b.id] || 0;
      ref.count.textContent = String(n);
      ref.btn.classList.toggle('zero', n <= 0);
    }
    for (const c of this.dewChips) c.textContent = String(store.data.dew);
  }

  setBreezeActive(v: boolean): void {
    this.boostBtns['breeze']?.btn.classList.toggle('active', v);
  }

  /* ---------- HUD ---------- */
  setGameHeader(level: number, chapter: number): void {
    this.hud.level.textContent = t('ui.level', { n: level });
    this.hud.chapter.textContent = chapterName(chapter);
  }

  updateHud(score: number, blooms: number, goal: number, tilesLeft: number, bounty: boolean): void {
    this.hud.score.textContent = String(score);
    this.hud.tiles.textContent = `${tilesLeft}`;
    let dots = '';
    for (let i = 0; i < goal; i++) {
      dots += `<span class="gdot${i < blooms ? ' on' : ''}"></span>`;
    }
    this.hud.goal.innerHTML = dots;
    this.hud.goal.classList.toggle('bounty', bounty);
  }

  /* ---------- toasts ---------- */
  toast(text: string, ms = 2600): void {
    const box = el('div', 'toast', text);
    this.toastsBox.append(box);
    setTimeout(() => box.classList.add('out'), ms);
    setTimeout(() => box.remove(), ms + 380);
  }

  closeModal(): void {
    this.showModal(null);
  }

  hideWinFail(): void {
    this.screens['win']?.classList.remove('active');
    this.screens['fail']?.classList.remove('active');
  }
}

export const ui = new UI();
