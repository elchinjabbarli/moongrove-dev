/**
 * The level map: 1000 nodes on a winding moonlit path, grouped into 20
 * chapters. Rendered on the game canvas with virtualization (only visible
 * nodes draw), inertial scrolling, star marks, golden bounty nodes and a
 * pulsing "current level" node.
 */
import { BOUNTY_EVERY, CHAPTER_SIZE, LEVEL_COUNT } from './config';
import { chapterName, t } from './i18n';
import { store } from './save';
import { Rng } from './rng';

const NODE_SPACING = 66;
const HEADER_EXTRA = 86;

interface Firefly { x: number; y: number; a: number; sp: number; r: number; tw: number }

export class MapView {
  private W = 390;
  private H = 700;
  scrollY = 0;
  private velY = 0;
  private dragging = false;
  private lastY = 0;
  private downT = 0;
  private downX = 0;
  private downScroll = 0;
  private moved = false;
  private time = 0;
  private fireflies: Firefly[] = [];
  currentLevel = 1;
  onPickLevel: ((n: number) => void) | null = null;

  constructor() {
    const rng = new Rng(777);
    for (let i = 0; i < 16; i++) {
      this.fireflies.push({
        x: rng.next(),
        y: rng.next(),
        a: rng.next() * Math.PI * 2,
        sp: 0.1 + rng.next() * 0.25,
        r: 1.2 + rng.next() * 2.2,
        tw: rng.next() * Math.PI * 2,
      });
    }
  }

  open(currentLevel: number): void {
    this.currentLevel = currentLevel;
    this.centerOn(currentLevel);
  }

  private contentHeight(): number {
    return LEVEL_COUNT * NODE_SPACING + Math.ceil(LEVEL_COUNT / CHAPTER_SIZE) * HEADER_EXTRA + this.H;
  }

  private yOf(level: number): number {
    const chapter = Math.floor((level - 1) / CHAPTER_SIZE);
    return (level - 1) * NODE_SPACING + chapter * HEADER_EXTRA + 170 - level; // last -level: fine visual nudge off
  }

  private centerOn(level: number): void {
    this.scrollY = this.yOf(level) - this.H * 0.62;
    this.clampScroll();
  }

  private clampScroll(): void {
    const max = this.contentHeight() - this.H;
    this.scrollY = Math.max(-40, Math.min(max, this.scrollY));
  }

  jumpToCurrent(): void {
    this.centerOn(this.currentLevel);
  }

  resize(w: number, h: number): void {
    this.W = w;
    this.H = h;
    this.clampScroll();
  }

  /* ---------- input ---------- */
  pointerDown(px: number, py: number): void {
    this.dragging = true;
    this.moved = false;
    this.lastY = py;
    this.downX = px;
    this.downT = performance.now();
    this.downScroll = this.scrollY;
    this.velY = 0;
  }

  pointerMove(px: number, py: number): void {
    if (!this.dragging) return;
    const dy = py - this.lastY;
    if (Math.abs(px - this.downX) > 12 || Math.abs(this.scrollY - this.downScroll) > 12) this.moved = true;
    this.scrollY -= dy;
    this.lastY = py;
    this.velY = -dy * 60;
    this.clampScroll();
  }

  pointerUp(px: number, py: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    const quick = performance.now() - this.downT < 350;
    if (quick && !this.moved) this.tap(px, py);
  }

  private tap(px: number, py: number): void {
    const first = Math.max(1, Math.floor((this.scrollY) / NODE_SPACING) - 3);
    const last = Math.min(LEVEL_COUNT, first + Math.ceil(this.H / NODE_SPACING) + 6);
    for (let n = first; n <= last; n++) {
      const p = this.nodePos(n);
      if (Math.hypot(px - p.x, py - p.y) < 24) {
        if (n <= this.currentLevel) this.onPickLevel?.(n);
        return;
      }
    }
  }

  private nodePos(level: number): { x: number; y: number } {
    const yy = this.yOf(level) - this.scrollY;
    const wave = Math.sin(level * 0.42) * Math.min(this.W * 0.26, 104);
    return { x: this.W / 2 + wave, y: yy };
  }

  /** Screen-space node position (QA + tests). */
  nodeScreenPos(level: number): { x: number; y: number } {
    return this.nodePos(level);
  }

  /* ---------- frame ---------- */
  update(dt: number): void {
    this.time += dt;
    if (!this.dragging) {
      this.scrollY += this.velY * dt;
      this.velY *= Math.pow(0.06, dt);
      this.clampScroll();
    }
    for (const f of this.fireflies) {
      f.a += f.sp * dt * 0.4;
      f.tw += dt * 2.2;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.W;
    // moonlit path
    ctx.save();
    const first = Math.max(1, Math.floor(this.scrollY / NODE_SPACING) - 3);
    const last = Math.min(LEVEL_COUNT, first + Math.ceil(this.H / NODE_SPACING) + 8);

    ctx.strokeStyle = 'rgba(190,200,255,0.14)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let n = first; n <= last; n++) {
      const p = this.nodePos(n);
      if (n === first) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220,228,255,0.10)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 9]);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let n = first; n <= last; n++) {
      const chapter = Math.floor((n - 1) / CHAPTER_SIZE);
      if (n % CHAPTER_SIZE === 1) this.drawHeader(ctx, n, chapter);
      this.drawNode(ctx, n);
    }

    // fireflies
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      const x = (f.x + Math.cos(f.a) * 0.06) * W;
      const y = ((f.y + Math.sin(f.a) * 0.03 + 1) % 1) * this.H;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(f.tw));
      const g = ctx.createRadialGradient(x, y, 0, x, y, f.r * 5);
      g.addColorStop(0, `rgba(200,235,255,${0.5 * tw})`);
      g.addColorStop(1, 'rgba(200,235,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, f.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  private drawHeader(ctx: CanvasRenderingContext2D, n: number, chapter: number): void {
    const p = this.nodePos(n);
    const y = p.y - 58;
    if (y < -40 || y > this.H + 40) return;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,226,255,0.92)';
    ctx.font = '700 17px -apple-system, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(chapterName(chapter), this.W / 2, y);
    const range = t('ui.chapter', { name: '', a: n, b: n + CHAPTER_SIZE - 1 });
    ctx.fillStyle = 'rgba(200,196,230,0.5)';
    ctx.font = '500 11px -apple-system, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(range.replace(' · ', ' · ').replace(/^ · /, ''), this.W / 2, y + 17);
    ctx.strokeStyle = 'rgba(190,200,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.W * 0.18, y + 30);
    ctx.lineTo(this.W * 0.82, y + 30);
    ctx.stroke();
  }

  private drawNode(ctx: CanvasRenderingContext2D, n: number): void {
    const p = this.nodePos(n);
    if (p.y < -60 || p.y > this.H + 60) return;
    const stars = store.data.stars[n] || 0;
    const done = n < this.currentLevel || stars > 0;
    const current = n === this.currentLevel;
    const locked = !done && !current;
    const bounty = n % BOUNTY_EVERY === 0;
    const r = current ? 19 + Math.sin(this.time * 3) * 1.6 : 15.5;

    ctx.save();
    if (current) {
      ctx.shadowColor = 'rgba(255,222,120,0.85)';
      ctx.shadowBlur = 16 + 8 * Math.sin(this.time * 3);
    } else if (done && bounty) {
      ctx.shadowColor = 'rgba(255,205,90,0.5)';
      ctx.shadowBlur = 10;
    }

    let fill: string | CanvasGradient;
    if (locked) fill = '#232741';
    else if (done) {
      const g = ctx.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
      g.addColorStop(0, '#8d7bf0');
      g.addColorStop(1, '#4a3d94');
      fill = g;
    } else {
      const g = ctx.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
      g.addColorStop(0, '#ffd76e');
      g.addColorStop(1, '#e0952b');
      fill = g;
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (bounty) {
      ctx.strokeStyle = done ? 'rgba(255,214,110,0.9)' : 'rgba(255,214,110,0.55)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${current ? 14 : 12}px -apple-system, "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = locked ? 'rgba(190,196,225,0.55)' : current ? '#2b1c04' : '#f4f1ff';
    ctx.fillText(String(n), p.x, p.y + 0.5);
    ctx.textBaseline = 'alphabetic';

    if (done) {
      for (let s = 0; s < 3; s++) {
        const sx = p.x - 12 + s * 12;
        const sy = p.y + r + 9;
        const on = s < stars;
        ctx.fillStyle = on ? '#ffd76e' : 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
