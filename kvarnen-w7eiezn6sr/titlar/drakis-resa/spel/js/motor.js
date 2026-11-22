/* Referensmotor för Drakis resa – gemensam retro-motor kopplad till Kvarnens ljud och spar. */
import { Ljudmotor, renderaOchMata } from '../delat/ljudmotor.js';
import { Spar, monteraBekraftelse } from '../delat/spar.js';
import { ST } from './speltest.js';

export const ljud = new Ljudmotor({ storageKey: 'ak.drakis.volym', basUrl: '' });
export const spar = new Spar({ nyckel: 'drakis-resa-referens', storageKey: 'ak.drakis-resa.referens', autoMs: 8000 });
export { renderaOchMata, monteraBekraftelse };

// Appkvarnens retromotor: Canvas 2D, pixeltypsnitt, chiptune via Web Audio, pek- och tangentbordskontroller.
// Fungerar i en sandlådad iframe: ingen localStorage, inga formulär, inga dialogrutor, inga nätverksanrop.
'use strict';
export const K = (() => {
  let W = 320, H = 180; const TS = 16;
  const K = { W, H, TS, t: 0, held: {}, pressed: {}, manual: false, muted: false, portrait: false, menyOpen: false, canvasScale: 1, canvasRect: { x: 0, y: 0, w: 320, h: 180 }, tapPos: null, playBottom: 0 };
  let fpsBuf = null;
  K.startFps = () => { fpsBuf = { t0: performance.now(), frames: 0, minDt: 1e9, last: performance.now() }; };
  K.stopFps = () => { if (!fpsBuf) return null; const ms = performance.now() - fpsBuf.t0; const out = { fps: fpsBuf.frames * 1000 / Math.max(1, ms), minFps: fpsBuf.frames ? 1000 / fpsBuf.minDt : 0, frames: fpsBuf.frames, ms }; fpsBuf = null; return out; };
  const NAMES = ['left', 'right', 'up', 'down', 'a', 'b', 'start', 'gem'];
  const kb = {}, tp = {}, inj = {}, prevHeld = {};
  NAMES.forEach(n => { kb[n] = tp[n] = inj[n] = prevHeld[n] = false; K.held[n] = K.pressed[n] = false; });
  let screenTapQueued = false;
  K.screenTap = false;
  Object.defineProperty(K, 'startTap', { get() { return !!(K.pressed.a || K.pressed.start || K.screenTap); } });
  function isTouchUI() {
    try {
      if (window.__AK_TOUCH) return true;
      if (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) return true;
      if ('ontouchstart' in window) return true;
      if (window.matchMedia) {
        if (matchMedia('(pointer: coarse)').matches) return true;
        if (matchMedia('(any-pointer: coarse)').matches) return true;
        if (matchMedia('(hover: none)').matches) return true;
      }
      if (Math.min(innerWidth || 0, innerHeight || 0) <= 520 || (innerWidth || 0) <= 820) return true;
    } catch (e) {}
    return false;
  }

  // ---------- Minne (alltid) + localStorage om det finns (try/catch; sandlådan blockerar ofta) ----------
  const memStore = {};
  let ls = null;
  try { ls = window.localStorage; ls.getItem('_ak'); } catch (e) { ls = null; }
  K.mem = {
    get(k, d) {
      if (Object.prototype.hasOwnProperty.call(memStore, k)) return memStore[k];
      try { if (ls) { const v = ls.getItem(k); if (v != null) return (memStore[k] = JSON.parse(v)); } } catch (e) {}
      return d;
    },
    set(k, v) { memStore[k] = v; try { if (ls) ls.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { delete memStore[k]; try { if (ls) ls.removeItem(k); } catch (e) {} }
  };

  // ---------- Sparkod: kopiera/klistra in, plus automatisk lagring när localStorage finns ----------
  K.kodOpen = false;
  let kodCfg = null, kodEl = null, kodPanel = null;
  const kodSum = (s) => { let n = 0; for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0; return n % 9973; };
  K.kod = {
    configure(cfg) { kodCfg = cfg; },
    encode(obj) {
      const json = JSON.stringify(obj);
      return kodCfg.prefix + '-' + btoa(unescape(encodeURIComponent(json))) + '-' + kodSum(json);
    },
    decode(raw) {
      try {
        const m = String(raw || '').trim().replace(/\s+/g, '').match(/^([A-Z]{3,6})-([A-Za-z0-9+/=]+)-(\d+)$/);
        if (!m || m[1] !== kodCfg.prefix) return null;
        const json = decodeURIComponent(escape(atob(m[2])));
        if (kodSum(json) !== +m[3]) return null;
        const o = JSON.parse(json);
        return o && o.v === 1 ? o : null;
      } catch (e) { return null; }
    },
    snapshot() { return kodCfg && kodCfg.snapshot ? kodCfg.snapshot() : null; },
    current() { try { return K.kod.encode(K.kod.snapshot()); } catch (e) { return ''; } },
    save() {
      if (!kodCfg) return;
      try { const o = kodCfg.snapshot(); if (o) K.mem.set(kodCfg.key, o); } catch (e) {}
    },
    hasSave() { return !!(kodCfg && K.kod.decode(K.kod.encode(K.mem.get(kodCfg.key) || { v: 0 }))); },
    saved() { return kodCfg ? K.mem.get(kodCfg.key, null) : null; },
    clearSave() { if (kodCfg) K.mem.del(kodCfg.key); },
    apply(obj) { return kodCfg && kodCfg.restore(obj); },
    applyCode(str) { const o = K.kod.decode(str); if (!o) return false; const ok = kodCfg.restore(o); if (ok !== false) K.mem.set(kodCfg.key, o); return ok !== false; },
    open() { if (kodCfg) openKod(); },
    close() { closeKod(); }
  };
  function kodMsg(t) { const el = document.getElementById('kodmsg'); if (el) el.textContent = t || ''; }
  function fillKodField(code) { const ta = document.getElementById('kodfalt'); if (ta) ta.value = code || ''; }
  function openKod() {
    if (!kodCfg) return;
    K.kodOpen = true;
    if (!kodPanel) {
      kodPanel = document.createElement('div'); kodPanel.id = 'kodpanel';
      kodPanel.innerHTML = '<div class="kodbox"><h2>Sparkod</h2>' +
        '<p>Kopiera koden och klistra in den nästa gång du spelar. Om enheten tillåter lagring sparas också automatiskt.</p>' +
        '<textarea id="kodfalt" rows="5" aria-label="Sparkod" spellcheck="false"></textarea>' +
        '<p id="kodmsg" aria-live="polite"></p>' +
        '<div class="kodbtns">' +
        '<button type="button" id="kodkopiera">Kopiera sparkoden</button>' +
        '<button type="button" id="kodlas">Läs in sparkod</button>' +
        '<button type="button" id="kodfortsatt" class="ghost">Fortsätt sparat spel</button>' +
        '<button type="button" id="kodnytt" class="ghost">Nytt spel</button>' +
        '<button type="button" id="kodstang" class="ghost">Stäng</button></div></div>';
      (document.getElementById('rw') || document.body).appendChild(kodPanel);
      kodPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
      document.getElementById('kodkopiera').addEventListener('click', () => {
        const ta = document.getElementById('kodfalt');
        if (!ta.value) fillKodField(K.kod.current());
        try { ta.focus(); ta.select(); } catch (e) {}
        let ok = false;
        try { ok = document.execCommand && document.execCommand('copy'); } catch (e) {}
        try { if (!ok && navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => kodMsg('Sparkoden är kopierad.'), () => kodMsg('Markera koden och kopiera den själv.')); } catch (e) {}
        if (ok) kodMsg('Sparkoden är kopierad.');
        else if (!navigator.clipboard) kodMsg('Markera koden och kopiera den själv.');
      });
      document.getElementById('kodlas').addEventListener('click', () => {
        const ta = document.getElementById('kodfalt');
        if (K.kod.applyCode(ta.value)) { kodMsg('Sparningen är inläst. Välkommen tillbaka!'); setTimeout(closeKod, 700); }
        else kodMsg('Koden gick inte att läsa. Kontrollera att hela koden kom med.');
      });
      document.getElementById('kodfortsatt').addEventListener('click', () => {
        const o = K.kod.saved();
        if (o && K.kod.apply(o) !== false) { kodMsg('Sparningen är inläst.'); setTimeout(closeKod, 500); }
        else kodMsg('Ingen sparad fil hittades på den här enheten.');
      });
      document.getElementById('kodnytt').addEventListener('click', () => {
        K.kod.clearSave();
        if (kodCfg.fresh) kodCfg.fresh();
        kodMsg('Nytt spel är startat.');
        setTimeout(closeKod, 400);
      });
      document.getElementById('kodstang').addEventListener('click', closeKod);
    }
    kodPanel.hidden = false;
    const saved = K.kod.saved();
    fillKodField(K.kod.current() || (saved ? K.kod.encode(saved) : ''));
    kodMsg('');
    const has = !!saved;
    document.getElementById('kodfortsatt').hidden = !has;
    document.getElementById('kodfalt').focus();
  }
  function closeKod() { K.kodOpen = false; if (kodPanel) kodPanel.hidden = true; }

  // ---------- Hjälpfunktioner ----------
  K.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  K.lerp = (a, b, t) => a + (b - a) * t;
  K.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  let seed = 12345;
  K.seed = s => { seed = s >>> 0 || 1; };
  K.rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  K.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // Sprite från textrader: varje tecken slås upp i paletten, '.' är genomskinligt.
  K.spr = (rows, pal) => {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const c = K.canvas(w, h), g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
    return c;
  };
  K.draw = (w, h, fn) => { const c = K.canvas(w, h), g = c.getContext('2d'); fn(g, (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }); return c; };
  const flipCache = new WeakMap();
  K.flip = c => { let f = flipCache.get(c); if (!f) { f = K.canvas(c.width, c.height); const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); f.hd = c.hd; flipCache.set(c, f); } return f; };
  // Bilder med .hd = true är ritade i dubbel upplösning (2 riktiga px per spelpixel).
  K.sw = c => c.hd ? c.width / 2 : c.width;
  K.sh = c => c.hd ? c.height / 2 : c.height;
  K.blit = (ctx, c, x, y, flip, sc = 1) => {
    const i = flip ? K.flip(c) : c;
    const dw = Math.max(1, Math.round(K.sw(c) * sc));
    const dh = Math.max(1, Math.round(K.sh(c) * sc));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(i, Math.round(x), Math.round(y), dw, dh);
  };
  // Snap a sprite scale so the destination size is a whole logical pixel (nearest-neighbour, no subpixel tween).
  K.snapScale = (c, sc) => {
    if (!c || !sc) return sc || 1;
    const sh = K.sh(c) || 1;
    const dh = Math.max(1, Math.round(sh * sc));
    return dh / sh;
  };
  // Ritar en bild med fötterna/mitten nederst i (cx, bottom)
  K.foot = (ctx, c, cx, bottom, flip, sc = 1) => {
    const dw = Math.max(1, Math.round(K.sw(c) * sc));
    const dh = Math.max(1, Math.round(K.sh(c) * sc));
    K.blit(ctx, c, Math.round(cx - dw / 2), Math.round(bottom - dh), flip, sc);
  };
  // Figur med skugga, gunga, squash/stretch och lutning. origo = fötterna i (cx, bottom).
  K.figure = (ctx, c, cx, bottom, opt = {}) => {
    if (!c) return;
    const sc = opt.sc || 1, img = opt.flip ? K.flip(c) : c;
    const sw = K.sw(c) * sc, sh = K.sh(c) * sc;
    const bob = opt.bob || 0, sx = opt.sx == null ? 1 : opt.sx, sy = opt.sy == null ? 1 : opt.sy;
    const lean = opt.lean || 0, shift = opt.shift || 0;
    const shA = opt.shadow === false || opt.shadow === 0 ? 0 : (opt.shadow == null ? 0.3 : opt.shadow);
    if (shA > 0) {
      const hw = Math.max(5, sw * 0.28 * Math.abs(sx));
      const x0 = Math.round(cx + shift - hw), y0 = Math.round(bottom - 2);
      ctx.fillStyle = 'rgba(0,0,0,' + shA + ')';
      ctx.fillRect(x0, y0, Math.round(hw * 2), 2);
      ctx.fillRect(x0 + 2, y0 - 1, Math.round(hw * 2) - 4, 1);
    }
    ctx.save();
    ctx.translate(Math.round(cx + shift), Math.round(bottom - bob));
    if (lean) ctx.rotate(lean);
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(-sw / 2), Math.round(-sh), Math.max(1, Math.round(sw)), Math.max(1, Math.round(sh)));
    ctx.restore();
  };
  K.img = {};
  // Parallax med spegling: bilden upprepas omväxlande rak och spegelvänd så att skarvarna möts.
  K.parallax = (ctx, c, off, y = 0, alpha = 1) => {
    if (!c) return;
    let lw = K.sw(c), lh = K.sh(c), drawY = y, pan = off;
    if (y === 0 && H > lh + 2) {
      const sc = H / lh;
      lw *= sc; lh *= sc; drawY = H - lh; pan = off * sc;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    const ilw = Math.max(1, Math.round(lw)), ilh = Math.max(1, Math.round(lh)), idy = Math.round(drawY);
    let k = Math.floor(pan / ilw), x = k * ilw - Math.round(pan);
    while (x < W) { ctx.drawImage((k & 1) ? K.flip(c) : c, Math.round(x), idy, ilw, ilh); x += ilw; k++; }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
  };
  K.worldCamY = (worldH) => worldH - H;
  K.chip = (ctx, x, y, text, opt = {}) => {
    const pad = 4, tw = K.textW(text) + pad * 2, th = 11;
    const bg = opt.bg || 'rgba(10,10,30,.65)', bd = opt.bd || 'rgba(255,248,224,.5)';
    K.panel(ctx, x, y, tw, th, bg, bd, bd);
    K.text(ctx, text, x + pad, y + 2, opt.col || '#fff8e0');
    return tw + 6;
  };
  // Laddar inbäddade base64-bilder (data-URL:er, inga nätverksanrop) till canvas med .hd-flagga.
  K.load = (assets) => Promise.all(Object.keys(assets).map(k => new Promise(res => {
    const im = new Image();
    im.onload = () => { const c = K.canvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); c.hd = true; K.img[k] = c; res(); };
    im.onerror = () => { console.warn('kunde inte ladda bild', k); res(); };
    im.src = assets[k];
  })));
  // Färgad variant av en bild (t.ex. för att få fler personer ur samma ark)
  const outCache = new WeakMap();
  K.outline = (c, col = [22, 18, 36]) => {
    if (!c) return c;
    let o = outCache.get(c);
    if (o) return o;
    const w = c.width, h = c.height, pad = 2;
    o = K.canvas(w + pad * 2, h + pad * 2);
    o.hd = c.hd;
    try {
      const sg = c.getContext('2d').getImageData(0, 0, w, h);
      const sd = sg.data;
      const og = o.getContext('2d');
      const od = og.createImageData(w + pad * 2, h + pad * 2);
      const dd = od.data;
      const ow = w + pad * 2, oh = h + pad * 2;
      const [cr, cg, cb] = col;
      for (let y = 0; y < oh; y++) {
        const sy = y - pad;
        for (let x = 0; x < ow; x++) {
          const sx = x - pad;
          const di = (y * ow + x) * 4;
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const si = (sy * w + sx) * 4;
            if (sd[si + 3] >= 90) {
              dd[di] = sd[si]; dd[di + 1] = sd[si + 1]; dd[di + 2] = sd[si + 2]; dd[di + 3] = sd[si + 3];
              continue;
            }
          }
          let hit = false;
          for (let dy = -2; dy <= 2 && !hit; dy++) {
            const ny = sy + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -2; dx <= 2; dx++) {
              if (dx * dx + dy * dy > 4) continue;
              const nx = sx + dx;
              if (nx >= 0 && nx < w && sd[(ny * w + nx) * 4 + 3] >= 120) { hit = true; break; }
            }
          }
          if (hit) { dd[di] = cr; dd[di + 1] = cg; dd[di + 2] = cb; dd[di + 3] = 255; }
        }
      }
      og.putImageData(od, 0, 0);
    } catch (e) {
      o.getContext('2d').drawImage(c, pad, pad);
    }
    outCache.set(c, o);
    return o;
  };
    K.tint = (c, col, amt = 0.5, mode = 'color') => { const t = K.canvas(c.width, c.height), g = t.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = mode; g.globalAlpha = amt; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.drawImage(c, 0, 0); t.hd = c.hd; return t; };

  // ---------- Pixeltypsnitt 5x7 med Å Ä Ö ----------
  const FONT = {
    'A': '.###. #...# #...# ##### #...# #...# #...#', 'B': '####. #...# #...# ####. #...# #...# ####.',
    'C': '.###. #...# #.... #.... #.... #...# .###.', 'D': '####. #...# #...# #...# #...# #...# ####.',
    'E': '##### #.... #.... ####. #.... #.... #####', 'F': '##### #.... #.... ####. #.... #.... #....',
    'G': '.###. #...# #.... #.### #...# #...# .####', 'H': '#...# #...# #...# ##### #...# #...# #...#',
    'I': '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.', 'J': '..### ...#. ...#. ...#. ...#. #..#. .##..',
    'K': '#...# #..#. #.#.. ##... #.#.. #..#. #...#', 'L': '#.... #.... #.... #.... #.... #.... #####',
    'M': '#...# ##.## #.#.# #.#.# #...# #...# #...#', 'N': '#...# #...# ##..# #.#.# #..## #...# #...#',
    'O': '.###. #...# #...# #...# #...# #...# .###.', 'P': '####. #...# #...# ####. #.... #.... #....',
    'Q': '.###. #...# #...# #...# #.#.# #..#. .##.#', 'R': '####. #...# #...# ####. #.#.. #..#. #...#',
    'S': '.#### #.... #.... .###. ....# ....# ####.', 'T': '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
    'U': '#...# #...# #...# #...# #...# #...# .###.', 'V': '#...# #...# #...# #...# #...# .#.#. ..#..',
    'W': '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', 'X': '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
    'Y': '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', 'Z': '##### ....# ...#. ..#.. .#... #.... #####',
    'Å': '..#.. .#.#. ..#.. .###. #...# ##### #...#', 'Ä': '.#.#. ..... .###. #...# ##### #...# #...#',
    'Ö': '.#.#. ..... .###. #...# #...# #...# .###.', 'Ü': '.#.#. ..... #...# #...# #...# #...# .###.',
    '0': '.###. #...# #..## #.#.# ##..# #...# .###.', '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
    '2': '.###. #...# ....# ...#. ..#.. .#... #####', '3': '####. ....# ....# .###. ....# ....# ####.',
    '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.', '5': '##### #.... ####. ....# ....# #...# .###.',
    '6': '.###. #.... #.... ####. #...# #...# .###.', '7': '##### ....# ...#. ..#.. .#... .#... .#...',
    '8': '.###. #...# #...# .###. #...# #...# .###.', '9': '.###. #...# #...# .#### ....# ....# .###.',
    '.': '..... ..... ..... ..... ..... .##.. .##..', ',': '..... ..... ..... ..... .##.. ..#.. .#...',
    '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..', '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
    ':': '..... .##.. .##.. ..... .##.. .##.. .....', ';': '..... .##.. .##.. ..... .##.. ..#.. .#...',
    "'": '..#.. ..#.. .#... ..... ..... ..... .....', '"': '.#.#. .#.#. ..... ..... ..... ..... .....',
    '-': '..... ..... ..... .###. ..... ..... .....', '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
    '=': '..... ..... ##### ..... ##### ..... .....', '/': '....# ....# ...#. ..#.. .#... #.... #....',
    '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.', ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
    '%': '##..# ##.#. ...#. ..#.. .#... .#.## #..##', '*': '..... ..#.. #.#.# .###. #.#.# ..#.. .....',
    '#': '.#.#. ##### .#.#. .#.#. ##### .#.#. .....', '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
    '_': '..... ..... ..... ..... ..... ..... #####', '×': '..... #...# .#.#. ..#.. .#.#. #...# .....',
    '♥': '..... .#.#. ##### ##### .###. ..#.. .....', '★': '..#.. ..#.. ##### .###. .###. .#.#. #...#',
    '♪': '..##. ..#.# ..#.. ..#.. .##.. ###.. .#...', '▶': '#.... ##... ###.. ####. ###.. ##... #....',
    '▼': '..... ##### .###. ..#.. ..... ..... .....', '·': '..... ..... ..... ..#.. ..... ..... .....',
    '←': '..... ..#.. .#... ##### .#... ..#.. .....', '→': '..... ..#.. ...#. ##### ...#. ..#.. .....',
    '↑': '..#.. .###. #.#.# ..#.. ..#.. ..#.. .....', '↓': '..#.. ..#.. ..#.. #.#.# .###. ..#.. .....',
    '¤': '.###. #...# #.#.# #...# #.#.# #...# .###.'
  };
  const MAP = { 'É': 'E', 'È': 'E', 'Á': 'A', 'À': 'A', '–': '-', '—': '-', '’': "'", '“': '"', '”': '"', '…': '...' };
  const glyphs = {};
  for (const k in FONT) glyphs[k] = FONT[k].replace(/ /g, '');
  const gCache = {};
  // Å, Ä och Ö ritas som hela versaler med prickar/ring ovanför (viktigt i bokstavsspelen).
  const ACC = { 'Å': ['..#..', '.#.#.', 'A'], 'Ä': ['.#.#.', '.....', 'A'], 'Ö': ['.#.#.', '.....', 'O'], 'Ü': ['.#.#.', '.....', 'U'] };
  function glyph(ch, col) {
    const key = col + ch; let c = gCache[key];
    if (!c) {
      const acc = ACC[ch];
      c = K.canvas(5, acc ? 9 : 7); const g = c.getContext('2d'); g.fillStyle = col;
      const d = acc ? acc[0] + acc[1] + glyphs[acc[2]] : glyphs[ch];
      if (d) for (let i = 0; i < d.length; i++) if (d[i] === '#') g.fillRect(i % 5, (i / 5) | 0, 1, 1);
      gCache[key] = c;
    }
    return c;
  }
  K.norm = s => { s = String(s).toUpperCase(); let o = ''; for (const ch of s) o += MAP[ch] !== undefined ? MAP[ch] : ch; return o; };
  K.textW = (s, sc = 1) => K.norm(s).length * 6 * sc - sc;
  // text(ctx, s, x, y, färg, {sc, align:'c'|'r', sh: skuggfärg, out: konturfärg})
  K.text = (ctx, s, x, y, col = '#fff', o = {}) => {
    const sc = Math.max(1, Math.round(o.sc || 1)); s = K.norm(s);
    let w = s.length * 6 * sc - sc;
    if (o.align === 'c') x -= w / 2; else if (o.align === 'r') x -= w;
    x = Math.round(x); y = Math.round(y);
    ctx.imageSmoothingEnabled = false;
    if (o.out) {
      const d = Math.max(1, sc);
      K.text(ctx, s, x - d, y, o.out, { sc });
      K.text(ctx, s, x + d, y, o.out, { sc });
      K.text(ctx, s, x, y - d, o.out, { sc });
      K.text(ctx, s, x, y + d, o.out, { sc });
    } else if (o.sh) {
      K.text(ctx, s, x + sc, y + sc, o.sh, { sc });
    }
    let cx = x;
    for (const ch of s) { if (ch !== ' ') { const gl = glyph(ch, col); ctx.drawImage(gl, cx, y - (gl.height - 7) * sc, 5 * sc, gl.height * sc); } cx += 6 * sc; }
  };
  K.wrap = (s, cols) => {
    const out = [];
    String(s).split('\n').forEach(par => {
      let line = '';
      par.split(' ').forEach(w => {
        if (!line) line = w; else if ((line + ' ' + w).length <= cols) line += ' ' + w; else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  };
  K.rect = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  K.panel = (ctx, x, y, w, h, bg = '#141428', bd = '#f4e9c8', bd2 = '#7a6a4a') => {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    K.rect(ctx, x + 1, y, w - 2, h, bd2); K.rect(ctx, x, y + 1, w, h - 2, bd2);
    K.rect(ctx, x + 1, y + 1, w - 2, h - 2, bd); K.rect(ctx, x + 2, y + 2, w - 4, h - 4, bg);
  };

  // ---------- Fysik mot rutnät (16 px rutor) ----------
  // b = {x,y,w,h,vx,vy}; solid(tx,ty) -> bool; oneway(tx,ty) -> bool (plattform man kan hoppa upp genom)
  K.move = (b, solid, oneway) => {
    b.hitWall = 0; b.bonk = false;
    if (b.vx) {
      b.x += b.vx;
      const y0 = Math.floor(b.y / TS), y1 = Math.floor((b.y + b.h - 0.01) / TS);
      if (b.vx > 0) { const tx = Math.floor((b.x + b.w - 0.01) / TS); for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { b.x = tx * TS - b.w; b.hitWall = 1; break; } }
      else { const tx = Math.floor(b.x / TS); for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { b.x = (tx + 1) * TS; b.hitWall = -1; break; } }
    }
    const oldBottom = b.y + b.h; b.y += b.vy; b.onGround = false;
    const x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - 0.01) / TS);
    if (b.vy >= 0) {
      const ty = Math.floor((b.y + b.h) / TS);
      for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty) || (oneway && oneway(tx, ty) && oldBottom <= ty * TS + 0.5)) { if (b.y + b.h > ty * TS - 0.01) { b.y = ty * TS - b.h; b.vy = 0; b.onGround = true; } break; }
    } else {
      const ty = Math.floor(b.y / TS);
      for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) { b.y = (ty + 1) * TS; b.vy = 0; b.bonk = true; break; }
    }
  };
  K.tilemap = (rows) => {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    return { w, h, rows, get(tx, ty) { if (ty < 0 || ty >= h || tx < 0 || tx >= w) return '.'; return rows[ty][tx] || '.'; },
      set(tx, ty, c) { if (ty < 0 || ty >= h) return; const r = rows[ty]; rows[ty] = r.slice(0, tx) + c + r.slice(tx + 1); } };
  };

  // ---------- Ljud: chiptune via Web Audio ----------
  let ac = null, master, mus, sfxG, pulse = {}, noiseBuf;
  function makePulse(d) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * d);
    return ac.createPeriodicWave(re, im, { disableNormalization: false });
  }
  function audio() {
    if (ac && ljud.noder) {
      if (ac.state === 'suspended') ljud.unlock();
      return ac;
    }
    try {
      ljud._initGraph();
      ac = ljud.ctx;
      if (!ac) return null;
      mus = ac.createGain(); mus.gain.value = 0.26; mus.connect(ljud.noder.bussar.music);
      sfxG = ac.createGain(); sfxG.gain.value = 0.42; sfxG.connect(ljud.noder.bussar.sfx);
      pulse.p12 = makePulse(0.125); pulse.p25 = makePulse(0.25); pulse.p50 = makePulse(0.5);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ljud.unlock();
      if (K.muted) ljud.setMuted('master', true);
      if (pendingSong) { const s = pendingSong; pendingSong = null; K.music(s); }
    } catch (e) { ac = null; console.warn('ljudinit', e); }
    return ac;
  }
  K.audio = audio;
  K.buss = (namn) => (ljud.noder && ljud.noder.bussar[namn]) || sfxG;
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  K.freq = n => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0; let s = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (s + (m[3] - 4) * 12 - 9) / 12); };
  function setWave(o, w) { if (pulse[w]) o.setPeriodicWave(pulse[w]); else o.type = w; }
  K.tone = (f, t0, dur, w = 'p25', vol = 0.2, dest, f2, vib) => {
    if (!ac || !f) return;
    const o = ac.createOscillator(), g = ac.createGain(); setWave(o, w);
    o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.01, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxG);
    if (vib) {
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.setValueAtTime(5.5, t0);
      lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(f * 0.012, t0 + 0.14);
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.02);
    }
    o.start(t0); o.stop(t0 + dur + 0.02);
  };
  K.noise = (t0, dur, vol = 0.2, dest, hp = 1000) => {
    if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxG); s.start(t0); s.stop(t0 + dur + 0.02);
  };
  const SFX = {
    jump: t => K.tone(330, t, 0.12, 'p25', 0.16, null, 660),
    hop2: t => K.tone(440, t, 0.12, 'p12', 0.16, null, 990),
    pick: t => { K.tone(988, t, 0.06, 'p25', 0.15); K.tone(1319, t + 0.06, 0.12, 'p25', 0.15); },
    coin: t => { K.tone(1319, t, 0.05, 'p50', 0.12); K.tone(1760, t + 0.05, 0.14, 'p50', 0.12); },
    talk: t => K.tone(520 + Math.random() * 120, t, 0.03, 'p50', 0.06),
    select: t => K.tone(660, t, 0.05, 'p12', 0.12),
    ok: t => { [523, 659, 784, 1047].forEach((f, i) => K.tone(f, t + i * 0.07, 0.14, 'p25', 0.14)); },
    bad: t => { K.tone(392, t, 0.12, 'triangle', 0.25); K.tone(349, t + 0.12, 0.2, 'triangle', 0.25); },
    hurt: t => { K.tone(300, t, 0.2, 'p50', 0.14, null, 120); K.noise(t, 0.12, 0.08); },
    hit: t => { K.noise(t, 0.08, 0.18, null, 600); K.tone(200, t, 0.08, 'p50', 0.1, null, 90); },
    swing: t => K.noise(t, 0.07, 0.1, null, 3000),
    puff: t => { K.noise(t, 0.2, 0.16, null, 900); K.tone(280, t, 0.12, 'triangle', 0.1, null, 420); K.tone(720, t, 0.1, 'triangle', 0.09, null, 1480); K.tone(1200, t + 0.04, 0.08, 'p12', 0.06, null, 1800); },
    pop: t => { K.tone(600, t, 0.08, 'p25', 0.14, null, 1500); },
    door: t => { [392, 523, 659, 784, 1047].forEach((f, i) => K.tone(f, t + i * 0.05, 0.12, 'p12', 0.12)); },
    flute: t => { [784, 988, 1175].forEach((f, i) => K.tone(f, t + i * 0.09, 0.16, 'triangle', 0.22)); },
    magic: t => { for (let i = 0; i < 8; i++) K.tone(880 + i * 140, t + i * 0.04, 0.1, 'p12', 0.08); },
    win: t => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => K.tone(f, t + i * 0.11, 0.2, 'p25', 0.15)); },
    step: t => K.noise(t, 0.03, 0.03, null, 2500),
    foot: t => { K.noise(t, 0.05, 0.1, null, 700); K.tone(82, t, 0.04, 'triangle', 0.045, null, 48); },
    land: t => { K.noise(t, 0.1, 0.11, null, 400); K.tone(90, t, 0.07, 'triangle', 0.07, null, 48); K.tone(140, t, 0.04, 'p50', 0.05, null, 70); },
    power: t => { K.tone(660, t, 0.07, 'p25', 0.14, null, 990); K.tone(1320, t + 0.07, 0.14, 'p25', 0.12); },
    combo: t => { K.tone(880, t, 0.05, 'p12', 0.1); K.tone(1174, t + 0.05, 0.08, 'p12', 0.1); },
    boss: t => { K.tone(110, t, 0.5, 'p50', 0.15, null, 55); },
    warn: t => { K.tone(196, t, 0.14, 'p50', 0.16, null, 140); K.tone(147, t + 0.08, 0.22, 'p50', 0.14, null, 80); K.noise(t, 0.22, 0.12, null, 350); K.tone(330, t + 0.18, 0.1, 'p25', 0.08, null, 220); }
  };
  K.sfx = name => {
    ST?.sfx(name, !K.muted);
    if (K.muted) return;
    audio();
    const UI = { select: 1, ok: 1, talk: 1 };
    try {
      if (ljud.bankar.has(name)) {
        ljud.play(name, { buss: UI[name] ? 'ui' : 'sfx', pitchJitter: 0.07, volJitter: 1.6, volume: 0.9 });
        return;
      }
    } catch (e) {}
    // Inga oscillator-sfx när banken saknas (chiptune är bara K.music).
  };

  // Låtar: {bpm, tracks:[{w, v, n:'C4 . E4 - ...'}], drums:'k - h - s - h -'}. Varje symbol = en sextondel.
  let song = null, songStep = 0, nextT = 0, pendingSong = null, songTimer = null;
  function parseTrack(str) {
    const tok = str.trim().split(/\s+/), ev = [];
    let cur = null;
    tok.forEach((t, i) => {
      if (t === '.') { if (cur) cur.len++; }
      else if (t === '-') cur = null;
      else { cur = { i, n: t, len: 1 }; ev.push(cur); }
    });
    return { len: tok.length, ev };
  }
  K.music = (s) => {
    if (song && s && song.src === s) return;
    song = null; songStep = 0;
    if (!s) return;
    if (!ac) { pendingSong = s; return; }
    const tracks = s.tracks.map(t => Object.assign({ w: 'p25', v: 0.12 }, t, parseTrack(t.n)));
    const drums = s.drums ? s.drums.trim().split(/\s+/) : null;
    const len = Math.max(...tracks.map(t => t.len), drums ? drums.length : 0);
    tracks.forEach(t => { t.at = {}; t.ev.forEach(e => t.at[e.i] = e); });
    song = { src: s, tracks, drums, len, sp: 60 / s.bpm / 4 };
    nextT = ac.currentTime + 0.06;
  };
  K.songName = () => song && song.src && song.src.name;
  function pump() {
    if (!ac || !song) return;
    while (nextT < ac.currentTime + 0.15) {
      if (!K.muted) {
        song.tracks.forEach(t => { const e = t.at[songStep % t.len]; if (e) K.tone(K.freq(e.n), nextT, e.len * song.sp * 0.95, t.w, t.v, mus, 0, !!(t.vib && songStep % t.len > 16 * 8)); });
        if (song.drums) { const d = song.drums[songStep % song.drums.length];
          if (d === 'k') K.tone(150, nextT, 0.12, 'sine', 0.35, mus, 40);
          else if (d === 's') K.noise(nextT, 0.12, 0.12, mus, 1500);
          else if (d === 'h') K.noise(nextT, 0.03, 0.05, mus, 6000); }
      }
      songStep = (songStep + 1) % song.len; nextT += song.sp;
    }
  }
  K.mute = (m) => { K.muted = m === undefined ? !K.muted : m; try { ljud.setMuted('master', K.muted); } catch (e) {} if (muteEl) muteEl.textContent = K.muted ? '🔇' : '🔊'; const lb = document.getElementById('knapp-ljud'); if (lb) lb.textContent = K.muted ? 'Ljud av' : 'Ljud på'; };

  // Uppläsning för små barn (om webbläsaren har svensk röst). Allt i try/catch.
  K.say = (txt) => {
    try {
      if (K.muted || !window.speechSynthesis) return;
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'sv-SE'; u.rate = 0.9;
      const v = speechSynthesis.getVoices().find(v => /^sv/i.test(v.lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  };

  // ---------- Dialog (skrivmaskinstext, val med upp/ner) ----------
  K.Dialog = function () {
    const D = { q: [], cur: null, shown: 0, sel: 0, open: false, cb: null };
    D.add = (pages, done) => { // pages: [{who, text, col, choices:[..], pick(i)}]
      pages.forEach(p => D.q.push(p)); if (done) D.q.push({ fn: done }); if (!D.cur) D.next();
    };
    D.next = () => {
      D.cur = D.q.shift() || null; D.shown = 0; D.sel = 0;
      while (D.cur && D.cur.fn) { const f = D.cur.fn; D.cur = null; f(); if (!D.cur) D.cur = D.q.shift() || null; }
      D.open = !!D.cur; if (D.cur) { D.lines = K.wrap(D.cur.text, 48); D.total = D.lines.join('').length; if (D.cur.speak) K.say(D.cur.text); }
    };
    D.update = () => {
      if (!D.cur) return false;
      if (D.shown < D.total) { D.shown += K.held.a || K.held.b ? 3 : 1; if (K.t % 3 === 0) K.sfx('talk'); if (K.pressed.a && D.shown > 3) D.shown = D.total; return true; }
      const ch = D.cur.choices;
      if (ch) {
        if (K.pressed.up) { D.sel = (D.sel + ch.length - 1) % ch.length; K.sfx('select'); }
        if (K.pressed.down) { D.sel = (D.sel + 1) % ch.length; K.sfx('select'); }
      }
      if (K.pressed.a) {
        const p = D.cur, s = D.sel; K.sfx('select');
        if (p.pick) { D.cur = null; p.pick(s); if (!D.cur) D.next(); } else D.next();
      }
      return true;
    };
    D.draw = (ctx) => {
      if (!D.cur) return;
      const p = D.cur, ch = p.choices || [];
      const lines = D.lines, h = 14 + lines.length * 9 + ch.length * 9 + (p.who ? 0 : 0);
      const y = H - h - 4;
      K.panel(ctx, 6, y, W - 12, h, p.bg || '#12122a', p.bd || '#f4e9c8');
      if (p.who) { const w = K.textW(p.who) + 8; K.panel(ctx, 12, y - 10, w, 13, p.col || '#7a3b2e', '#f4e9c8'); K.text(ctx, p.who, 16, y - 7, '#fff'); }
      let left = D.shown;
      lines.forEach((l, i) => { const s = l.slice(0, Math.max(0, left)); left -= l.length; K.text(ctx, s, 12, y + 7 + i * 9, p.tc || '#f8f4e8'); });
      if (D.shown >= D.total) {
        ch.forEach((c, i) => K.text(ctx, (i === D.sel ? '▶ ' : '  ') + c, 16, y + 9 + lines.length * 9 + i * 9, i === D.sel ? '#ffd860' : '#c8c0b0'));
        if (!ch.length && (K.t >> 4) % 2) K.text(ctx, '▼', W - 18, y + h - 9, '#ffd860');
      }
    };
    return D;
  };

  // ---------- Skärm, kontroller och huvudloop ----------
  let cv, ctx, game, muteEl, padEl, aEl, bEl, gemEl, stEl, wrap, playCtrlsVis = true;
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'a', Space: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b', ShiftLeft: 'b', KeyE: 'gem', KeyC: 'gem', ShiftRight: 'gem', Enter: 'start', Escape: 'start', KeyP: 'start' };
  function css() {
    const st = document.createElement('style');
    st.textContent = `html,body{margin:0;height:100%;height:100dvh;height:-webkit-fill-available;background:#07070f;overflow:hidden;overscroll-behavior:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#rw{position:fixed;inset:0;overflow:hidden;font-family:"DrakisPixel",monospace;-webkit-font-smoothing:none;font-smooth:never;background:#07070f}body.touch.portrait #rw{background:linear-gradient(#07070f,#10101c)}
#rw canvas{position:absolute;image-rendering:pixelated;image-rendering:crisp-edges;background:#000;box-shadow:0 0 0 2px #22223a}
.rb{position:absolute;display:flex;align-items:center;justify-content:center;color:#fff;font-family:"DrakisPixel",monospace;font-weight:normal;font-size:20px;line-height:1;border-radius:50%;
background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.45);box-sizing:border-box;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:none}
.rb.on,.rb:active{background:rgba(12,16,36,.88);border-color:#ffd860;color:#ffd860;transform:translateY(2px);box-shadow:inset 0 2px 0 rgba(0,0,0,.65);transition:none}
#rpad{position:absolute;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.3);box-sizing:border-box;touch-action:none;transition:none}
#rpad.on{background:rgba(10,14,30,.36);border-color:rgba(255,216,96,.72)}
#rpad i{position:absolute;width:34%;height:34%;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.4);box-sizing:border-box;border-radius:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:"DrakisPixel",monospace;font-style:normal;font-weight:normal;font-size:20px;line-height:1;transition:none}
#rpad i.on{background:rgba(12,16,36,.9);border-color:#ffd860;color:#ffd860;transform:translateY(2px);box-shadow:inset 0 2px 0 rgba(0,0,0,.65);transition:none}
.rs{position:absolute;display:flex;align-items:center;justify-content:center;padding:0 6px;min-width:48px;min-height:48px;border-radius:0;font-family:"DrakisPixel",monospace;font-size:20px;line-height:1;font-weight:normal;letter-spacing:0;text-transform:uppercase;background:rgba(18,22,42,.82);border:2px solid rgba(244,233,200,.65);color:#fff;box-sizing:border-box;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:none}
.rs.on,.rs:active{background:rgba(8,10,24,.94);border-color:#ffd860;color:#ffd860;transform:translateY(2px);transition:none}
#kodpanel{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px;font-family:"DrakisPixel",monospace;touch-action:auto;-webkit-user-select:text;user-select:text}
#kodpanel[hidden]{display:none}
#kodpanel .kodbox{background:#16141f;color:#f4efe2;border:2px solid #c8a860;border-radius:0;max-width:440px;width:100%;padding:18px;box-shadow:0 12px 40px #000}
#kodpanel h2{margin:0 0 8px;font-size:20px;color:#ffd65a;font-weight:normal}
#kodpanel p{margin:0 0 10px;font-size:10px;line-height:1.6;opacity:.95}
#kodpanel textarea{width:100%;box-sizing:border-box;min-height:90px;border-radius:0;border:2px solid #c8a860;background:#0c0b14;color:#fff8e0;padding:10px;font:10px/1.6 "DrakisPixel",monospace;resize:vertical;-webkit-user-select:text;user-select:text}
#kodpanel .kodbtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#kodpanel button{border:2px solid #f4e9c8;border-radius:0;padding:10px 14px;font-weight:normal;cursor:pointer;background:#ffd65a;color:#1a1430;min-height:40px;font-family:"DrakisPixel",monospace;font-size:10px;text-transform:uppercase}
#kodpanel button.ghost{background:transparent;color:#ffd65a;border:2px solid #ffd65a}
#kodpanel #kodmsg{min-height:18px;color:#ffd65a;font-size:10px;font-weight:normal}`;
    document.head.appendChild(st);
  }
  function buildPad() {
    wrap = document.createElement('div'); wrap.id = 'rw'; (document.querySelector('.app-liggande') || document.body).appendChild(wrap);
    cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; wrap.appendChild(cv);
    ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    padEl = document.createElement('div'); padEl.id = 'rpad';
    const arrows = { up: ['↑', '33%', '0'], down: ['↓', '33%', '66%'], left: ['←', '0', '33%'], right: ['→', '66%', '33%'] };
    const parts = {};
    for (const k in arrows) { const i = document.createElement('i'); i.textContent = arrows[k][0]; i.style.left = arrows[k][1]; i.style.top = arrows[k][2]; padEl.appendChild(i); parts[k] = i; }
    wrap.appendChild(padEl);
    function bindPress(el, onDown, onUp, onMove) {
      const ids = new Set();
      const pt = (e) => (e.changedTouches && e.changedTouches[0]) || e;
      const down = (e) => {
        if (e.cancelable) e.preventDefault();
        audio();
        const p = pt(e);
        if (p.pointerId != null) { ids.add(p.pointerId); try { el.setPointerCapture(p.pointerId); } catch (_) {} }
        else ids.add('t');
        if (onDown) onDown(p);
      };
      const up = (e) => {
        const p = pt(e);
        if (e.touches && e.touches.length === 0) ids.clear();
        else if (p.pointerId != null) ids.delete(p.pointerId); else ids.delete('t');
        if (!ids.size && onUp) onUp(p);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      if (onMove) {
        el.addEventListener('pointermove', (e) => { if (ids.has(e.pointerId)) onMove(e); });
        el.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); if (ids.size) onMove(pt(e)); }, { passive: false });
      }
    }
    const padPtr = new Set();
    function padSet(e) {
      const r = padEl.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      const dz = 0.12; tp.left = dx < -dz && Math.abs(dx) > Math.abs(dy) * 0.45; tp.right = dx > dz && Math.abs(dx) > Math.abs(dy) * 0.45;
      tp.up = dy < -dz && Math.abs(dy) > Math.abs(dx) * 0.45; tp.down = dy > dz && Math.abs(dy) > Math.abs(dx) * 0.45;
      for (const k in parts) parts[k].classList.toggle('on', tp[k]);
      padEl.classList.toggle('on', !!(tp.left || tp.right || tp.up || tp.down));
    }
    function padClear() { tp.left = tp.right = tp.up = tp.down = false; for (const k in parts) parts[k].classList.remove('on'); padEl.classList.remove('on'); }
    bindPress(padEl, e => { padPtr.add(e.pointerId != null ? e.pointerId : 't'); padSet(e); }, () => { padPtr.clear(); padClear(); }, e => { if (padPtr.size) padSet(e); });
    function btn(label, key, cls, onTap) {
      const b = document.createElement('div'); b.className = cls || 'rb'; b.textContent = label; wrap.appendChild(b);
      bindPress(b, () => { if (key) tp[key] = true; b.classList.add('on'); if (onTap) onTap(); },
        () => { if (key) tp[key] = false; b.classList.remove('on'); });
      return b;
    }
    ST?.attach(cv, wrap);
    K.toggleMeny = (force) => {
      const m = document.getElementById('drakis-meny');
      if (!m) { tp.start = true; setTimeout(() => { tp.start = false; }, 60); return; }
      const next = force === undefined ? m.hidden : !!force;
      m.hidden = !next;
      K.menyOpen = next;
      if (game && game.S) game.S.paused = next;
      ST?.event(next ? 'menu-open' : 'menu-close');
    };
    aEl = btn('A', 'a'); aEl.setAttribute('role', 'button'); aEl.setAttribute('aria-label', 'Hoppa');
    bEl = btn('B', 'b'); bEl.setAttribute('role', 'button'); bEl.setAttribute('aria-label', 'Blås');
    gemEl = btn('', 'gem', 'rb rgem empty'); gemEl.id = 'rgem'; gemEl.setAttribute('role', 'button'); gemEl.setAttribute('aria-label', 'Aktivera ädelsten'); gemEl.innerHTML = '<img class="gem-px" alt="" width="32" height="32" src="' + emptyGemIcon() + '">';
    stEl = btn('MENY', null, 'rs', () => K.toggleMeny()); stEl.setAttribute('role', 'button'); stEl.setAttribute('aria-label', 'Meny');
    muteEl = btn('🔊', null, 'rs', () => K.mute()); muteEl.hidden = true;
    kodEl = btn('Kod', null, 'rs', () => openKod()); kodEl.setAttribute('aria-label', 'Sparkod'); kodEl.hidden = true;
    window.addEventListener('keydown', e => {
      if (K.kodOpen && /^(INPUT|TEXTAREA|BUTTON)$/.test((e.target && e.target.tagName) || '')) return;
      audio(); const k = KEYMAP[e.code]; if (k) { kb[k] = true; e.preventDefault(); } if (e.code === 'KeyM') K.mute();
    });
    window.addEventListener('keyup', e => {
      if (K.kodOpen && /^(INPUT|TEXTAREA|BUTTON)$/.test((e.target && e.target.tagName) || '')) return;
      const k = KEYMAP[e.code]; if (k) { kb[k] = false; e.preventDefault(); }
    });
    window.addEventListener('blur', () => { NAMES.forEach(n => { kb[n] = false; }); padClear(); });
    bindPress(cv, (p) => {
      screenTapQueued = true;
      const r = cv.getBoundingClientRect();
      if (p && r.width > 0) {
        K.tapPos = {
          x: (p.clientX - r.left) / Math.max(0.01, K.canvasScale),
          y: (p.clientY - r.top) / Math.max(0.01, K.canvasScale)
        };
      }
    });
    let autoPaused = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        NAMES.forEach(n => { kb[n] = false; }); padClear();
        if (ac && ac.state === 'running') ac.suspend().catch(() => {});
        if (game && game.S && game.S.scene === 'play' && !game.S.paused && !K.menyOpen) {
          game.S.paused = true; autoPaused = true;
        }
      } else {
        if (autoPaused) { if (game && game.S) game.S.paused = false; autoPaused = false; }
        if (ac && ac.state === 'suspended' && !K.muted) ac.resume().catch(() => {});
      }
    });
    const lock = (e) => { if (e.cancelable) e.preventDefault(); };
    wrap.addEventListener('touchmove', lock, { passive: false });
    document.addEventListener('touchmove', lock, { passive: false });
    document.addEventListener('gesturestart', lock, { passive: false });
    document.addEventListener('gesturechange', lock, { passive: false });
    document.addEventListener('contextmenu', e => e.preventDefault());
    if (isTouchUI()) document.body.classList.add('touch');
    addEventListener('touchstart', () => { if (!document.body.classList.contains('touch')) { document.body.classList.add('touch'); layout(); } }, { capture: true, passive: true });
    window.addEventListener('resize', layout);
    if (window.visualViewport) visualViewport.addEventListener('resize', layout);
    window.addEventListener('orientationchange', () => setTimeout(layout, 250));
    try { new ResizeObserver(() => layout()).observe(document.documentElement); } catch (e) {}
    layout();
    requestAnimationFrame(() => { layout(); requestAnimationFrame(layout); });
    setTimeout(layout, 120);
  }
  function place(el, x, y, w, h) { el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.style.width = Math.round(w) + 'px'; el.style.height = Math.round(h) + 'px'; if (el.classList && el.classList.contains('rb')) { const fs = el.id === 'rgem' ? 10 : Math.max(10, Math.round(w * 0.38 / 10) * 10); el.style.fontSize = fs + 'px'; } }
  function portraitView(aw, ah) {
    let w = 320, s = aw / w;
    if (s < 1) { w = Math.max(256, Math.round(aw / 16) * 16); s = aw / w; }
    let h = Math.round(ah / s);
    h = Math.max(220, Math.min(h, 720));
    return { w, h: Math.round(h / 2) * 2 };
  }
  function setView(w, h) {
    if (W === w && H === h && cv && cv.width === w * 2 && cv.height === h * 2) return;
    W = K.W = w; H = K.H = h;
    if (!cv) return;
    cv.width = w * 2; cv.height = h * 2;
    ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
  }
  let safeProbe = null;
  function getSafe() {
    if (!safeProbe) {
      safeProbe = document.createElement('div');
      safeProbe.style.cssText = 'position:fixed;inset:0;padding:var(--safe-top,env(safe-area-inset-top,0px)) var(--safe-right,env(safe-area-inset-right,0px)) var(--safe-bottom,env(safe-area-inset-bottom,0px)) var(--safe-left,env(safe-area-inset-left,0px));pointer-events:none;visibility:hidden;z-index:-1';
      document.body.appendChild(safeProbe);
    }
    const cs = getComputedStyle(safeProbe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }
  K.toScreenX = (lx) => K.canvasRect.x + lx * K.canvasScale;
  K.toScreenY = (ly) => K.canvasRect.y + ly * K.canvasScale;
  K.ctrlCenter = (which) => {
    const el = which === 'a' ? aEl : which === 'b' ? bEl : which === 'gem' ? gemEl : which === 'start' ? stEl : which === 'canvas' ? cv : padEl;
    if (!el) return { x: (window.innerWidth || 320) / 2, y: (window.innerHeight || 180) / 2 };
    const r = el.getBoundingClientRect();
    let dx = 0, dy = 0;
    if (which === 'right') dx = r.width * 0.32;
    else if (which === 'left') dx = -r.width * 0.32;
    else if (which === 'up') dy = -r.height * 0.32;
    else if (which === 'down') dy = r.height * 0.32;
    return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 + dy };
  };
  function layout() {
    if (!cv) return;
    const vw = window.innerWidth || 320, vh = window.innerHeight || 180;
    const safe = getSafe();
    const x0 = safe.left, y0 = safe.top;
    const uw = Math.max(100, vw - safe.left - safe.right);
    const uh = Math.max(100, vh - safe.top - safe.bottom);
    const touch = document.body.classList.contains('touch');
    const portrait = vh > vw * 1.05;
    K.portrait = !!(touch && portrait);
    document.body.classList.toggle('portrait', K.portrait);
    document.body.classList.toggle('land', !!(touch && !portrait));
    let aw = uw, ah = uh, ctrl = 0;
    if (touch && portrait) {
      ctrl = Math.round(Math.max(196, Math.min(236, uh * 0.28)));
      ah = Math.max(200, uh - ctrl);
      const v = portraitView(aw, ah);
      setView(v.w, v.h);
    } else {
      setView(320, 180);
    }
    if (aw < 16 || ah < 16) { requestAnimationFrame(layout); return; }
    let s = Math.min(aw / W, ah / H);
    if (s >= 1.25) s = Math.max(1, Math.floor(s));
    else if (s >= 1) s = 1;
    if (!(s > 0.05) || !isFinite(s)) return;
    const cw = Math.round(W * s), ch = Math.round(H * s);
    const cx = x0 + Math.round((uw - cw) / 2);
    const cy = touch && portrait ? y0 : y0 + Math.round((uh - ch) / 2);
    K.canvasScale = s;
    K.canvasRect = { x: cx, y: cy, w: cw, h: ch };
    ST?.setTilePx(TS * s);
    if (touch && portrait) {
      const top = cy + ch, area = Math.max(ctrl, y0 + uh - top);
      const menyW = 64, menyH = 48, gap = 8;
      const bs = Math.min(76, Math.max(58, Math.min(uw * 0.2, area * 0.36)));
      const bLeft = x0 + uw - bs * 2 - 16;
      const menyX = Math.max(x0 + 8, Math.min(bLeft - menyW - gap, x0 + Math.round((uw - menyW) * 0.58)));
      place(stEl, menyX, top + 6, menyW, menyH);
      const padMax = Math.max(120, menyX - gap - (x0 + 8));
      const pad = Math.min(160, Math.max(124, Math.min(area - 16, uw * 0.42, padMax)));
      const padY = top + Math.max(0, (area - pad) / 2);
      place(padEl, x0 + 8, padY, pad, pad);
      place(aEl, x0 + uw - bs - 8, top + (area - pad) / 2 + pad * 0.06, bs, bs);
      place(bEl, x0 + uw - bs * 2 - 16, top + (area - pad) / 2 + pad * 0.06 + bs * 0.42, bs, bs);
      const gs = 48;
      place(gemEl, Math.round(menyX + (menyW - gs) / 2), Math.round(top + 6 + menyH + 10), gs, gs);
      if (muteEl) muteEl.style.display = 'none';
      if (kodEl) kodEl.style.display = 'none';
      K.playBottom = 0;
      [padEl, aEl, bEl, gemEl].forEach(e => { e.style.display = playCtrlsVis ? 'flex' : 'none'; e.style.opacity = '1'; });
      stEl.style.display = 'flex'; stEl.style.opacity = '1';
    } else {
      // Landscape touch: prefer the leftover side margins so the pad/A/B never sit on the dirt.
      // If the margins are too narrow (e.g. 667x375), lift the playfield and make the controls
      // slightly transparent so the walking surface stays visible above them.
      const side = (uw - cw) / 2;
      let pad = Math.min(160, Math.max(96, Math.min(side - 8, uh * 0.48)));
      const inSides = touch && side >= 96;
      if (!inSides) pad = Math.min(120, Math.max(100, Math.round(uh * 0.30)));
      const bs = Math.min(72, Math.max(56, Math.round((inSides ? Math.min(side - 8, pad * 0.5) : pad * 0.48) / 2) * 2));
      const padX = inSides ? x0 + Math.round((side - pad) / 2) : x0 + 6;
      const padY = inSides ? y0 + Math.round((uh - pad) / 2) : y0 + uh - pad - 6;
      place(padEl, Math.round(padX), Math.round(padY), pad, pad);
      const stack = inSides && (bs * 2 + 8 > side - 4);
      const rx = inSides
        ? x0 + uw - side + Math.round((side - (stack ? bs : bs * 2 + 8)) / 2)
        : x0 + uw - bs * 2 - 16;
      const bTop = inSides ? y0 + uh - Math.round((uh - bs) * 0.5) - bs : y0 + uh - bs - 6;
      if (stack) {
        const stackH = bs * 2 + 8;
        const midY = y0 + Math.round((uh - stackH) / 2);
        place(aEl, Math.round(rx), Math.round(midY), bs, bs);
        place(bEl, Math.round(rx), Math.round(midY + bs + 8), bs, bs);
      } else {
        place(bEl, Math.round(rx), Math.round(inSides ? bTop + Math.round(bs * 0.42) : bTop), bs, bs);
        place(aEl, Math.round(rx + bs + 8), Math.round(inSides ? bTop - Math.round(bs * 0.08) : y0 + uh - bs * 1.48 - 8), bs, bs);
      }
      const gs = 48;
      const gemX = inSides ? Math.round(x0 + uw - side + (side - gs) / 2) : Math.round(rx);
      const gemY = inSides ? Math.round(y0 + 58) : Math.round(Math.max(y0 + 58, bTop - gs - 10));
      place(gemEl, gemX, gemY, gs, gs);
      if (side >= 66 || !touch) {
        place(stEl, x0 + uw - 70, y0 + 6, 64, 48);
      } else {
        place(stEl, x0 + Math.round((uw - 64) / 2), y0 + 4, 64, 48);
      }
      const overlap = !inSides && touch;
      if (overlap) {
        const cover = Math.max(0, (cy + ch) - padY + 6);
        K.playBottom = Math.max(0, Math.ceil(cover / s));
        [padEl, aEl, bEl, gemEl].forEach(e => { if (e) e.style.opacity = '0.68'; });
      } else {
        K.playBottom = 0;
        [padEl, aEl, bEl, gemEl].forEach(e => { if (e) e.style.opacity = '1'; });
      }
      if (muteEl) muteEl.style.display = 'none';
      if (kodEl) kodEl.style.display = 'none';
      [padEl, aEl, bEl, gemEl].forEach(e => { e.style.display = playCtrlsVis ? 'flex' : 'none'; });
      stEl.style.display = 'flex'; stEl.style.opacity = '1';
    }
    cv.style.width = Math.round(cw) + 'px'; cv.style.height = Math.round(ch) + 'px'; cv.style.left = Math.round(cx) + 'px'; cv.style.top = Math.round(cy) + 'px';
  }
  K.setPlayCtrlsVisible = (vis) => {
    playCtrlsVis = !!vis;
    if (!padEl) return;
    [padEl, aEl, bEl, gemEl].forEach(e => { if (e) e.style.display = playCtrlsVis ? 'flex' : 'none'; });
  };
  let emptyGemUrl = '';
  function emptyGemIcon() {
    if (emptyGemUrl) return emptyGemUrl;
    const c = K.canvas(32, 32);
    c.hd = true;
    const ctx = c.getContext('2d');
    // Nedtonad diamant (samma 16×16-mönster som ädelstenarna, grå palett).
    const pat = [
      '......OOOO......',
      '.....OMMMMO.....',
      '....OHHMMLLO....',
      '...OHHHMMLLLO...',
      '..OHHHHMMLLLLLO.',
      '.OOOHHHMMLLLLOO.',
      'OLLOOHHMMLLOOHLO',
      'OLLOHHHMMLLOHHLO',
      '.OOOHHHMMLLLLOO.',
      '..OHHHMMMLLLLO..',
      '...OHHMMMLLLO...',
      '....OHMMLLLO....',
      '.....OMLLLO.....',
      '......OMLO......',
      '.......OO.......',
      '................'
    ];
    const pal = { O: '#1a1a22', H: '#c8c8d0', M: '#7a7a86', L: '#3e3e4a' };
    for (let y = 0; y < 16; y++) {
      const row = pat[y] || '';
      for (let x = 0; x < 16; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
    ctx.fillStyle = '#e4e4ec';
    ctx.fillRect(10, 8, 2, 2);
    try { emptyGemUrl = c.toDataURL(); } catch (e) { emptyGemUrl = ''; }
    return emptyGemUrl;
  }
  K.emptyGemIcon = emptyGemIcon;
  K.setGemBtn = (opt = {}) => {
    if (!gemEl) return;
    gemEl.classList.toggle('empty', !!opt.empty);
    gemEl.classList.toggle('ready', !opt.empty && !opt.active);
    gemEl.classList.toggle('active', !!opt.active);
    if (opt.color) gemEl.style.setProperty('--gem-col', opt.color);
    else gemEl.style.removeProperty('--gem-col');
    gemEl.setAttribute('aria-label', opt.name ? ('Aktivera ' + opt.name) : 'Aktivera ädelsten');
    const icon = opt.icon || (opt.empty ? emptyGemIcon() : '');
    if (icon) {
      gemEl.innerHTML = '<img class="gem-px" alt="" width="32" height="32" src="' + icon + '">' + (opt.count > 1 ? '<span class="gem-cnt">x' + opt.count + '</span>' : '');
    } else {
      gemEl.innerHTML = '';
    }
  };
  function readInput() {
    NAMES.forEach(n => { const h = kb[n] || tp[n] || inj[n]; K.pressed[n] = h && !prevHeld[n]; K.held[n] = h; prevHeld[n] = h; });
    K.screenTap = screenTapQueued; screenTapQueued = false;
  }
  function step() {
    readInput(); K.t++;
    if (K.kodOpen || K.menyOpen) return;
    try { game.update(); } catch (e) { K.err = e; console.error(e); throw e; }
  }
  function render() { ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false; game.draw(ctx); }
  let last = 0, acc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (K.manual) return;
    if (!last) last = ts; acc += Math.min(100, ts - last); last = ts;
    let n = 0; while (acc >= 1000 / 60 && n < 5) { step(); acc -= 1000 / 60; n++; }
    if (n) { render(); if (fpsBuf) { const now = performance.now(); const dt = now - fpsBuf.last; fpsBuf.last = now; if (dt > 0 && dt < 1000) fpsBuf.minDt = Math.min(fpsBuf.minDt, dt); fpsBuf.frames++; } }
    pump();
  }
  K.start = (g, assets) => {
    if (assets && !g._loaded) { g._loaded = true; K.load(assets).then(() => { g.init && g.init(); K.start(g); }); return; }
    game = g; css(); buildPad();
    setInterval(pump, 40);
    // Testkrok: låter ett automatiskt test styra spelet bildruta för bildruta.
    window.__retro = { game: g, K,
      manual(on) { K.manual = on; },
      input(o) { NAMES.forEach(n => inj[n] = !!(o && o[n])); },
      step(n = 1) { for (let i = 0; i < n; i++) step(); render(); },
      layout };
    setInterval(() => { try { if (!K.kodOpen && kodCfg) K.kod.save(); } catch (e) {} }, 8000);
    requestAnimationFrame(frame);
    ljud.attachUnlock(document);
  };
  K.mataLjud = async (bankNamn) => {
    const bank = ljud.bankar.get(bankNamn);
    if (bank && bank.buffers && bank.buffers[0]) return renderaOchMata({ audioBuffer: bank.buffers[0], inkluderGraph: true });
    return null;
  };
  return K;
})();

