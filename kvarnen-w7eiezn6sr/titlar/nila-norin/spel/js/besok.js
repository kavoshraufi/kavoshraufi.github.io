import { blit, puls, playSfx, playNote, TAU } from './core.js';

/**
 * Besökaren (1.9): när det varit stilla i ~2 s flyger en målad skogsvän (fjäril, fågel, nyckelpiga)
 * över gläntan med ett glittrande spår och en mjuk ton. Den går att trycka på — det är en av banans
 * frivilliga upptäckter (ger stjärna 3).
 */
const VANNER = [
  { id: 'butterfly', h: 44, flap: 9 },
  { id: 'bird', h: 46, flap: 5 },
  { id: 'ladybug', h: 36, flap: 12 },
];
const TYST_MS = 2100;

export class Besokare {
  constructor(particles, st) {
    this.p = particles; this.st = st;
    this.c = null; this.n = 0; this.hittad = false; this.trailT = 0;
  }
  reset() { this.c = null; this.hittad = false; this.n = 0; puls.t = performance.now(); }
  update(dt, W, H, pr, aktiv) {
    const now = performance.now();
    if (!this.c) {
      if (aktiv && now - puls.t > TYST_MS) this.spawn(W, H, pr);
      return;
    }
    const c = this.c;
    if (c.glad) {
      // Glad efter tryck: snurrar upp och iväg
      c.glad += dt; c.y -= 70 * dt; c.x += c.dir * 80 * dt;
      if (c.glad > 1.5) { this.c = null; puls.t = now; }
      return;
    }
    c.t += dt;
    const k = c.t / c.dur;
    c.x = c.x0 + (c.x1 - c.x0) * k;
    c.y = c.y0 + Math.sin(k * TAU * 1.5) * 26 - Math.sin(k * Math.PI) * 30;
    this.trailT -= dt;
    if (this.trailT <= 0 && !c.glad) {
      this.trailT = 0.9;
      this.p.burst(c.x - c.dir * 18, c.y - 10, 4, { kind: 'star', colors: ['#fff3b0', '#ffffff', '#ffd1e8'], speed: 40, lift: 10, life: 0.6, r: 4 });
    }
    if (k >= 1) { this.c = null; puls.t = now; }
  }
  spawn(W, H, pr) {
    const v = VANNER[this.n % VANNER.length];
    this.n++;
    const dir = this.n % 2 ? 1 : -1;
    const y = pr.y + pr.h * (0.2 + ((this.n * 37) % 20) / 100);
    this.c = { ...v, t: 0, dur: 3.6, dir, x0: dir > 0 ? -30 : W + 30, x1: dir > 0 ? W + 30 : -30, y0: y, x: dir > 0 ? -30 : W + 30, y, glad: 0 };
    this.trailT = 0.15;
    playNote(5 - (this.n % 3), 0.5);
    this.st?.event('besok', { id: v.id });
  }
  hit(x, y) {
    const c = this.c;
    if (!c || Math.hypot(x - c.x, y - (c.y - c.h * 0.5)) > 40) return false;
    if (c.glad) return true;
    c.glad = 0.001;
    this.hittad = true;
    playSfx('heart');
    playNote(4, 0.45);
    this.p.burst(c.x, c.y - c.h * 0.5, 16, { kind: 'heart', colors: ['#ff9db7', '#ffe17a', '#ffffff'] });
    this.st?.event('besok-hittad', { id: c.id });
    return true;
  }
  draw(ctx, T) {
    const c = this.c;
    if (!c) return;
    const flap = 1 - Math.abs(Math.sin(T * c.flap)) * 0.35;
    blit(ctx, c.id, c.x, c.y, { h: c.h * (c.glad ? 1.15 : 1), face: c.dir > 0 ? 1 : -1, sy: c.id === 'ladybug' ? 1 : flap });
  }
}
