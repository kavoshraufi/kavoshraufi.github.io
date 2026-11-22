/**
 * Kvarnen ljudmotor — delat fundament, etapp 1.
 * Mixbussar music/ambience/sfx/ui/voice → master → kompressor (~3:1) → limiter.
 * Genererade impulssvar (ConvolverNode), round-robin, ducking, iOS-upplåsning.
 */
export const BUSSAR = Object.freeze(['music', 'ambience', 'sfx', 'ui', 'voice']);
export const RUM = Object.freeze(['inget', 'rum', 'talt', 'grotta', 'skog']);

const LAGRA_NYCKEL = 'kvarnen.ljud.volymer';

export function klamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function dbTillGain(db) {
  return Math.pow(10, db / 20);
}

export function gainTillDb(g) {
  return 20 * Math.log10(Math.max(1e-12, g));
}

function lasVolymer(nyckel) {
  try {
    const raw = localStorage.getItem(nyckel);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const STANDARD_VOLYM = {
  master: 0.85,
  music: 0.7,
  ambience: 0.55,
  sfx: 0.85,
  ui: 0.8,
  voice: 0.9,
  muted: {},
};

const RUM_SPEC = {
  rum: { dur: 0.7, decay: 0.28, lp: 0.28, early: 8, earlyGain: 0.32 },
  talt: { dur: 0.34, decay: 0.11, lp: 0.42, early: 4, earlyGain: 0.2 },
  grotta: { dur: 1.2, decay: 0.5, lp: 0.22, early: 14, earlyGain: 0.48 },
  skog: { dur: 0.95, decay: 0.36, lp: 0.3, early: 3, earlyGain: 0.16 },
};

const RUM_WET = { inget: 0, rum: 0.26, talt: 0.18, grotta: 0.42, skog: 0.32 };

const DEFAULT_SEND = { music: 0.08, ambience: 0.2, sfx: 0.22, ui: 0.05, voice: 0.28 };

export class Ljudmotor {
  constructor({ storageKey = LAGRA_NYCKEL, basUrl = '../delat/ljud/' } = {}) {
    this.storageKey = storageKey;
    this.basUrl = !basUrl ? '' : (basUrl.endsWith('/') ? basUrl : `${basUrl}/`);
    this.ctx = null;
    this.noder = null;
    this.bankar = new Map();
    this.loopar = new Map();
    this.rum = 'inget';
    this.upplast = false;
    this._onskadePaus = false;
    this._visBunden = false;
    this._irCache = new Map();
    this.volymer = { ...STANDARD_VOLYM, muted: {} };
    const sparad = typeof localStorage !== 'undefined' ? lasVolymer(this.storageKey) : null;
    if (sparad && typeof sparad === 'object') {
      for (const k of ['master', 'music', 'ambience', 'sfx', 'ui', 'voice']) {
        if (typeof sparad[k] === 'number') this.volymer[k] = klamp(sparad[k], 0, 1);
      }
      if (sparad.muted && typeof sparad.muted === 'object') this.volymer.muted = { ...sparad.muted };
    }
    this._visHandler = () => this._vidSynlighet();
    this._lasHandler = null;
    this._duckAntal = 0;
    this._duckTimer = 0;
  }

  get state() {
    if (!this.ctx) return 'idle';
    if (!this.upplast || this.ctx.state === 'suspended') return 'locked';
    if (this._onskadePaus) return 'paused';
    return this.ctx.state === 'running' ? 'running' : this.ctx.state;
  }

  attachUnlock(el = document) {
    if (this._lasHandler) return;
    this._lasHandler = () => {
      this.unlock();
    };
    for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) {
      el.addEventListener(ev, this._lasHandler, { capture: true, passive: true });
    }
  }

  detachUnlock(el = document) {
    if (!this._lasHandler) return;
    for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) {
      el.removeEventListener(ev, this._lasHandler, { capture: true });
    }
    this._lasHandler = null;
  }

  async unlock() {
    this._initGraph();
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* iOS kan kräva ett riktigt gest-anrop; vi försöker tyst */
      }
    }
    const tyst = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const src = this.ctx.createBufferSource();
    src.buffer = tyst;
    src.connect(this.noder.master);
    try {
      src.start(0);
    } catch {
      /* redan startad */
    }
    this.upplast = true;
    if (!this._visBunden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._visHandler);
      this._visBunden = true;
    }
    this._anvandVolymer();
    return this.ctx;
  }

  dispose() {
    this.detachUnlock();
    if (this._visBunden) {
      document.removeEventListener('visibilitychange', this._visHandler);
      this._visBunden = false;
    }
    for (const id of [...this.loopar.keys()]) this.stopLoop(id, { fade: 0.02 });
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        /* redan stängd */
      }
    }
    this.ctx = null;
    this.noder = null;
    this.upplast = false;
  }

  _initGraph(befintligCtx) {
    if (this.ctx && this.noder) return;
    const AC = befintligCtx
      ? null
      : (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
    this.ctx = befintligCtx || new AC();
    const ctx = this.ctx;

    const master = ctx.createGain();
    master.gain.value = this._effektivVolym('master');

    const kompressor = ctx.createDynamicsCompressor();
    kompressor.threshold.value = -18;
    kompressor.knee.value = 10;
    kompressor.ratio.value = 3;
    kompressor.attack.value = 0.006;
    kompressor.release.value = 0.22;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const bussar = {};
    const sends = {};
    for (const namn of BUSSAR) {
      const g = ctx.createGain();
      g.gain.value = this._effektivVolym(namn);
      const send = ctx.createGain();
      send.gain.value = DEFAULT_SEND[namn];
      g.connect(master);
      g.connect(send);
      bussar[namn] = g;
      sends[namn] = send;
    }

    const conv = ctx.createConvolver();
    const convGain = ctx.createGain();
    convGain.gain.value = 0;
    conv.buffer = this._skapaIR('rum');
    for (const namn of BUSSAR) sends[namn].connect(conv);
    conv.connect(convGain);
    convGain.connect(master);

    master.connect(kompressor);
    kompressor.connect(limiter);
    if (ctx.destination) limiter.connect(ctx.destination);

    this.noder = { master, kompressor, limiter, bussar, sends, conv, convGain };
    return this.noder;
  }

  /** Genererade impulssvar 0,3–1,2 s: rum, tält, grotta, skog. */
  _skapaIR(namn, ctx = this.ctx) {
    if (this._irCache.has(namn) && this._irCache.get(namn).sampleRate === ctx.sampleRate) {
      return this._irCache.get(namn);
    }
    const s = RUM_SPEC[namn] || RUM_SPEC.rum;
    const len = Math.max(1, Math.floor(ctx.sampleRate * s.dur));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      const early = [];
      for (let e = 0; e < s.early; e++) {
        early.push({
          i: Math.floor((0.007 + Math.random() * 0.06) * ctx.sampleRate * (1 + e * 0.16)),
          g: (Math.random() * 2 - 1) * s.earlyGain * Math.exp(-e / 7),
        });
      }
      // Deterministic-ish per channel but mixed; Math.random is fine for IR noise.
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        let x = (Math.random() * 2 - 1) * Math.exp(-t / s.decay);
        for (const er of early) {
          if (i === er.i) x += er.g;
        }
        // one-pole lowpass, mindre lp-värde = mer dämpning
        const c = 1 - s.lp;
        lp += c * (x - lp);
        d[i] = lp;
      }
      const fadeIn = Math.min(180, len);
      const fadeOut = Math.min(Math.floor(0.05 * ctx.sampleRate), Math.floor(len / 4));
      for (let i = 0; i < fadeIn; i++) d[i] *= i / fadeIn;
      for (let i = 0; i < fadeOut; i++) d[len - 1 - i] *= i / fadeOut;
    }
    this._irCache.set(namn, buf);
    return buf;
  }

  setRum(namn) {
    this._initGraph();
    this.rum = RUM.includes(namn) ? namn : 'inget';
    if (this.rum !== 'inget') this.noder.conv.buffer = this._skapaIR(this.rum);
    const wet = RUM_WET[this.rum] ?? 0;
    const t = this.ctx.currentTime;
    this.noder.convGain.gain.cancelScheduledValues(t);
    this.noder.convGain.gain.setValueAtTime(this.noder.convGain.gain.value, t);
    this.noder.convGain.gain.linearRampToValueAtTime(wet, t + 0.08);
    return this.rum;
  }

  getRum() {
    return this.rum;
  }

  _effektivVolym(buss) {
    const muted = !!(this.volymer.muted[buss] || this.volymer.muted.master || this.volymer.muted.allt);
    if (muted) return 0;
    return klamp(this.volymer[buss] ?? 0.8, 0, 1);
  }

  setVolume(buss, value, { persist = true } = {}) {
    if (buss === 'allt' || buss === 'Allt') buss = 'master';
    if (buss === 'Musik') buss = 'music';
    if (buss === 'Ljud') {
      const v = klamp(Number(value), 0, 1);
      for (const n of ['ambience', 'sfx', 'ui']) this.setVolume(n, v, { persist: false });
      if (persist) this._lagra();
      return v;
    }
    if (buss !== 'master' && !BUSSAR.includes(buss)) return;
    const v = klamp(Number(value), 0, 1);
    this.volymer[buss] = v;
    if (this.noder) {
      const node = buss === 'master' ? this.noder.master : this.noder.bussar[buss];
      if (node && this.ctx) {
        const t = this.ctx.currentTime;
        node.gain.cancelScheduledValues(t);
        node.gain.setValueAtTime(node.gain.value, t);
        node.gain.linearRampToValueAtTime(this._effektivVolym(buss), t + 0.02);
      }
    }
    if (persist) this._lagra();
    return v;
  }

  getVolume(buss) {
    if (buss === 'allt' || buss === 'Allt') buss = 'master';
    if (buss === 'Musik') buss = 'music';
    if (buss === 'Ljud') {
      return (this.volymer.ambience + this.volymer.sfx + this.volymer.ui) / 3;
    }
    return this.volymer[buss] ?? 0;
  }

  setMuted(buss, muted) {
    if (buss === 'allt' || buss === 'Allt') buss = 'master';
    this.volymer.muted[buss] = !!muted;
    this._anvandVolymer();
    this._lagra();
  }

  getMuted(buss) {
    if (buss === 'allt' || buss === 'Allt') buss = 'master';
    return !!(this.volymer.muted[buss] || this.volymer.muted.master);
  }

  _anvandVolymer() {
    if (!this.noder || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.noder.master.gain.setTargetAtTime(this._effektivVolym('master'), t, 0.02);
    for (const namn of BUSSAR) {
      this.noder.bussar[namn].gain.setTargetAtTime(this._effektivVolym(namn), t, 0.02);
    }
  }

  _lagra() {
    try {
      const { master, music, ambience, sfx, ui, voice, muted } = this.volymer;
      localStorage.setItem(this.storageKey, JSON.stringify({ master, music, ambience, sfx, ui, voice, muted }));
    } catch {
      /* privat läge */
    }
  }

  async loadManifest(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Kunde inte hämta ljudbank: ${res.status}`);
    const man = await res.json();
    for (const [bank, filer] of Object.entries(man.banker || {})) {
      await this.loadBank(
        bank,
        filer.map((f) => ({
          ogg: (typeof f.ogg === 'string' && f.ogg.startsWith('data:') ? f.ogg : this.basUrl + f.ogg),
          m4a: (typeof f.m4a === 'string' && f.m4a.startsWith('data:') ? f.m4a : this.basUrl + f.m4a),
        })),
      );
    }
    this.manifest = man;
    return man;
  }

  async loadBank(namn, urls) {
    this._initGraph();
    const buffers = [];
    for (const u of urls) {
      const buf = await this._hamtaBuffer(u);
      if (buf) buffers.push(buf);
    }
    if (!buffers.length) throw new Error(`Tom ljudbank: ${namn}`);
    this.bankar.set(namn, { buffers, cursor: 0, last: -1 });
    return buffers.length;
  }

  async _hamtaBuffer(u) {
    const urls = typeof u === 'string' ? [u] : [u.ogg, u.m4a].filter(Boolean);
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        return await this.ctx.decodeAudioData(arr.slice(0));
      } catch {
        /* prova nästa container */
      }
    }
    return null;
  }

  /**
   * Round-robin (≥ undvik samma två gånger i rad), pitch ±6–8 %, volym ±1–2 dB,
   * 5–20 ms ramp vid start och slut.
   */
  play(bank, { buss = 'sfx', volume = 1, rate = 1, pitchJitter, volJitter, rampa } = {}) {
    if (!this.ctx || !this.noder) return null;
    const pack = this.bankar.get(bank);
    if (!pack || !pack.buffers.length) return null;
    let idx;
    if (pack.buffers.length === 1) {
      idx = 0;
    } else {
      idx = pack.cursor % pack.buffers.length;
      if (idx === pack.last) idx = (idx + 1) % pack.buffers.length;
      pack.cursor = idx + 1;
      pack.last = idx;
    }
    const buffer = pack.buffers[idx];
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const pj = pitchJitter == null ? 0.07 : pitchJitter;
    const vj = volJitter == null ? 1.5 : volJitter;
    src.playbackRate.value = klamp(rate * (1 + (Math.random() * 2 - 1) * pj), 0.5, 2);
    const volDb = (Math.random() * 2 - 1) * vj;
    const peak = volume * dbTillGain(volDb);
    const fade = klamp(rampa == null ? 0.01 : rampa, 0.005, 0.02);
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + fade);
    const dur = buffer.duration / Math.max(0.01, src.playbackRate.value);
    const sluta = t + dur;
    if (dur > fade * 2 + 0.005) {
      gain.gain.setValueAtTime(peak, sluta - fade);
      gain.gain.linearRampToValueAtTime(0, sluta);
    }
    src.connect(gain);
    gain.connect(this.noder.bussar[buss] || this.noder.bussar.sfx);
    src.start(t);
    if (buss === 'voice') {
      this.duck({ attack: 0.15, release: 0.6 });
      this._duckTimer = setTimeout(() => this.unduck({ release: 0.6 }), Math.min(dur, 2) * 1000);
    }
    src.onended = () => {
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        /* redan bortkopplad */
      }
    };
    return { src, gain, bank, idx, duration: dur };
  }

  startLoop(id, bank, { buss = 'ambience', volume = 1, fade = 0.4, rate = 1 } = {}) {
    if (!this.ctx || !this.noder) return null;
    if (this.loopar.has(id)) this.stopLoop(id, { fade: 0.05 });
    const pack = this.bankar.get(bank);
    if (!pack) return null;
    let idx = pack.cursor % pack.buffers.length;
    if (idx === pack.last && pack.buffers.length > 1) idx = (idx + 1) % pack.buffers.length;
    pack.cursor = idx + 1;
    pack.last = idx;
    const src = this.ctx.createBufferSource();
    src.buffer = pack.buffers[idx];
    src.loop = true;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    const fadeIn = Math.max(0.02, fade);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + fadeIn);
    src.connect(gain);
    gain.connect(this.noder.bussar[buss] || this.noder.bussar.ambience);
    src.start(t);
    const rec = { src, gain, buss, volume, rate, bank, generated: false };
    this.loopar.set(id, rec);
    return rec;
  }

  setLoop(id, { volume, rate, fade = 0.05 } = {}) {
    const rec = this.loopar.get(id);
    if (!rec || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (volume != null) {
      rec.volume = volume;
      rec.gain.gain.cancelScheduledValues(t);
      rec.gain.gain.setValueAtTime(rec.gain.gain.value, t);
      rec.gain.gain.linearRampToValueAtTime(Math.max(0, volume), t + Math.max(0.02, fade));
    }
    if (rate != null && rec.src.playbackRate && rec.src.playbackRate.setTargetAtTime) {
      rec.rate = rate;
      rec.src.playbackRate.setTargetAtTime(rate, t, 0.03);
    }
  }

  stopLoop(id, { fade = 0.4 } = {}) {
    const rec = this.loopar.get(id);
    if (!rec) return;
    this.loopar.delete(id);
    const t = this.ctx ? this.ctx.currentTime : 0;
    try {
      rec.gain.gain.cancelScheduledValues(t);
      rec.gain.gain.setValueAtTime(rec.gain.gain.value, t);
      rec.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.02, fade));
      if (rec.src.stop) rec.src.stop(t + Math.max(0.02, fade) + 0.03);
    } catch {
      /* stop på redan stoppad källa */
    }
  }

  /** Ducking 150 ms attack / 600 ms release. */
  duck({ targets = ['music', 'ambience'], amount = 0.35, attack = 0.15, release = 0.6 } = {}) {
    if (!this.noder || !this.ctx) return;
    this._duckAntal += 1;
    this._sistaDuck = { targets, release };
    const t = this.ctx.currentTime;
    for (const namn of targets) {
      const node = this.noder.bussar[namn];
      if (!node) continue;
      const mal = this._effektivVolym(namn) * amount;
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.linearRampToValueAtTime(mal, t + attack);
    }
    if (this._duckTimer) clearTimeout(this._duckTimer);
    this._duckTimer = 0;
    void release;
  }

  unduck({ targets, release = 0.6 } = {}) {
    if (!this.noder || !this.ctx) return;
    this._duckAntal = Math.max(0, this._duckAntal - 1);
    if (this._duckAntal > 0) return;
    const tg = targets || (this._sistaDuck && this._sistaDuck.targets) || ['music', 'ambience'];
    const t = this.ctx.currentTime;
    for (const namn of tg) {
      const node = this.noder.bussar[namn];
      if (!node) continue;
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.linearRampToValueAtTime(this._effektivVolym(namn), t + release);
    }
  }

  /** Mjuk procedurpad — endast för demons musikbuss, inte UI/bladvändning. */
  startPad({ volume = 0.22, fade = 1.0 } = {}) {
    this._initGraph();
    this.stopLoop('musik-pad', { fade: 0.1 });
    const ctx = this.ctx;
    const master = ctx.createGain();
    const t = ctx.currentTime;
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(volume, t + fade);
    const freqs = [164.81, 196.0, 246.94, 293.66];
    const oscs = [];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * (i % 2 ? 1.001 : 0.999);
      const g = ctx.createGain();
      g.gain.value = 0.16;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 880;
      lp.Q.value = 0.6;
      o.connect(g);
      g.connect(lp);
      lp.connect(master);
      o.start();
      oscs.push(o);
    });
    master.connect(this.noder.bussar.music);
    this.loopar.set('musik-pad', {
      src: {
        stop(at) {
          oscs.forEach((o) => {
            try {
              o.stop(at);
            } catch {
              /* */
            }
          });
        },
        playbackRate: { setTargetAtTime() {} },
      },
      gain: master,
      buss: 'music',
      volume,
      generated: true,
    });
  }

  _vidSynlighet() {
    if (!this.ctx) return;
    if (document.hidden) {
      this._kordeInnanDolj = this.ctx.state === 'running';
      this.ctx.suspend().catch(() => {});
    } else if (this._kordeInnanDolj && !this._onskadePaus) {
      this.ctx.resume().catch(() => {});
    }
  }
}

/**
 * Renderar en buffer genom samma kompressor+limiter och mäter dBTP (4×) och ungefärlig LUFS.
 */
export async function renderaOchMata({ audioBuffer, sampleRate, inkluderGraph = true }) {
  const sr = sampleRate || audioBuffer.sampleRate;
  const duration = Math.max(0.8, audioBuffer.duration + 0.35);
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sr), sr);
  const src = ctx.createBufferSource();
  src.buffer = audioBuffer;
  const fade = ctx.createGain();
  fade.gain.setValueAtTime(0, 0);
  fade.gain.linearRampToValueAtTime(1, 0.01);
  const sluta = audioBuffer.duration;
  if (sluta > 0.03) {
    fade.gain.setValueAtTime(1, Math.max(0.01, sluta - 0.01));
    fade.gain.linearRampToValueAtTime(0, sluta);
  }
  src.connect(fade);
  let tail = fade;
  if (inkluderGraph) {
    const kompressor = ctx.createDynamicsCompressor();
    kompressor.threshold.value = -18;
    kompressor.knee.value = 10;
    kompressor.ratio.value = 3;
    kompressor.attack.value = 0.006;
    kompressor.release.value = 0.22;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;
    fade.connect(kompressor);
    kompressor.connect(limiter);
    tail = limiter;
  }
  tail.connect(ctx.destination);
  src.start(0);
  const rendered = await ctx.startRendering();
  return mataBuffer(rendered);
}

export function mataBuffer(buf) {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const sr = buf.sampleRate;
  const kanaler = [];
  for (let c = 0; c < ch; c++) kanaler.push(buf.getChannelData(c));

  let peak = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) peak = Math.max(peak, Math.abs(kanaler[c][i]));
  }

  // True-peak: 4× linjär översampling av abs-max mellan samplar (konservativ undre gräns för dBTP).
  // 4-punkters mitt emellan + kvartil.
  let tp = peak;
  for (let i = 0; i < n - 1; i++) {
    for (let c = 0; c < ch; c++) {
      const a = kanaler[c][i];
      const b = kanaler[c][i + 1];
      for (let k = 1; k < 4; k++) {
        const x = a + (k / 4) * (b - a);
        tp = Math.max(tp, Math.abs(x));
      }
    }
  }

  // Ungefärlig K-vägning via två biquads i Offline? Här IIR i JS.
  // Steg 1: höghylla ~+4 dB @ 1500 Hz. Steg 2: högpass ~38 Hz (BS.1770-ish).
  const kLeft = kVikta(kanaler[0], sr);
  const kRight = ch > 1 ? kVikta(kanaler[1], sr) : kLeft;
  let acc = 0;
  let accAkt = 0;
  let nAkt = 0;
  for (let i = 0; i < n; i++) {
    const z = (kLeft[i] * kLeft[i] + kRight[i] * kRight[i]) / 2;
    acc += z;
    // enkel grind: räkna bara när K-vägd rms i 100 ms-fönster skulle vara relevant
    if (z > 1e-8) {
      accAkt += z;
      nAkt += 1;
    }
  }
  const mean = acc / Math.max(1, n);
  const meanAkt = accAkt / Math.max(1, nAkt);
  const lufs = -0.691 + 10 * Math.log10(Math.max(1e-12, mean));
  const lufsAktiv = -0.691 + 10 * Math.log10(Math.max(1e-12, meanAkt));

  return {
    peak_dbfs: gainTillDb(peak),
    dBTP: gainTillDb(tp),
    lufs,
    lufsAktiv,
    duration_s: n / sr,
    sampleRate: sr,
  };
}

function kVikta(input, sr) {
  // RBJ höghylla +4 dB @ 1500 Hz, Q ~ 0.707
  const shelf = biquadHighshelf(sr, 1500, 0.707, 4);
  const hp = biquadHighpass(sr, 38, 0.5);
  const a = applyBiquad(input, shelf);
  return applyBiquad(a, hp);
}

function biquadHighshelf(sr, f0, Q, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * Q);
  const b0 = A * (A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * alpha);
  const b1 = -2 * A * (A - 1 + (A + 1) * cos);
  const b2 = A * (A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * alpha);
  const a0 = A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
  const a1 = 2 * (A - 1 - (A + 1) * cos);
  const a2 = A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * alpha;
  return normBiquad(b0, b1, b2, a0, a1, a2);
}

function biquadHighpass(sr, f0, Q) {
  const w0 = (2 * Math.PI * f0) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * Q);
  const b0 = (1 + cos) / 2;
  const b1 = -(1 + cos);
  const b2 = (1 + cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  return normBiquad(b0, b1, b2, a0, a1, a2);
}

function normBiquad(b0, b1, b2, a0, a1, a2) {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function applyBiquad(input, c) {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}
