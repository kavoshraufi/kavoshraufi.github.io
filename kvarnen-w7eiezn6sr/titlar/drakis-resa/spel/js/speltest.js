/**
 * Speltest-krokar för Drakis resa (aktiva ENDAST med ?speltest=1).
 * Kontrakt: /workspace/speltest/HOOKS.md (kvarnen-speltest-v1) + Drakis-mått (tiles, screenPct, palette, goalState).
 * Utan ?speltest=1 är ST === null och alla anrop blir billiga ST?.x() no-ops.
 */
const PARAM_ON = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('speltest') === '1';

function skapa() {
  const now = () => performance.now();
  const s = {
    events: [], inputs: [], frames: [], diffs: [],
    cur: { glows: [], hint: null, heroes: [], sprites: [], emoji: [] },
    last: { glows: [], hint: null, heroes: [], sprites: [], emoji: [] },
    hintOn: false, danceSeen: false, sample: null, sampleT: 0,
    canvas: null, inputRoot: null, small: null, sctx: null,
    tilePx: null, lastTilePx: null,
    palette: {}, goalState: null,
    _palCanvas: null, _palCtx: null, _lastPalKey: '',
  };
  const SW = 96, SH = 48;

  function ev(kind, data) {
    const e = { t: now(), kind, ...(data || {}) };
    if (s.events.length < 40000) s.events.push(e);
    if (['sfx', 'note', 'burst', 'progress', 'win', 'celebrate'].includes(kind)) {
      for (let i = s.inputs.length - 1; i >= 0; i--) {
        const inp = s.inputs[i];
        if (e.t - inp.t > 550) break;
        if (inp.respT == null) {
          inp.respT = e.t;
          inp.respKind = kind + (data && data.name ? ':' + data.name : '');
        }
        if (kind === 'progress' || kind === 'win') inp.progress = true;
        break;
      }
    }
  }

  function takeSample() {
    if (!s.canvas) return null;
    if (!s.small) {
      s.small = document.createElement('canvas');
      s.small.width = SW; s.small.height = SH;
      s.sctx = s.small.getContext('2d', { willReadFrequently: true });
    }
    s.sctx.drawImage(s.canvas, 0, 0, SW, SH);
    return s.sctx.getImageData(0, 0, SW, SH).data;
  }

  function diffFrac(a, b, cx, cy, rad) {
    if (!a || !b) return 0;
    let ch = 0, tot = 0;
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        if (rad != null && Math.hypot(x - cx, y - cy) > rad) continue;
        const i = (y * SW + x) * 4;
        tot++;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) ch++;
      }
    }
    return tot ? ch / tot : 0;
  }

  function sampleImagePalette(name, img) {
    if (!img || !img.width || !img.height) return null;
    const key = `${name}:${img.width}x${img.height}`;
    if (s.palette[name] && s._lastPalKey === key) return s.palette[name];
    s._lastPalKey = key;
    if (!s._palCanvas) {
      s._palCanvas = document.createElement('canvas');
      s._palCtx = s._palCanvas.getContext('2d', { willReadFrequently: true });
    }
    const w = Math.min(64, img.width), h = Math.min(64, img.height);
    s._palCanvas.width = w; s._palCanvas.height = h;
    s._palCtx.clearRect(0, 0, w, h);
    s._palCtx.drawImage(img, 0, 0, w, h);
    const data = s._palCtx.getImageData(0, 0, w, h).data;
    const counts = new Map();
    let opaque = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      opaque++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      rSum += r; gSum += g; bSum += b;
      const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex, n]) => ({ hex, frac: +(n / Math.max(1, opaque)).toFixed(3) }));
    const info = {
      name,
      srcW: img.width,
      srcH: img.height,
      uniqueColors: counts.size,
      opaquePixels: opaque,
      meanRgb: opaque ? [Math.round(rSum / opaque), Math.round(gSum / opaque), Math.round(bSum / opaque)] : null,
      topColors: top,
    };
    s.palette[name] = info;
    return info;
  }

  const api = {
    on: true,
    attach(canvas, inputRoot) {
      s.canvas = canvas;
      s.inputRoot = inputRoot || canvas;
      const target = s.inputRoot;
      const cap = (type) => (e) => {
        const r = canvas.getBoundingClientRect();
        const inp = { t: e.timeStamp || now(), type, x: e.clientX, y: e.clientY, cx: e.clientX - r.left, cy: e.clientY - r.top, ptr: e.pointerType };
        if (type === 'down') {
          s.inputs.push(inp);
          const before = s.sample;
          const gx = ((e.clientX - r.left) / Math.max(1, r.width)) * SW;
          const gy = ((e.clientY - r.top) / Math.max(1, r.height)) * SH;
          setTimeout(() => {
            const after = takeSample();
            inp.regionDiff = (gx >= 0 && gx < SW && gy >= 0 && gy < SH) ? diffFrac(before, after, gx, gy, 10) : diffFrac(before, after);
          }, 300);
        } else if (type === 'up') {
          const d = s.inputs[s.inputs.length - 1];
          if (d) { d.upT = inp.t; d.ux = inp.x; d.uy = inp.y; }
        }
      };
      target.addEventListener('pointerdown', cap('down'), { capture: true });
      target.addEventListener('pointerup', cap('up'), { capture: true });
    },
    event: ev,
    sfx(name, audible) { ev('sfx', { name, audible: !!audible }); },
    glow(x, y, r) { s.cur.glows.push({ x, y, r }); },
    hint(ax, ay, bx, by, opt) {
      s.cur.hint = {
        ax, ay,
        bx: bx ?? null, by: by ?? null,
        hallMs: (opt && opt.hallMs) || null,
        kombo: !!(opt && opt.kombo),
        tapDelay: (opt && opt.tapDelay) || null,
      };
    },
    setTilePx(px) {
      s.tilePx = px;
      if (s.lastTilePx == null || Math.abs(px - s.lastTilePx) > 0.5) {
        s.lastTilePx = px;
        ev('tile', { px: Math.round(px * 100) / 100 });
      }
    },
    hero(who, cx, bottom, w, h, pose, extra) {
      const vw = (typeof innerWidth !== 'undefined' && innerWidth) || 1;
      const vh = (typeof innerHeight !== 'undefined' && innerHeight) || 1;
      const tpx = s.tilePx || 32;
      const obj = {
        who,
        x: cx - w / 2,
        y: bottom - h,
        w,
        h,
        pose,
        tiles: { w: +(w / tpx).toFixed(3), h: +(h / tpx).toFixed(3) },
        screenPct: { w: +(w / vw).toFixed(4), h: +(h / vh).toFixed(4) },
        tilePx: +(tpx).toFixed(2),
        ...(extra || {}),
      };
      s.cur.heroes.push(obj);
      if (pose === 'dans' && !s.danceSeen) { s.danceSeen = true; ev('dance'); }
    },
    sprite(name, cx, bottom, w, h) { s.cur.sprites.push({ name, x: cx - w / 2, y: bottom - h, w, h }); },
    emoji(txt, x, y) { s.cur.emoji.push({ txt, x, y }); },
    paletteSample: sampleImagePalette,
    setGoalState(st) { s.goalState = st; },
    frameStart() {
      s.cur = { glows: [], hint: null, heroes: [], sprites: [], emoji: [] };
    },
    frameEnd() {
      const t = now();
      s.frames.push(t);
      if (s.frames.length > 20000) s.frames.splice(0, 5000);
      const hv = !!s.cur.hint;
      if (hv && !s.hintOn) ev('hint-on', { ...s.cur.hint });
      if (!hv && s.hintOn) ev('hint-off');
      s.hintOn = hv;
      s.last = s.cur;
      for (const inp of s.inputs) {
        if (inp.respT != null && inp.paintT == null && t >= inp.respT) inp.paintT = t;
      }
      if (t - s.sampleT >= 250) {
        const cur = takeSample();
        if (cur && s.sample) s.diffs.push({ t, d: diffFrac(s.sample, cur) });
        s.sample = cur;
        s.sampleT = t;
      }
    },
    levelStart(id) { s.danceSeen = false; ev('level-start', { id }); },
    targets() {
      return JSON.parse(JSON.stringify({
        ...s.last,
        tilePx: s.tilePx,
        palette: s.palette,
        goalState: s.goalState,
      }));
    },
    dump() {
      return JSON.parse(JSON.stringify({
        now: now(),
        events: s.events,
        inputs: s.inputs,
        frames: s.frames,
        diffs: s.diffs,
        last: s.last,
        tilePx: s.tilePx,
        palette: s.palette,
        goalState: s.goalState,
      }));
    },
    reset() { s.events = []; s.inputs = []; s.frames = []; s.diffs = []; },
  };

  const orig = CanvasRenderingContext2D.prototype.fillText;
  const EMO = /\p{Extended_Pictographic}/u;
  CanvasRenderingContext2D.prototype.fillText = function (txt, x, y, ...rest) {
    if (this.canvas === s.canvas && typeof txt === 'string' && EMO.test(txt)) api.emoji(txt, x, y);
    return orig.call(this, txt, x, y, ...rest);
  };
  return api;
}

export const ST = PARAM_ON ? skapa() : null;
if (ST && typeof window !== 'undefined') window.__speltest = ST;
