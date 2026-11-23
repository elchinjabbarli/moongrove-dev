/**
 * Juice: particles (petals, sparks, dust), floating score popups, rings and
 * a soft screen shake. Everything is pooled-ish and capped for 60 fps on
 * older iPhones.
 */
import { SPECIES } from './config';

interface Particle {
  kind: 'petal' | 'spark' | 'dust';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  grav: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  big: boolean;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

const MAX_PARTICLES = 260;

export class FX {
  private ps: Particle[] = [];
  private popups: Popup[] = [];
  private rings: Ring[] = [];
  shakeT = 0;
  shakeAmp = 0;
  flashT = 0;
  flashColor = '255,255,255';

  private push(p: Particle): void {
    if (this.ps.length >= MAX_PARTICLES) this.ps.shift();
    this.ps.push(p);
  }

  petalBurst(x: number, y: number, species: number, count = 10, power = 1): void {
    const s = SPECIES[Math.max(0, Math.min(3, species))];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (60 + Math.random() * 130) * power;
      this.push({
        kind: 'petal',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40 * power,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
        size: 5 + Math.random() * 5,
        color: Math.random() < 0.55 ? s.light : s.mid,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5,
        grav: 220,
      });
    }
  }

  sparkBurst(x: number, y: number, color: string, count = 8, power = 1): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (80 + Math.random() * 160) * power;
      this.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        rot: 0,
        vr: 0,
        size: 1.6 + Math.random() * 2.2,
        color,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.3,
        grav: 30,
      });
    }
  }

  bloomRing(x: number, y: number, color: string, maxR = 90): void {
    this.rings.push({ x, y, r: 8, maxR, life: 0, maxLife: 0.55, color });
  }

  petalRain(species: number, w: number): void {
    const s = SPECIES[Math.max(0, Math.min(3, species))];
    for (let i = 0; i < 26; i++) {
      this.push({
        kind: 'petal',
        x: Math.random() * w,
        y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 40,
        vy: 90 + Math.random() * 110,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 5,
        size: 5 + Math.random() * 6,
        color: Math.random() < 0.5 ? s.light : s.mid,
        life: -Math.random() * 0.8,
        maxLife: 2.4,
        grav: 26,
      });
    }
  }

  popup(x: number, y: number, text: string, color = '#ffffff', big = false): void {
    this.popups.push({ x, y, text, color, life: 0, maxLife: big ? 1.3 : 0.9, big });
  }

  shake(amp = 5, t = 0.3): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, t);
  }

  flash(color = '255,255,255', t = 0.16): void {
    this.flashColor = color;
    this.flashT = Math.max(this.flashT, t);
  }

  update(dt: number): void {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life += dt;
      if (p.life > p.maxLife) {
        this.ps.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - 1.4 * dt;
      p.rot += p.vr * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].life += dt;
      this.popups[i].y -= 34 * dt;
      if (this.popups[i].life > this.popups[i].maxLife) this.popups.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      r.r += ((r.maxR - r.r) * 6 + 40) * dt;
      if (r.life > r.maxLife) this.rings.splice(i, 1);
    }
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
  }

  shakeOffset(): { x: number; y: number } {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = (this.shakeAmp * this.shakeT) / 0.3;
    return { x: Math.sin(this.shakeT * 70) * k, y: Math.cos(this.shakeT * 61) * k * 0.7 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const r of this.rings) {
      const k = 1 - r.life / r.maxLife;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = k * 0.8;
      ctx.lineWidth = 2.5 * k + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.ps) {
      const k = p.life < 0 ? 0 : Math.max(0, 1 - p.life / p.maxLife);
      if (k <= 0) continue;
      if (p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size * 0.9, 0, 0, p.size);
        ctx.quadraticCurveTo(-p.size * 0.9, 0, 0, -p.size);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of this.popups) {
      const k = Math.min(1, p.life / 0.14);
      const fade = p.life > p.maxLife - 0.3 ? (p.maxLife - p.life) / 0.3 : 1;
      ctx.globalAlpha = fade;
      ctx.font = p.big ? '700 22px -apple-system, "Segoe UI", system-ui, sans-serif' : '700 15px -apple-system, "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(4,8,20,0.55)';
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color;
      const s = 0.6 + 0.4 * Math.min(1, k * 1.3);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(s, s);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${(this.flashT / 0.16) * 0.22})`;
      ctx.fillRect(0, 0, 4000, 4000);
    }
    ctx.restore();
  }

  clear(): void {
    this.ps.length = 0;
    this.popups.length = 0;
    this.rings.length = 0;
    this.shakeT = 0;
    this.flashT = 0;
  }
}
