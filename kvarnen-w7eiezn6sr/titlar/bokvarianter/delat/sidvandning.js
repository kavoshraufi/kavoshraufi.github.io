/**
 * Sidvändning, nivå 2: canvas-böj som följer fingret, fjäderfysik, dynamisk skugga.
 * Nivå 1 (CSS 3D rotateY) som reserv. prefers-reduced-motion ger övertoning.
 * PageSound: lyft, friktion kopplad till hastighet, flip och lager-landning.
 */
import { reduceradRorelse } from './skarmovergangar.js';
import { klamp } from './ljudmotor.js';

const STYV = 0.0028;
const DAMP = 0.86;
const GRAB = 0.18;

export class PageSound {
  constructor(ljud) {
    this.ljud = ljud;
    this._aktiv = false;
  }

  lyft() {
    if (!this.ljud) return;
    this.ljud.play('sida-lyft', { buss: 'sfx', volume: 0.72 });
  }

  flip() {
    if (!this.ljud) return;
    this.ljud.play('sida-flip', { buss: 'sfx', volume: 0.92 });
  }

  landning() {
    if (!this.ljud) return;
    this.ljud.play('sida-landning', { buss: 'sfx', volume: 0.8 });
    setTimeout(() => {
      this.ljud.play('sida-landning', { buss: 'sfx', volume: 0.32, rate: 0.9, volJitter: 1.2 });
    }, 45);
  }

  friktion(hastighet) {
    if (!this.ljud) return;
    const level = klamp((hastighet - 0.03) / 0.55, 0, 1);
    if (level < 0.04) {
      if (this._aktiv) {
        this.ljud.setLoop('sida-friktion', { volume: 0, fade: 0.08 });
        this._aktiv = false;
      }
      return;
    }
    if (!this._aktiv) {
      this.ljud.startLoop('sida-friktion', 'sida-friktion', {
        buss: 'sfx',
        volume: 0,
        fade: 0.05,
        rate: 0.9,
      });
      this._aktiv = true;
    }
    this.ljud.setLoop('sida-friktion', {
      volume: 0.12 + 0.7 * level,
      rate: 0.82 + 0.55 * level,
      fade: 0.04,
    });
  }

  tyst() {
    if (!this.ljud) return;
    this.ljud.stopLoop('sida-friktion', { fade: 0.08 });
    this._aktiv = false;
  }
}

export class Sidvandning {
  constructor(host, {
    sidor = [],
    startIndex = 0,
    ljud = null,
    partiklar = null,
    niva = 2,
    reduced,
  } = {}) {
    this.host = host;
    this.sidor = sidor;
    this.index = startIndex % 2 === 0 ? startIndex : startIndex - 1;
    this.ljud = ljud;
    this.ljudlager = new PageSound(ljud);
    this.partiklar = partiklar;
    this.onskadNiva = niva;
    this._forcedReduced = reduced;
    this.dragging = false;
    this.animating = false;
    this.dir = 1;
    this.tipX = 0;
    this.tipY = 0;
    this.vx = 0;
    this.vy = 0;
    this.grabY = 0;
    this.target = 0;
    this._pekId = null;
    this._sistaT = 0;
    this._raf = 0;
    this._lyftSpelad = false;
    this._flipSpelad = false;
    this.listeners = { flip: [], progress: [], landning: [] };
    this.frameTimes = [];
    this.mataFps = false;
    this._fpsStart = 0;
    this.W = 200;
    this.H = 300;
    this.dpr = 1;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bok-duk';
    this.canvas.setAttribute('data-modul', 'sidvandning');
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    this.cssRot = document.createElement('div');
    this.cssRot.className = 'bok-css3d';
    this.cssRot.innerHTML = `
      <div class="uppslag">
        <div class="sida vanster"></div>
        <div class="sida hoger"><div class="blad"><div class="blad-fram"></div><div class="blad-bak"></div></div></div>
      </div>`;

    host.innerHTML = '';
    host.classList.add('bok-varld');
    host.appendChild(this.canvas);
    host.appendChild(this.cssRot);

    this._onDown = (e) => this._pekNer(e);
    this._onMove = (e) => this._pekDrag(e);
    this._onUp = (e) => this._pekUpp(e);
    host.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    this.host.style.touchAction = 'none';

    this.mode = this._valjMode();
    this.host.dataset.mode = this.mode;
    this._synkaIndex();
    this.resize();
    this.rita();
  }

  _valjMode() {
    if (this._forcedReduced || reduceradRorelse()) return 'fade';
    if (this.onskadNiva <= 1 || !this.ctx) return 'css';
    return 'canvas';
  }

  on(namn, fn) {
    if (this.listeners[namn]) this.listeners[namn].push(fn);
    return () => {
      this.listeners[namn] = (this.listeners[namn] || []).filter((f) => f !== fn);
    };
  }

  _emit(namn, detalj) {
    for (const fn of this.listeners[namn] || []) fn(detalj);
  }

  get progress() {
    const { W } = this;
    if (this.dir === 1) return klamp((2 * W - this.tipX) / (2 * W), 0, 1);
    return klamp(this.tipX / (2 * W), 0, 1);
  }

  get kanFram() {
    return this.index + 2 < this.sidor.length;
  }

  get kanBak() {
    return this.index >= 2;
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(2, r.width);
    const h = Math.max(2, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = w / 2;
    this.H = h;
    if (!this.dragging && !this.animating) this._vilaTip();
    this.rita();
  }

  _vilaTip() {
    const { W, H } = this;
    this.tipX = this.dir === -1 ? 0 : 2 * W;
    this.tipY = H * 0.72;
    this.vx = 0;
    this.vy = 0;
  }

  _synkaIndex() {
    this.host.dataset.spread = String(this.index);
    this.host.dataset.progress = this.progress.toFixed(3);
    this.host.dataset.mode = this.mode;
  }

  sida(i) {
    if (i < 0 || i >= this.sidor.length) return null;
    return this.sidor[i];
  }

  _pekLokal(e) {
    const r = this.host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _pekNer(e) {
    if (this.animating) return;
    const { x, y } = this._pekLokal(e);
    const { W, H } = this;
    let dir = 0;
    if (x > W + W * (1 - GRAB) && this.kanFram) dir = 1;
    else if (x < W * GRAB && this.kanBak) dir = -1;
    if (!dir) return;
    e.preventDefault();
    try {
      (e.target || this.host).setPointerCapture?.(e.pointerId);
    } catch {
      try { this.host.setPointerCapture?.(e.pointerId); } catch { /* */
      }
    }
    this._pekId = e.pointerId;
    this.dir = dir;
    this.dragging = true;
    this.grabY = klamp(y, H * 0.08, H * 0.92);
    this.tipX = dir === 1 ? 2 * W : 0;
    this.tipY = this.grabY;
    this.vx = 0;
    this.vy = 0;
    this._sistaT = performance.now();
    this._lyftSpelad = false;
    this._flipSpelad = false;
    this.ljudlager.lyft();
    this._lyftSpelad = true;
    this._uppdateraTip(x, y, 0);
    this._loop();
  }

  _pekDrag(e) {
    if (!this.dragging || (this._pekId != null && e.pointerId !== this._pekId)) return;
    const now = performance.now();
    const dt = Math.max(1, now - this._sistaT);
    const { x, y } = this._pekLokal(e);
    this._uppdateraTip(x, y, dt);
    this._sistaT = now;
    this.ljudlager.friktion(Math.hypot(this.vx, this.vy));
    this._emit('progress', { progress: this.progress, dir: this.dir });
  }

  _pekUpp(e) {
    if (!this.dragging || (e && this._pekId != null && e.pointerId !== this._pekId)) return;
    this.dragging = false;
    this._pekId = null;
    this.ljudlager.tyst();
    const p = this.progress;
    const v = this.dir === 1 ? -this.vx : this.vx;
    const commit = p > 0.42 || (p > 0.12 && v > 0.35);
    this.target = commit ? 1 : 0;
    if (commit && !this._flipSpelad) {
      this.ljudlager.flip();
      this._flipSpelad = true;
    }
    this.animating = true;
    this._loop();
  }

  _uppdateraTip(x, y, dt) {
    const { W, H } = this;
    const clamped = this._klampTip(x, y);
    if (dt > 0) {
      this.vx = (clamped.x - this.tipX) / dt;
      this.vy = (clamped.y - this.tipY) / dt;
    }
    this.tipX = clamped.x;
    this.tipY = clamped.y;
    void W;
    void H;
  }

  _klampTip(x, y) {
    const { W, H } = this;
    const cy = this.grabY;
    if (this.dir === 1) {
      let fx = Math.min(2 * W, x);
      let fy = klamp(y, -H * 0.1, H * 1.1);
      const cx = 2 * W;
      // cirkel kring ryggen på högersidan (W, cy) med radie 2W så tippen når vänsterkant
      const dx = fx - W;
      const dy = fy - cy;
      const dist = Math.hypot(dx, dy);
      const maxd = 2 * W - 1;
      if (dist > maxd) {
        fx = W + (dx / dist) * maxd;
        fy = cy + (dy / dist) * maxd;
      }
      if ((cx + fx) / 2 < 0) fx = -cx;
      fx = Math.max(0, fx);
      void cx;
      return { x: fx, y: fy };
    }
    let fx = Math.max(0, x);
    let fy = klamp(y, -H * 0.1, H * 1.1);
    const dx = fx - W;
    const dy = fy - cy;
    const dist = Math.hypot(dx, dy);
    const maxd = 2 * W - 1;
    if (dist > maxd) {
      fx = W + (dx / dist) * maxd;
      fy = cy + (dy / dist) * maxd;
    }
    fx = Math.min(2 * W, fx);
    return { x: fx, y: fy };
  }

  _loop() {
    if (this._raf) return;
    const steg = (now) => {
      this._raf = 0;
      if (this.mataFps) this.frameTimes.push(now);
      if (this.animating && !this.dragging) this._fysik(now);
      this.rita();
      this._synkaIndex();
      if (this.dragging || this.animating || this.mataFps) {
        this._raf = requestAnimationFrame(steg);
      }
    };
    this._raf = requestAnimationFrame(steg);
  }

  _fysik(now) {
    const dt = Math.min(32, now - (this._sistaT || now));
    this._sistaT = now;
    const mal = this._malTip();
    this.vx += (mal.x - this.tipX) * STYV * dt;
    this.vy += (mal.y - this.tipY) * STYV * dt;
    const damp = Math.pow(DAMP, dt / 16);
    this.vx *= damp;
    this.vy *= damp;
    this.tipX += this.vx * dt;
    this.tipY += this.vy * dt;
    const dist = Math.hypot(mal.x - this.tipX, mal.y - this.tipY);
    const speed = Math.hypot(this.vx, this.vy);
    if (this.target === 1 && this.progress > 0.55 && !this._flipSpelad) {
      this.ljudlager.flip();
      this._flipSpelad = true;
    }
    if (dist < 2.2 && speed < 0.06) {
      this.tipX = mal.x;
      this.tipY = mal.y;
      this.vx = 0;
      this.vy = 0;
      this.animating = false;
      this._land();
    }
  }

  _malTip() {
    const { W, H } = this;
    const y = this.grabY || H * 0.72;
    if (this.dir === 1) {
      return this.target === 1 ? { x: 0, y } : { x: 2 * W, y };
    }
    return this.target === 1 ? { x: 2 * W, y } : { x: 0, y };
  }

  _land() {
    const commit = this.target === 1;
    this.ljudlager.tyst();
    this.ljudlager.landning();
    if (commit) {
      const fran = this.index;
      this.index += this.dir * 2;
      if (this.partiklar) {
        const x = this.dir === 1 ? this.W * 0.25 : this.W * 1.75;
        this.partiklar.bursta(x, this.H * 0.75, this.dir);
      }
      this._emit('flip', { fran, till: this.index, dir: this.dir });
    }
    this._emit('landning', { index: this.index, commit });
    this.dir = 1;
    this._vilaTip();
    this._flipSpelad = false;
    this.rita();
    this._synkaIndex();
  }

  startFps() {
    this.frameTimes = [];
    this.mataFps = true;
    this._fpsStart = performance.now();
    this._loop();
  }

  stopFps() {
    this.mataFps = false;
    const times = this.frameTimes.slice();
    this.frameTimes = [];
    if (times.length < 2) return { fps: 0, minFps: 0, frames: times.length, ms: 0 };
    const dts = [];
    for (let i = 1; i < times.length; i++) dts.push(times[i] - times[i - 1]);
    const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
    const maxDt = Math.max(...dts);
    return {
      fps: 1000 / avg,
      minFps: 1000 / maxDt,
      frames: dts.length,
      ms: times[times.length - 1] - times[0],
    };
  }

  /** Programmatisk vändning (för tester och knappar). */
  vänd(dir = 1) {
    if (this.dragging || this.animating) return false;
    if (dir > 0 && !this.kanFram) return false;
    if (dir < 0 && !this.kanBak) return false;
    this.dir = dir > 0 ? 1 : -1;
    this._vilaTip();
    this.grabY = this.H * 0.7;
    this.tipY = this.grabY;
    this.target = 1;
    this.animating = true;
    this._flipSpelad = false;
    this.ljudlager.lyft();
    // ge en liten initial hastighet inåt
    this.vx = this.dir === 1 ? -1.2 : 1.2;
    this._sistaT = performance.now();
    this._loop();
    return true;
  }

  hoppaTill(index) {
    const i = Math.max(0, Math.min(this.sidor.length - 1, index));
    this.index = i % 2 === 0 ? i : i - 1;
    this.animating = false;
    this.dragging = false;
    this._vilaTip();
    this.rita();
    this._synkaIndex();
  }

  rita() {
    const canvasOn = this.mode === 'canvas';
    this.canvas.style.opacity = canvasOn ? '1' : '0';
    this.cssRot.style.opacity = canvasOn ? '0' : '1';
    this.cssRot.style.pointerEvents = 'none';
    if (canvasOn) this._ritaCanvas();
    else this._ritaCss();
  }

  _ritaCanvas() {
    const ctx = this.ctx;
    const { W, H } = this;
    ctx.clearRect(0, 0, W * 2, H);
    const left = this.sida(this.index);
    const right = this.sida(this.index + 1);
    const nextLeft = this.sida(this.index + 2);
    const nextRight = this.sida(this.index + 3);
    const prevLeft = this.sida(this.index - 2);
    const prevRight = this.sida(this.index - 1);

    const aktiv = this.dragging || this.animating;
    const p = this.progress;

    if (!aktiv || p < 0.004) {
      this._ritaSida(ctx, left, 0, 0, W, H);
      this._ritaSida(ctx, right, W, 0, W, H);
      this._rygg(ctx, W, H);
      return;
    }

    if (this.dir === 1) {
      this._ritaSida(ctx, left, 0, 0, W, H);
      this._ritaSida(ctx, nextRight || this._tomPapper(), W, 0, W, H);
      this._rygg(ctx, W, H);
      this._veck(ctx, {
        C: { x: 2 * W, y: this.grabY },
        F: { x: this.tipX, y: this.tipY },
        fram: right,
        bak: nextLeft || this._tomPapper(),
        sidaX: W,
      });
    } else {
      this._ritaSida(ctx, prevLeft || this._tomPapper(), 0, 0, W, H);
      this._ritaSida(ctx, right, W, 0, W, H);
      this._rygg(ctx, W, H);
      this._veck(ctx, {
        C: { x: 0, y: this.grabY },
        F: { x: this.tipX, y: this.tipY },
        fram: left,
        bak: prevRight || this._tomPapper(),
        sidaX: 0,
      });
    }
  }

  _tomPapper() {
    return null;
  }

  _ritaSida(ctx, img, x, y, w, h) {
    if (img && (img instanceof HTMLCanvasElement || img instanceof HTMLImageElement || img instanceof OffscreenCanvas || (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap))) {
      ctx.drawImage(img, x, y, w, h);
      return;
    }
    ctx.fillStyle = '#f3e6c8';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(80,50,20,0.18)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  _rygg(ctx, W, H) {
    const g = ctx.createLinearGradient(W - 10, 0, W + 10, 0);
    g.addColorStop(0, 'rgba(40,24,10,0)');
    g.addColorStop(0.45, 'rgba(40,24,10,0.18)');
    g.addColorStop(0.5, 'rgba(40,24,10,0.28)');
    g.addColorStop(0.55, 'rgba(40,24,10,0.18)');
    g.addColorStop(1, 'rgba(40,24,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W - 10, 0, 20, H);
  }

  /**
   * Veck enligt mittpunktsnormalen till CF, med skugga mot underlaget och böjglans vid vecket.
   */
  _veck(ctx, { C, F, fram, bak, sidaX }) {
    const { W, H } = this;
    const dx = C.x - F.x;
    const dy = C.y - F.y;
    const len = Math.hypot(dx, dy);
    if (len < 1.5) {
      this._ritaSida(ctx, fram, sidaX, 0, W, H);
      return;
    }
    const mx = (C.x + F.x) / 2;
    const my = (C.y + F.y) / 2;
    const nx = dx / len;
    const ny = dy / len;

    const kvar = this._klippHalvplan(sidaX, 0, W, H, mx, my, nx, ny, false);
    const lyft = this._klippHalvplan(sidaX, 0, W, H, mx, my, nx, ny, true);
    const flik = lyft.map(([px, py]) => this._speglaPunkt(px, py, mx, my, nx, ny));

    if (kvar.length >= 3) {
      ctx.save();
      this._bana(ctx, kvar);
      ctx.clip();
      this._ritaSida(ctx, fram, sidaX, 0, W, H);
      ctx.restore();
    }

    // Skugga på underlaget, F-sidan av vecket
    const under = this._klippHalvplan(0, 0, W * 2, H, mx, my, nx, ny, false);
    // F är på negativa N (N pekar mot C). Underlaget som friläggs är F-sidan = negativa N = keepPositive false... 
    // Vänta: frilagt underlag är den lyfta sidan, alltså C? Nej: när bladet lyfts syns underlaget där bladet var (C-sidan / högra kanten).
    // C är ursprungshörnet (högerkant). F är tippen. Underlaget syns på F-sidan av vecket (där papperet inte längre ligger plant).
    // N pekar mot C, så F-sidan är keepPositive=false. Men då överlappar det "kvarvarande plana bladet" som också är keepPositive=false på högersidan.
    // Underlaget syns i (hela uppslaget ∩ F-sida) minus fliken. Vi klipper till F-sida och ritar skugga.
    const skuggomr = this._klippHalvplan(0, 0, W * 2, H, mx, my, nx, ny, true);
    if (skuggomr.length >= 3) {
      ctx.save();
      this._bana(ctx, skuggomr);
      ctx.clip();
      const g2 = ctx.createLinearGradient(mx, my, mx + nx * 80, my + ny * 80);
      g2.addColorStop(0, 'rgba(20,12,6,0.42)');
      g2.addColorStop(0.4, 'rgba(20,12,6,0.16)');
      g2.addColorStop(1, 'rgba(20,12,6,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W * 2, H);
      ctx.restore();
    }

    if (flik.length >= 3) {
      ctx.save();
      this._bana(ctx, flik);
      ctx.fillStyle = '#efe3c4';
      ctx.fill();
      ctx.clip();
      ctx.save();
      this._speglaOver(ctx, mx, my, nx, ny);
      ctx.translate(sidaX + W / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(sidaX + W / 2), 0);
      this._ritaSida(ctx, bak, sidaX, 0, W, H);
      ctx.fillStyle = 'rgba(60, 40, 20, 0.10)';
      ctx.fillRect(sidaX, 0, W, H);
      ctx.restore();
      ctx.restore();
    }

    const rind = Math.min(34, 10 + len * 0.05);
    ctx.save();
    const glans = ctx.createLinearGradient(mx - nx * rind, my - ny * rind, mx + nx * rind, my + ny * rind);
    glans.addColorStop(0, 'rgba(0,0,0,0)');
    glans.addColorStop(0.38, 'rgba(40,24,10,0.20)');
    glans.addColorStop(0.5, 'rgba(255,248,230,0.30)');
    glans.addColorStop(0.62, 'rgba(40,24,10,0.24)');
    glans.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = glans;
    ctx.lineWidth = rind * 2;
    ctx.lineCap = 'butt';
    const tx = -ny;
    const ty = nx;
    ctx.beginPath();
    ctx.moveTo(mx - tx * (H * 1.4), my - ty * (H * 1.4));
    ctx.lineTo(mx + tx * (H * 1.4), my + ty * (H * 1.4));
    ctx.stroke();
    ctx.restore();
    void under;
  }

  _speglaPunkt(px, py, mx, my, nx, ny) {
    const d = (px - mx) * nx + (py - my) * ny;
    return [px - 2 * d * nx, py - 2 * d * ny];
  }

  _bana(ctx, poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  }

  /** Konvext klipp av rektangel mot halvplan längs normalen N genom M. */
  _klippHalvplan(x, y, w, h, mx, my, nx, ny, keepPositive) {
    const poly = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
    const inside = (px, py) => {
      const s = (px - mx) * nx + (py - my) * ny;
      return keepPositive ? s >= -0.05 : s <= 0.05;
    };
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const aIn = inside(a[0], a[1]);
      const bIn = inside(b[0], b[1]);
      const hit = this._skarning(a, b, mx, my, nx, ny);
      if (aIn && bIn) out.push(b);
      else if (aIn && !bIn) {
        if (hit) out.push(hit);
      } else if (!aIn && bIn) {
        if (hit) out.push(hit);
        out.push(b);
      }
    }
    return out;
  }

  _speglaOver(ctx, mx, my, nx, ny) {
    const ang = Math.atan2(ny, nx);
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.scale(-1, 1);
    ctx.rotate(-ang);
    ctx.translate(-mx, -my);
  }

  _skarning(a, b, mx, my, nx, ny) {
    const ax = a[0], ay = a[1], bx = b[0], by = b[1];
    const da = (ax - mx) * nx + (ay - my) * ny;
    const db = (bx - mx) * nx + (by - my) * ny;
    if (da * db > 0) return null;
    if (da === db) return null;
    const t = da / (da - db);
    if (t < -0.001 || t > 1.001) return null;
    return [ax + t * (bx - ax), ay + t * (by - ay)];
  }

  _ritaCss() {
    this.canvas.style.opacity = this.mode === 'canvas' ? '1' : '0';
    this.cssRot.style.opacity = this.mode === 'canvas' ? '0' : '1';
    if (this.mode === 'canvas') return;
    const L = this.cssRot.querySelector('.vanster');
    const fram = this.cssRot.querySelector('.blad-fram');
    const bak = this.cssRot.querySelector('.blad-bak');
    const blad = this.cssRot.querySelector('.blad');
    this._cssBakgrund(L, this.sida(this.index));
    if (this.dir === 1 && (this.dragging || this.animating)) {
      this._cssBakgrund(fram, this.sida(this.index + 1));
      this._cssBakgrund(bak, this.sida(this.index + 2));
      const p = this.mode === 'fade' ? Math.round(this.progress) : this.progress;
      blad.style.transform = `rotateY(${-p * 180}deg)`;
      this.cssRot.querySelector('.hoger').style.backgroundImage = this._cssUrl(this.sida(this.index + 3));
    } else if (this.dir === -1 && (this.dragging || this.animating)) {
      this._cssBakgrund(fram, this.sida(this.index));
      this._cssBakgrund(bak, this.sida(this.index - 1));
      // bakåt i CSS är mer begränsad; vi roterar vänsterbladet
      const p = this.mode === 'fade' ? Math.round(this.progress) : this.progress;
      blad.style.transform = `rotateY(${p * 180}deg)`;
    } else {
      this._cssBakgrund(fram, this.sida(this.index + 1));
      this._cssBakgrund(bak, this.sida(this.index + 2));
      blad.style.transform = 'rotateY(0deg)';
      this.cssRot.querySelector('.hoger').style.backgroundImage = 'none';
    }
  }

  _cssUrl(img) {
    if (img && img.toDataURL) return `url(${img.toDataURL('image/jpeg', 0.72)})`;
    return 'none';
  }

  _cssBakgrund(el, img) {
    if (!el) return;
    el.style.backgroundImage = this._cssUrl(img);
    el.style.backgroundSize = 'cover';
  }

  destroy() {
    this.host.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    if (this._raf) cancelAnimationFrame(this._raf);
    this.ljudlager.tyst();
  }
}
