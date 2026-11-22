/**
 * Speltest-krokar (aktiva ENDAST med ?speltest=1). Kontrakt: se /workspace/speltest/HOOKS.md.
 * Utan flaggan är ST === null och alla anrop i spelet blir no-ops (ST?.x()).
 */
const PARAM_ON = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('speltest') === '1';

function skapa() {
  const now = () => performance.now();
  const s = {
    events: [], inputs: [], frames: [], diffs: [],
    cur: { glows: [], hint: null, heroes: [], heroDraws: 0, groundY: null, isWin: false, sprites: [], emoji: [] },
    last: { glows: [], hint: null, heroes: [], heroDraws: 0, groundY: null, isWin: false, sprites: [], emoji: [] },
    hintOn: false, danceSeen: false, sample: null, sampleT: 0, dupHeroFrames: 0, floatWinFrames: 0, winStartedAt: null, whiteBoxFrames: 0, emptyBubbleFrames: 0,
    canvas: null, small: null, sctx: null,
  };
  const SW = 96, SH = 48;

  function ev(kind, data) {
    const e = { t: now(), kind, ...(data || {}) };
    if (s.events.length < 40000) s.events.push(e);
    if (['sfx', 'note', 'burst', 'progress', 'win', 'celebrate'].includes(kind)) {
      // koppla till senaste input utan svar (< 500 ms)
      for (let i = s.inputs.length - 1; i >= 0; i--) {
        const inp = s.inputs[i];
        if (e.t - inp.t > 500) break;
        if (inp.respT == null) { inp.respT = e.t; inp.respKind = kind + (data && data.name ? ':' + data.name : ''); }
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

  function hasWhiteBox(px) {
    if (!px) return 0;
    const lum = (x, y) => { const i = (y * SW + x) * 4; return (px[i] + px[i + 1] + px[i + 2]) / 3; };
    const isBox = (x, y) => {
      const i = (y * SW + x) * 4;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      return r >= 235 && g >= 225 && b >= 205 && (Math.max(r, g, b) - Math.min(r, g, b)) <= 45;
    };
    const rows = [];
    for (let y = 6; y < 20; y++) {
      let run = 0, maxRun = 0, xs = 0, xa = 0, xb = 0;
      for (let x = 18; x < 78; x++) {
        if (isBox(x, y)) {
          if (run === 0) xs = x;
          run++;
          if (run > maxRun) { maxRun = run; xa = xs; xb = x; }
        } else run = 0;
      }
      if (maxRun >= 18) {
        let mn = 255, mx = 0, sum = 0;
        const n = xb - xa + 1;
        for (let x = xa; x <= xb; x++) { const l = lum(x, y); mn = Math.min(mn, l); mx = Math.max(mx, l); sum += l; }
        if (mx - mn < 16) {
          const avg = sum / n;
          let above = 255, below = 255;
          for (const dy of [2, 3, 4]) {
            let sa = 0, sb = 0;
            for (let x = xa; x <= xb; x++) { sa += lum(x, Math.max(0, y - dy)); sb += lum(x, Math.min(SH - 1, y + dy)); }
            above = Math.min(above, sa / n);
            below = Math.min(below, sb / n);
          }
          if (avg - above > 22 && avg - below > 22) rows.push({ y, maxRun });
        }
      }
    }
    let best = 0;
    if (rows.length >= 2) {
      for (const r of rows) best = Math.max(best, r.maxRun);
    }
    return best;
  }

  const BW = 240, BH = 120;
  function takeBubbleSample() {
    if (!s.canvas) return null;
    if (!s.bcv) {
      s.bcv = document.createElement('canvas');
      s.bcv.width = BW; s.bcv.height = BH;
      s.bctx = s.bcv.getContext('2d', { willReadFrequently: true });
    }
    s.bctx.drawImage(s.canvas, 0, 0, BW, BH);
    return s.bctx.getImageData(0, 0, BW, BH).data;
  }

  // Cream speech bubble with no icon inside (star / berry / acorn). Uses a
  // 240×120 sample because a 32 px bubble is only ~3 px on the 96×48 grid.
  // Tight ellipse + compactness cuts keep fluffy clouds from matching.
  function hasEmptyBubble(px) {
    if (!px) return 0;
    const at = (x, y) => {
      const i = (y * BW + x) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    };
    const isCream = (x, y) => {
      const [r, g, b] = at(x, y);
      return r >= 245 && g >= 240 && b >= 220 && (Math.max(r, g, b) - Math.min(r, g, b)) <= 28;
    };
    const isIcon = (x, y) => {
      const [r, g, b] = at(x, y);
      const ch = Math.max(r, g, b) - Math.min(r, g, b);
      if (r >= 245 && g >= 240 && b >= 220 && ch <= 28) return false;
      if (r > 200 && g > 150 && b < 140 && ch > 40) return true;
      if (r > 180 && g < 140 && b < 160 && ch > 40) return true;
      if (r > 90 && r < 200 && g > 40 && g < 140 && b < 90 && ch > 25) return true;
      return false;
    };
    const y0 = Math.floor(BH * 0.16), y1 = Math.floor(BH * 0.40);
    const x0 = Math.floor(BW * 0.18), x1 = Math.floor(BW * 0.50);
    const vis = new Uint8Array(BW * BH);
    const qx = new Int16Array(BW * BH), qy = new Int16Array(BW * BH);
    let found = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (vis[y * BW + x] || !isCream(x, y)) continue;
        let qh = 0, qt = 0;
        qx[qt] = x; qy[qt] = y; qt++;
        vis[y * BW + x] = 1;
        let n = 0, minx = x, maxx = x, miny = y, maxy = y;
        while (qh < qt) {
          const cx = qx[qh], cy = qy[qh]; qh++;
          n++;
          if (cx < minx) minx = cx; if (cx > maxx) maxx = cx;
          if (cy < miny) miny = cy; if (cy > maxy) maxy = cy;
          const nbs = [1, 0, -1, 0, 0, 1, 0, -1];
          for (let k = 0; k < 8; k += 2) {
            const nx = cx + nbs[k], ny = cy + nbs[k + 1];
            if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1 || vis[ny * BW + nx]) continue;
            if (isCream(nx, ny)) { vis[ny * BW + nx] = 1; qx[qt] = nx; qy[qt] = ny; qt++; }
          }
        }
        if (n < 80 || n > 500) continue;
        const bw = maxx - minx + 1, bh = maxy - miny + 1;
        if (bw < 12 || bh < 11 || bw / bh < 0.75 || bw / bh > 1.45) continue;
        if (n / (bw * bh) < 0.70) continue;
        const ix0 = minx + ((bw / 5) | 0), iy0 = miny + ((bh / 5) | 0);
        const ix1 = maxx - ((bw / 5) | 0), iy1 = maxy - ((bh / 5) | 0);
        let icons = 0;
        for (let iy = iy0; iy <= iy1; iy++) {
          for (let ix = ix0; ix <= ix1; ix++) {
            if (isIcon(ix, iy)) icons++;
          }
        }
        if (icons === 0) found = Math.max(found, n);
      }
    }
    return found;
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

  const api = {
    on: true,
    attach(canvas) {
      s.canvas = canvas;
      const cap = (type) => (e) => {
        const r = canvas.getBoundingClientRect();
        const inp = { t: e.timeStamp || now(), type, x: e.clientX - r.left, y: e.clientY - r.top, ptr: e.pointerType };
        if (type === 'down') {
          s.inputs.push(inp);
          const before = s.sample;
          const gx = (inp.x / r.width) * SW, gy = (inp.y / r.height) * SH;
          setTimeout(() => {
            const after = takeSample();
            inp.regionDiff = diffFrac(before, after, gx, gy, 9);
          }, 300);
        } else if (type === 'up') {
          const d = s.inputs[s.inputs.length - 1];
          if (d) { d.upT = inp.t; d.ux = inp.x; d.uy = inp.y; }
        }
      };
      canvas.addEventListener('pointerdown', cap('down'), { capture: true });
      canvas.addEventListener('pointerup', cap('up'), { capture: true });
    },
    event: ev,
    sfx(name, audible) { ev('sfx', { name, audible: !!audible }); },
    glow(x, y, r) { s.cur.glows.push({ x, y, r }); },
    hint(ax, ay, bx, by, opt) { s.cur.hint = { ax, ay, bx: bx ?? null, by: by ?? null, hallMs: (opt && opt.hallMs) || null }; },
    setGround(groundY, isWin) {
      s.cur.groundY = groundY;
      s.cur.isWin = !!isWin;
      if (isWin && s.winStartedAt == null) s.winStartedAt = now();
      if (!isWin) s.winStartedAt = null;
    },
    hero(who, x, y, w, h, pose, footY) {
      s.cur.heroDraws++;
      s.cur.heroes.push({ who, x: x - w / 2, y: y - h, w, h, pose, footY: footY ?? y });
      if (pose === 'dans' && !s.danceSeen) { s.danceSeen = true; ev('dance'); }
    },
    sprite(name, x, y, w, h) { s.cur.sprites.push({ name, x: x - w / 2, y: y - h, w, h }); },
    emoji(txt, x, y) { s.cur.emoji.push({ txt, x, y }); },
    frameStart() {
      s.cur = { glows: [], hint: null, heroes: [], heroDraws: 0, groundY: null, isWin: false, sprites: [], emoji: [] };
    },
    frameEnd() {
      const t = now();
      s.frames.push(t);
      if (s.cur.heroDraws > 0) {
        const cnt = {};
        for (const h of s.cur.heroes) cnt[h.who] = (cnt[h.who] || 0) + 1;
        if (s.cur.heroDraws > 2 || Object.values(cnt).some((c) => c > 1)) {
          s.dupHeroFrames++;
          ev('dup-hero', { heroDraws: s.cur.heroDraws, cnt });
        }
        if (s.cur.isWin && s.cur.groundY != null && s.winStartedAt != null && (t - s.winStartedAt) > 900) {
          const bad = s.cur.heroes.filter((h) => Math.abs(h.footY - s.cur.groundY) > 14);
          if (bad.length) {
            s.floatWinFrames++;
            ev('float-win', { groundY: Math.round(s.cur.groundY), feet: bad.map((b) => Math.round(b.footY)) });
          }
        }
      }
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
        if (cur) {
          const wb = hasWhiteBox(cur);
          if (wb > 0) { s.whiteBoxFrames++; ev('white-box', { w: wb }); }
          const eb = hasEmptyBubble(takeBubbleSample());
          if (eb > 0) { s.emptyBubbleFrames++; ev('empty-bubble', { n: eb }); }
          if (s.sample) s.diffs.push({ t, d: diffFrac(s.sample, cur) });
        }
        s.sample = cur;
        s.sampleT = t;
      }
    },
    levelStart(id) { s.danceSeen = false; s.winStartedAt = null; ev('level-start', { id }); },
    targets() { return JSON.parse(JSON.stringify(s.last)); },
    dump() {
      return JSON.parse(JSON.stringify({
        now: now(), events: s.events, inputs: s.inputs, frames: s.frames, diffs: s.diffs, last: s.last, dupHeroFrames: s.dupHeroFrames, floatWinFrames: s.floatWinFrames, whiteBoxFrames: s.whiteBoxFrames, emptyBubbleFrames: s.emptyBubbleFrames,
      }));
    },
    reset() { s.events = []; s.inputs = []; s.frames = []; s.diffs = []; s.dupHeroFrames = 0; s.floatWinFrames = 0; s.winStartedAt = null; s.whiteBoxFrames = 0; s.emptyBubbleFrames = 0; },
  };

  // Emoji ritade som spelgrafik på canvas
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
