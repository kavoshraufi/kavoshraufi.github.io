/**
 * Poolad partikelmotor — inga allokeringar i den varma loopen.
 */
export class PartikelLag {
  constructor(canvas, { max = 160 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.max = max;
    this.pool = new Array(max);
    for (let i = 0; i < max; i++) this.pool[i] = this._tom();
    this.levande = 0;
    this._raf = 0;
    this._sista = 0;
    this.auto = false;
  }

  _tom() {
    return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, r: 1, a: 1, cr: 244, cg: 234, cb: 210 };
  }

  _nasta() {
    for (let i = 0; i < this.max; i++) {
      if (!this.pool[i].alive) return this.pool[i];
    }
    return null;
  }

  emit({ x, y, vx = 0, vy = 0, life = 1, r = 1.4, color = { r: 244, g: 234, b: 210 }, a = 0.7, n = 1, sprid = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const p = this._nasta();
      if (!p) return;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * sprid;
      p.y = y + (Math.random() - 0.5) * sprid;
      p.vx = vx + (Math.random() - 0.5) * sprid * 0.05;
      p.vy = vy + (Math.random() - 0.5) * sprid * 0.05;
      p.life = life * (0.7 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.r = r * (0.6 + Math.random() * 0.8);
      p.a = a;
      p.cr = color.r;
      p.cg = color.g;
      p.cb = color.b;
    }
  }

  /** Litet damm när en sida landar. */
  bursta(x, y, riktning = -1) {
    this.emit({
      x,
      y,
      vx: riktning * 40,
      vy: -20,
      life: 0.7,
      r: 1.6,
      n: 18,
      sprid: 28,
      a: 0.55,
      color: { r: 210, g: 190, b: 150 },
    });
  }

  /** Långsamma dammkorn i luften. */
  motes(bredd, hojd, n = 1) {
    for (let i = 0; i < n; i++) {
      this.emit({
        x: Math.random() * bredd,
        y: Math.random() * hojd,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.4) * 6,
        life: 4 + Math.random() * 6,
        r: 0.8 + Math.random(),
        a: 0.25,
        color: { r: 255, g: 250, b: 230 },
      });
    }
  }

  update(dt) {
    const g = 18;
    let levande = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += g * dt * 0.15;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      levande += 1;
    }
    this.levande = levande;
  }

  draw() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${p.a * t})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  start() {
    if (this.auto) return;
    this.auto = true;
    this._sista = performance.now();
    const tick = (now) => {
      if (!this.auto) return;
      const dt = Math.min(0.05, (now - this._sista) / 1000);
      this._sista = now;
      this.update(dt);
      this.draw();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    this.auto = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  storlek(cssW, cssH, dpr = Math.min(2, window.devicePixelRatio || 1)) {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
