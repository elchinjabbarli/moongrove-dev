/**
 * Fully synthesized audio (WebAudio) — no sound files, zero downloads.
 * Melodic pentatonic taps, arpeggios for merges, a warm chord for blossoms
 * and a soft night ambience pad. iOS requires creating the AudioContext
 * inside a user gesture, hence unlock().
 */
import { store } from './save';

type Ctx = AudioContext;

class AudioEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  unlocked = false;

  unlock(): void {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);
      this.unlocked = true;
      this.resume();
      this.startAmbience();
    } catch {
      /* audio unavailable — game is fully playable without sound */
    }
  }

  private resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private ok(): boolean {
    return this.unlocked && !!this.ctx && store.data.settings.sound;
  }

  private tone(freq: number, opts: { type?: OscillatorType; dur?: number; vol?: number; delay?: number; slide?: number } = {}): void {
    if (!this.ok() || !this.ctx || !this.master) return;
    this.resume();
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.22;
    const vol = (opts.vol ?? 0.16) * 0.9;
    const osc = this.ctx.createOscillator();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * opts.slide), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(opts: { dur?: number; vol?: number; hp?: number; lp?: number; delay?: number; sweep?: number } = {}): void {
    if (!this.ok() || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.2;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = opts.hp || 4000;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(opts.lp || 12000, t0);
    if (opts.sweep) lp.frequency.exponentialRampToValueAtTime(Math.max(200, (opts.lp || 12000) * opts.sweep), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.value = opts.vol ?? 0.06;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  /* ---------- Ambience ---------- */
  private startAmbience(): void {
    if (!this.ctx || !this.master || this.ambientGain) return;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    g.connect(lp);
    lp.connect(this.master);
    const freqs = [110, 165, 220.5];
    for (const f of freqs) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lg = this.ctx.createGain();
      lg.gain.value = f * 0.004;
      lfo.connect(lg);
      lg.connect(o.frequency);
      const og = this.ctx.createGain();
      og.gain.value = 0.33;
      o.connect(og);
      og.connect(g);
      o.start();
      lfo.start();
      this.ambientNodes.push(o, lfo);
    }
    this.ambientGain = g;
    this.updateAmbience();
  }

  updateAmbience(): void {
    if (!this.ambientGain || !this.ctx) return;
    const on = store.data.settings.music;
    const target = on ? 0.05 : 0;
    this.ambientGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
  }

  /* ---------- SFX ---------- */
  private tierFreq(tier: number, species: number): number {
    const base = [523.25, 587.33, 659.25, 783.99][Math.max(0, Math.min(3, tier))];
    return base * Math.pow(2, (species * 2) / 12);
  }

  tap(tier: number, species: number): void {
    this.tone(this.tierFreq(tier, species), { type: 'triangle', dur: 0.16, vol: 0.12 });
    this.tone(this.tierFreq(tier, species) * 2, { type: 'sine', dur: 0.1, vol: 0.05 });
  }

  merge(tier: number, species: number): void {
    const f = this.tierFreq(tier, species);
    this.tone(f, { dur: 0.14, vol: 0.14 });
    this.tone(f * 1.26, { dur: 0.16, vol: 0.13, delay: 0.06 });
    this.tone(f * 1.5, { dur: 0.22, vol: 0.13, delay: 0.12 });
    this.noise({ dur: 0.16, vol: 0.035, hp: 6000 });
  }

  blossom(): void {
    const chord = [261.63, 329.63, 392, 493.88, 523.25];
    chord.forEach((f, i) => this.tone(f, { type: 'sine', dur: 0.9, vol: 0.09, delay: i * 0.03 }));
    this.tone(65.41, { type: 'sine', dur: 0.5, vol: 0.22 });
    this.noise({ dur: 0.7, vol: 0.05, hp: 5000, sweep: 0.15 });
  }

  combo(chain: number): void {
    this.tone(880 * Math.pow(1.09, chain), { type: 'sine', dur: 0.12, vol: 0.1 });
  }

  ui(): void {
    this.tone(1250, { type: 'sine', dur: 0.05, vol: 0.07 });
  }

  booster(): void {
    this.noise({ dur: 0.4, vol: 0.07, hp: 700, lp: 2600, sweep: 0.06 });
  }

  warn(): void {
    this.tone(196, { type: 'square', dur: 0.09, vol: 0.05 });
    this.tone(174, { type: 'square', dur: 0.12, vol: 0.05, delay: 0.11 });
  }

  win(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, { dur: 0.35, vol: 0.13, delay: i * 0.09 }));
    this.noise({ dur: 0.9, vol: 0.04, hp: 7000, delay: 0.3 });
  }

  fail(): void {
    [392, 311.13, 261.63, 196].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.4, vol: 0.1, delay: i * 0.18 }));
  }
}

export const audio = new AudioEngine();

/* ---------- Haptics ---------- */
export function haptic(pattern: number | number[]): void {
  if (!store.data.settings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported (iOS web) — Capacitor build adds native haptics */
  }
}
