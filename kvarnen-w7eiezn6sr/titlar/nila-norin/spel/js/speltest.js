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
    cur: { glows: [], hint: null, heroes: [], sprites: [], emoji: [] },
    last: { glows: [], hint: null, heroes: [], sprites: [], emoji: [] },
    hintOn: false, danceSeen: false, sample: null, sampleT: 0,
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
    hero(who, x, y, w, h, pose) {
      s.cur.heroes.push({ who, x: x - w / 2, y: y - h, w, h, pose });
      if (pose === 'dans' && !s.danceSeen) { s.danceSeen = true; ev('dance'); }
    },
    sprite(name, x, y, w, h) { s.cur.sprites.push({ name, x: x - w / 2, y: y - h, w, h }); },
    emoji(txt, x, y) { s.cur.emoji.push({ txt, x, y }); },
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
    targets() { return JSON.parse(JSON.stringify(s.last)); },
    dump() {
      return JSON.parse(JSON.stringify({
        now: now(), events: s.events, inputs: s.inputs, frames: s.frames, diffs: s.diffs, last: s.last,
      }));
    },
    reset() { s.events = []; s.inputs = []; s.frames = []; s.diffs = []; },
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
