(function(){
'use strict';

/* ---- ljudmotor.js ---- */
/**
 * Kvarnen ljudmotor — delat fundament, etapp 1.
 * Mixbussar music/ambience/sfx/ui/voice → master → kompressor (~3:1) → limiter.
 * Genererade impulssvar (ConvolverNode), round-robin, ducking, iOS-upplåsning.
 */
const BUSSAR = Object.freeze(['music', 'ambience', 'sfx', 'ui', 'voice']);
const RUM = Object.freeze(['inget', 'rum', 'talt', 'grotta', 'skog']);

const LAGRA_NYCKEL = 'kvarnen.ljud.volymer';

function klamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function dbTillGain(db) {
  return Math.pow(10, db / 20);
}

function gainTillDb(g) {
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

class Ljudmotor {
  constructor({ storageKey = LAGRA_NYCKEL, basUrl = '../delat/ljud/' } = {}) {
    this.storageKey = storageKey;
    this.basUrl = basUrl.endsWith('/') ? basUrl : `${basUrl}/`;
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
          ogg: this.basUrl + f.ogg,
          m4a: this.basUrl + f.m4a,
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
async function renderaOchMata({ audioBuffer, sampleRate, inkluderGraph = true }) {
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

function mataBuffer(buf) {
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

/* ---- spar.js ---- */
/**
 * Kvarnen sparmodul — IndexedDB med localStorage-reserv,
 * autospar, manuell Spara ("Sparat hh:mm"), Fortsätt/Nytt,
 * export/import och navigator.storage.persist().
 */
const DB_NAMN = 'kvarnen-spar';
const STORE = 'spar';

function nuKlocka(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatSparat(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `Sparat ${nuKlocka(d)}`;
}

function idbTillganglig() {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function oppnaDb(namn = DB_NAMN) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(namn, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(val, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDel(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

class Spar {
  constructor({
    dbNamn = DB_NAMN,
    nyckel = 'demo',
    storageKey,
    autoMs = 4000,
  } = {}) {
    this.dbNamn = dbNamn;
    this.nyckel = nyckel;
    this.lsKey = storageKey || `kvarnen.spar.${nyckel}`;
    this.autoMs = autoMs;
    this.backend = 'none';
    this.db = null;
    this.senastSparat = null;
    this.senastKalla = null;
    this.persistOk = false;
    this._autoTimer = 0;
    this._getState = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try {
        fn(this);
      } catch {
        /* lyssnarfel ska inte stoppa sparandet */
      }
    }
  }

  async init() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        this.persistOk = await navigator.storage.persist();
      } catch {
        this.persistOk = false;
      }
    }
    if (idbTillganglig()) {
      try {
        this.db = await oppnaDb(this.dbNamn);
        this.backend = 'indexeddb';
      } catch {
        this.db = null;
        this.backend = 'localStorage';
      }
    } else {
      this.backend = 'localStorage';
    }
    const befintlig = await this.load();
    if (befintlig && befintlig.__sparat) {
      this.senastSparat = new Date(befintlig.__sparat);
      this.senastKalla = befintlig.__kalla || null;
    }
    this._emit();
    return this;
  }

  async load() {
    if (this.backend === 'indexeddb' && this.db) {
      try {
        const val = await idbGet(this.db, this.nyckel);
        if (val != null) return val;
      } catch {
        /* fall till localStorage */
      }
    }
    try {
      const raw = localStorage.getItem(this.lsKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async save(data, { kalla = 'auto' } = {}) {
    const now = new Date();
    const paket = {
      ...data,
      __sparat: now.toISOString(),
      __kalla: kalla,
      __version: 1,
    };
    let ok = false;
    if (this.backend === 'indexeddb' && this.db) {
      try {
        await idbPut(this.db, this.nyckel, paket);
        ok = true;
      } catch {
        ok = false;
      }
    }
    try {
      localStorage.setItem(this.lsKey, JSON.stringify(paket));
      ok = true;
      if (this.backend !== 'indexeddb') this.backend = 'localStorage';
    } catch {
      if (!ok) throw new Error('Kunde inte spara');
    }
    this.senastSparat = now;
    this.senastKalla = kalla;
    this._emit();
    return paket;
  }

  async clear() {
    if (this.backend === 'indexeddb' && this.db) {
      try {
        await idbDel(this.db, this.nyckel);
      } catch {
        /* */
      }
    }
    try {
      localStorage.removeItem(this.lsKey);
    } catch {
      /* */
    }
    this.senastSparat = null;
    this.senastKalla = null;
    this._emit();
  }

  formatSparat() {
    return formatSparat(this.senastSparat);
  }

  watch(getState, { autoMs } = {}) {
    this._getState = getState;
    if (autoMs != null) this.autoMs = autoMs;
    this.stopWatch();
    if (this.autoMs > 0) {
      this._autoTimer = setInterval(() => {
        this.autosave().catch(() => {});
      }, this.autoMs);
    }
    return () => this.stopWatch();
  }

  stopWatch() {
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = 0;
    }
  }

  async autosave() {
    if (!this._getState) return null;
    return this.save(this._getState(), { kalla: 'auto' });
  }

  async sparaManuellt() {
    if (!this._getState) throw new Error('Ingen state-funktion bunden');
    return this.save(this._getState(), { kalla: 'manual' });
  }

  /**
   * Fortsätt om det finns en sparfil, annars null.
   * Nytt: bekräftelse via opts.bekrafta (fn som returnerar Promise<boolean>)
   * eller window.confirm.
   */
  async nytt({ bekrafta } = {}) {
    const finns = !!(await this.load());
    if (finns) {
      let ok;
      if (typeof bekrafta === 'function') ok = await bekrafta();
      else ok = typeof window !== 'undefined' ? window.confirm('Börja om och radera sparandet?') : false;
      if (!ok) return { avbrott: true };
    }
    await this.clear();
    return { avbrott: false, nytt: true };
  }

  async exportFil({ filnamn } = {}) {
    const data = (await this.load()) || (this._getState ? { ...this._getState(), __sparat: new Date().toISOString(), __kalla: 'export' } : null);
    if (!data) throw new Error('Inget att exportera');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const namn = filnamn || `kvarnen-spar-${this.nyckel}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = namn;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return data;
  }

  async importFil(file) {
    const text = typeof file === 'string' ? file : await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('Ogiltig sparfil');
    await this.save(data, { kalla: 'import' });
    return data;
  }
}

function monteraBekraftelse({ titel = 'Börja om?', text = 'Det raderar det sparade läget.', okEtikett = 'Nytt', avbrytEtikett = 'Avbryt' } = {}) {
  return () =>
    new Promise((resolve) => {
      const bak = document.createElement('div');
      bak.className = 'kvarnen-dialog-bak';
      bak.innerHTML = `<div class="kvarnen-dialog" role="dialog" aria-modal="true" aria-labelledby="kvarnen-dialog-titel">
        <h2 id="kvarnen-dialog-titel">${titel}</h2>
        <p>${text}</p>
        <div class="kvarnen-dialog-knappar">
          <button type="button" data-avbryt>${avbrytEtikett}</button>
          <button type="button" class="primar" data-ok>${okEtikett}</button>
        </div>
      </div>`;
      const stang = (val) => {
        bak.remove();
        resolve(val);
      };
      bak.querySelector('[data-avbryt]').addEventListener('click', (e) => { e.stopPropagation(); stang(false); });
      bak.querySelector('[data-ok]').addEventListener('click', (e) => { e.stopPropagation(); stang(true); });
      bak.querySelector('.kvarnen-dialog').addEventListener('click', (e) => e.stopPropagation());
      bak.addEventListener('click', (e) => {
        if (e.target === bak) stang(false);
      });
      document.body.appendChild(bak);
      bak.querySelector('[data-avbryt]').focus();
    });
}

/* ---- partiklar.js ---- */
/**
 * Poolad partikelmotor — inga allokeringar i den varma loopen.
 */
class PartikelLag {
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

/* ---- skarmovergangar.js ---- */
/**
 * Skärmövergångar som följer rörelsetokens och prefers-reduced-motion.
 */
function reduceradRorelse() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensurOverlay(host = document.body) {
  let el = host.querySelector('.kvarnen-overgang');
  if (!el) {
    el = document.createElement('div');
    el.className = 'kvarnen-overgang';
    el.setAttribute('aria-hidden', 'true');
    host.appendChild(el);
  }
  return el;
}

function durMs(cssVar, fallback) {
  if (reduceradRorelse()) return 1;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  if (!raw) return fallback;
  if (raw.endsWith('ms')) return parseFloat(raw);
  if (raw.endsWith('s')) return parseFloat(raw) * 1000;
  return fallback;
}

function fade({ host, farg = 'var(--yta-natt, #1a1410)', ms } = {}) {
  const el = ensurOverlay(host || document.body);
  const tid = ms != null ? (reduceradRorelse() ? 1 : ms) : durMs('--dur-medel', 280);
  el.style.background = farg;
  el.style.transition = `opacity ${tid}ms var(--ease-ut, cubic-bezier(0.16, 1, 0.3, 1))`;
  el.classList.add('synlig');
  el.style.opacity = '1';
  return new Promise((resolve) => {
    setTimeout(() => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      setTimeout(() => {
        el.classList.remove('synlig');
        resolve();
      }, tid);
    }, tid);
  });
}

function fadeGenom({ host, farg = '#1a1410', ms, mitt } = {}) {
  const el = ensurOverlay(host || document.body);
  const tid = ms != null ? (reduceradRorelse() ? 1 : ms) : durMs('--dur-lang', 500);
  el.style.background = farg;
  el.style.transition = `opacity ${tid}ms var(--ease-ut, cubic-bezier(0.16, 1, 0.3, 1))`;
  el.classList.add('synlig');
  el.style.opacity = '1';
  return new Promise((resolve) => {
    setTimeout(async () => {
      if (typeof mitt === 'function') await mitt();
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      setTimeout(() => {
        el.classList.remove('synlig');
        resolve();
      }, tid);
    }, tid);
  });
}

function svep({ host, riktning = 'vanster', farg = '#1a1410', ms } = {}) {
  const el = ensurOverlay(host || document.body);
  const tid = ms != null ? (reduceradRorelse() ? 1 : ms) : durMs('--dur-medel', 280);
  const from = riktning === 'hoger' ? '100%' : riktning === 'upp' ? '0 -100%' : riktning === 'ner' ? '0 100%' : '-100%';
  el.style.background = farg;
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.style.transform = `translate(${from})`;
  el.classList.add('synlig');
  el.offsetHeight;
  el.style.transition = `transform ${tid}ms var(--ease-ut, cubic-bezier(0.16, 1, 0.3, 1))`;
  el.style.transform = 'translate(0,0)';
  return new Promise((resolve) => {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = '';
      el.classList.remove('synlig');
      resolve();
    }, tid + 40);
  });
}

const Skarmovergangar = { fade, fadeGenom, svep, reduceradRorelse, ensurOverlay };

/* ---- boksidor.js ---- */
/** Ritar pergament-sidor till canvas (ingen extern grafik). */

function brus(ctx, w, h, alfa = 0.07) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 200 + Math.random() * 40;
    d[i] = n;
    d[i + 1] = n - 12;
    d[i + 2] = n - 40;
    d[i + 3] = Math.floor(255 * alfa);
  }
  ctx.putImageData(img, 0, 0);
}

function radbryt(ctx, text, maxW) {
  const ord = String(text).split(/\s+/);
  const rader = [];
  let rad = '';
  for (const o of ord) {
    const prova = rad ? `${rad} ${o}` : o;
    if (ctx.measureText(prova).width > maxW && rad) {
      rader.push(rad);
      rad = o;
    } else rad = prova;
  }
  if (rad) rader.push(rad);
  return rader;
}

async function vantaTypsnitt() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load('16px "Cormorant Garamond"');
    await document.fonts.load('italic 16px "Cormorant Garamond"');
    await document.fonts.load('20px Cinzel');
    await document.fonts.ready;
  } catch {
    /* systemfallback */
  }
}

function ritaBoksida(cssW, cssH, { rubrik, text, folio, typ = 'brod', dpr = 2 } = {}) {
  const c = document.createElement('canvas');
  const w = Math.max(2, Math.round(cssW * dpr));
  const h = Math.max(2, Math.round(cssH * dpr));
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const grund = typ === 'omslag' ? '#3a2a1c' : typ === 'kolofon' ? '#efe3c4' : '#f3e6c8';
  ctx.fillStyle = grund;
  ctx.fillRect(0, 0, w, h);

  if (typ === 'omslag') {
    ctx.fillStyle = 'rgba(196,164,106,0.15)';
    ctx.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
    ctx.strokeStyle = 'rgba(196,164,106,0.7)';
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
    ctx.fillStyle = '#f6eedc';
    ctx.font = `${Math.round(w * 0.09)}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rubrik || 'Kvarnen', w / 2, h * 0.46);
    ctx.font = `italic ${Math.round(w * 0.045)}px "Cormorant Garamond", serif`;
    ctx.fillStyle = '#c4a46a';
    ctx.fillText(text || '', w / 2, h * 0.58);
    return c;
  }

  // marginaler
  ctx.save();
  brus(ctx, w, h, typ === 'flygblad' ? 0.05 : 0.08);
  ctx.restore();
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(80,50,20,0.08)');
  g.addColorStop(0.08, 'rgba(80,50,20,0)');
  g.addColorStop(0.92, 'rgba(255,255,240,0)');
  g.addColorStop(1, 'rgba(80,50,20,0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const mx = w * 0.14;
  const my = h * 0.13;
  ctx.fillStyle = '#2a2118';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (typ === 'flygblad') {
    ctx.fillStyle = 'rgba(42,33,24,0.35)';
    ctx.font = `italic ${Math.round(w * 0.045)}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text || '', w / 2, h * 0.48);
    return c;
  }

  let y = my;
  if (rubrik) {
    ctx.font = `${Math.round(w * 0.07)}px Cinzel, serif`;
    ctx.fillStyle = '#2a2118';
    const rader = radbryt(ctx, rubrik, w - mx * 2);
    for (const r of rader) {
      ctx.fillText(r, mx, y);
      y += w * 0.09;
    }
    y += h * 0.03;
    ctx.strokeStyle = 'rgba(196,164,106,0.7)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(mx, y);
    ctx.lineTo(w - mx, y);
    ctx.stroke();
    y += h * 0.05;
  }

  if (text) {
    ctx.font = `${Math.round(w * 0.048)}px "Cormorant Garamond", serif`;
    ctx.fillStyle = '#2a2118';
    const lh = w * 0.072;
    const stycken = String(text).split('\n');
    for (const st of stycken) {
      const rader = radbryt(ctx, st, w - mx * 2);
      for (const r of rader) {
        if (y > h - my * 1.2) break;
        ctx.fillText(r, mx, y);
        y += lh;
      }
      y += lh * 0.35;
    }
  }

  if (folio != null) {
    ctx.font = `${Math.round(w * 0.036)}px Cinzel, serif`;
    ctx.fillStyle = 'rgba(42,33,24,0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(folio), w / 2, h - h * 0.06);
  }
  return c;
}

const DEMO_SIDOR = [
  { typ: 'flygblad', text: 'SkaparKvarnen' },
  { typ: 'omslag', rubrik: 'Kvarnen vid ån', text: 'En liten visning av fundamentet' },
  { typ: 'brod', rubrik: 'Kvällen', text: 'När skuggan nådde kvarnhjulet tystnade ån ett ögonblick, som om den lyssnade. Dammet i luften stod stilla. Det luktade varmt trä och kallt vatten.', folio: 3 },
  { typ: 'brod', text: 'Inne i huset låg en bok uppslagen på bordet. Bladen hade den där mjuka kanten som bara kommer av att någon vänt dem ofta, utan brådska.', folio: 4 },
  { typ: 'brod', rubrik: 'Bladet', text: 'Man kan tro att en sida bara är papper. Men när den lyfts hörs först ett litet friktionsljud, sedan en kort båge i luften, och till sist landningen mot nästa blad.', folio: 5 },
  { typ: 'brod', text: 'Det är den rörelsen den här demosidan vill mer än något annat: att fingret får leda, att vikten följer med, och att boken själv avgör om den ska vända eller falla tillbaka.', folio: 6 },
  { typ: 'brod', rubrik: 'Spara', text: 'Till höger om ån står en liten lykta. Den minns var du var. Tryck Spara, eller låt den göra det tyst. Fortsätt en annan kväll. Börja om bara om du verkligen vill.', folio: 7 },
  { typ: 'kolofon', rubrik: 'Slut för i kväll', text: 'Ljuden är inspelade papper, inte oscillatorer. Rummet är ett ritat eko. Vänd gärna tillbaka.', folio: 8 },
];

async function byggDemosidor(cssW, cssH) {
  await vantaTypsnitt();
  return DEMO_SIDOR.map((s) => ritaBoksida(cssW, cssH, s));
}

/* ---- sidvandning.js ---- */
/**
 * Sidvändning, nivå 2: canvas-böj som följer fingret, fjäderfysik, dynamisk skugga.
 * Nivå 1 (CSS 3D rotateY) som reserv. prefers-reduced-motion ger övertoning.
 * PageSound: lyft, friktion kopplad till hastighet, flip och lager-landning.
 */

const STYV = 0.0028;
const DAMP = 0.86;
const GRAB = 0.18;

class PageSound {
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

class Sidvandning {
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

/* ---- prydnad.js ---- */
/** Geometriska ramar och hörnornament, ritade i kod. Ingen läsbar text. */

const FARG = Object.freeze({
  indigo: '#12182e',
  turkos: '#2a6f78',
  guld: '#e2b657',
  karmosin: '#8a2430',
  sand: '#e8d7b0',
  barnsten: '#e9a55b',
  papper: '#f3e6c8',
  bläck: '#2a2118',
});

function ram(ctx, x, y, w, h, dpr, { farg = FARG.guld, inset = 0.06 } = {}) {
  const m = Math.min(w, h) * inset;
  const lw = Math.max(1, 1.15 * dpr);
  ctx.save();
  ctx.strokeStyle = farg;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = lw;
  ctx.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = lw * 0.6;
  ctx.strokeRect(x + m + 3 * dpr, y + m + 3 * dpr, w - 2 * m - 6 * dpr, h - 2 * m - 6 * dpr);
  ctx.restore();
  horn(ctx, x + m, y + m, w - 2 * m, h - 2 * m, dpr, farg);
}

function horn(ctx, x, y, w, h, dpr, farg = FARG.guld) {
  const s = Math.min(w, h) * 0.085;
  ctx.save();
  ctx.strokeStyle = farg;
  ctx.lineWidth = Math.max(1, 1.2 * dpr);
  ctx.lineCap = 'square';
  const hörn = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [hx, hy, dx, dy] of hörn) {
    ctx.beginPath();
    ctx.moveTo(hx + dx * s, hy);
    ctx.lineTo(hx, hy);
    ctx.lineTo(hx, hy + dy * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + dx * s * 0.45, hy + dy * 3 * dpr);
    ctx.lineTo(hx + dx * 3 * dpr, hy + dy * 3 * dpr);
    ctx.lineTo(hx + dx * 3 * dpr, hy + dy * s * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function medaljong(ctx, cx, cy, r, dpr, farg = FARG.guld) {
  ctx.save();
  ctx.strokeStyle = farg;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(1, 1.1 * dpr);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  // Åttauddig stjärna, geometrisk, ingen skrift
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r * 0.42 : r * 0.2;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Enkel papperstextur; ersätts/förstärks i G5 mot målningarna. */
function papper(ctx, w, h, { grund = FARG.papper, alfa = 0.1 } = {}) {
  ctx.fillStyle = grund;
  ctx.fillRect(0, 0, w, h);
  const tw = 96, th = 96;
  const off = document.createElement('canvas');
  off.width = tw; off.height = th;
  const octx = off.getContext('2d');
  const tmp = octx.createImageData(tw, th);
  const d = tmp.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alfa;
    d[i] = 40; d[i + 1] = 28; d[i + 2] = 12;
    d[i + 3] = Math.max(0, Math.min(36, 14 + n));
  }
  octx.putImageData(tmp, 0, 0);
  const pat = ctx.createPattern(off, 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(80,50,20,0.08)');
  g.addColorStop(0.1, 'rgba(80,50,20,0)');
  g.addColorStop(0.9, 'rgba(255,255,240,0)');
  g.addColorStop(1, 'rgba(80,50,20,0.07)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function nattBakgrund(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1a2340');
  g.addColorStop(0.55, FARG.indigo);
  g.addColorStop(1, '#0b0e18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/* ---- verser.js ---- */
const VERSER = {
  "1": {
    "natt": 1,
    "mesra": [
      "چنین داد پاسخ که تهمینه‌ام",
      "تو گویی که از غم به دو نیمه‌ام"
    ],
    "tolkning": "Hon svarade: jag är Tahmina. Av sorg är jag som kluven itu.",
    "anmarkning": "تهمینه i källtexten återges med den låsta svenska formen Tahmina. غم översatt som sorg, inte längtan.",
    "kalla": {
      "namn": "Ganjoor",
      "url": "https://ganjoor.net/ferdousi/shahname/sohrab/sh4",
      "api": "https://api.ganjoor.net/api/ganjoor/poem/1462",
      "underkalla": "ویکی‌درج",
      "diktare": "Ferdowsi",
      "verk": "Shahnameh – Konungaboken",
      "avsnitt": "بخش ۴ - شب دیدار رستم و تهمینه، پیمان ازدواج و سپردن مهره",
      "slug": "sh4",
      "poem_id": 1462,
      "bayt": 9,
      "vOrder": [
        17,
        18
      ],
      "hamtad": "2026-11-21"
    }
  },
  "2": {
    "natt": 2,
    "mesra": [
      "ور ایدونک آید ز اختر پسر",
      "ببندش ببازو نشان پدر"
    ],
    "tolkning": "Om stjärnan ger en son, bind faderns tecken vid hans arm.",
    "anmarkning": "نشان پدر är faderns tecken, i vår brödtext armringen.",
    "kalla": {
      "namn": "Ganjoor",
      "url": "https://ganjoor.net/ferdousi/shahname/sohrab/sh4",
      "api": "https://api.ganjoor.net/api/ganjoor/poem/1462",
      "underkalla": "ویکی‌درج",
      "diktare": "Ferdowsi",
      "verk": "Shahnameh – Konungaboken",
      "avsnitt": "بخش ۴ - شب دیدار رستم و تهمینه، پیمان ازدواج و سپردن مهره",
      "slug": "sh4",
      "poem_id": 1462,
      "bayt": 41,
      "vOrder": [
        81,
        82
      ],
      "hamtad": "2026-11-21"
    }
  },
  "3": {
    "natt": 3,
    "mesra": [
      "ز تخم کیم وز کدامین گهر",
      "چه گویم چو پرسد کسی از پدر"
    ],
    "tolkning": "Av vilken stam är jag, av vilket ursprung? Vad ska jag svara när någon frågar efter min far?",
    "anmarkning": "تخم och گهر som stam och ursprung, inte som jordbruk eller ädelsten.",
    "kalla": {
      "namn": "Ganjoor",
      "url": "https://ganjoor.net/ferdousi/shahname/sohrab/sh5",
      "api": "https://api.ganjoor.net/api/ganjoor/poem/1463",
      "underkalla": "ویکی‌درج",
      "diktare": "Ferdowsi",
      "verk": "Shahnameh – Konungaboken",
      "avsnitt": "بخش ۵ - زادن سهراب، پرسش از تهمینه دربارهٔ پدر و عزم لشکرکشی به ایران و توران",
      "slug": "sh5",
      "poem_id": 1463,
      "bayt": 9,
      "vOrder": [
        17,
        18
      ],
      "hamtad": "2026-11-21"
    }
  },
  "4": {
    "natt": 4,
    "mesra": [
      "چنین داد پاسخ که رستم نیم",
      "هم از تخمهٔ سام نیرم نیم"
    ],
    "tolkning": "Han svarade: jag är inte Rostam, och inte av Sam Nirams stam.",
    "anmarkning": "سام نیرم läst som Sam Niram (sammansatt ättnamn), inte som två skilda personer.",
    "kalla": {
      "namn": "Ganjoor",
      "url": "https://ganjoor.net/ferdousi/shahname/sohrab/sh14",
      "api": "https://api.ganjoor.net/api/ganjoor/poem/1472",
      "underkalla": "ویکی‌درج",
      "diktare": "Ferdowsi",
      "verk": "Shahnameh – Konungaboken",
      "avsnitt": "بخش ۱۴ - خروش سهراب بر کاووس، برکندن سراپرده، دیدار نخست با رستم و انکار نام",
      "slug": "sh14",
      "poem_id": 1472,
      "bayt": 53,
      "vOrder": [
        105,
        106
      ],
      "hamtad": "2026-11-21"
    }
  },
  "5": {
    "natt": 5,
    "mesra": [
      "همانا که داری ز گردان نژاد",
      "کنی پیش من گوهر خویش یاد"
    ],
    "tolkning": "Om du är av kämparnas ätt, nämn din härkomst inför mig.",
    "anmarkning": "نژاد/گوهر som ätt och härkomst. Versen är en uppmaning att säga namnet, inte ett konstaterande att det redan är sagt.",
    "kalla": {
      "namn": "Ganjoor",
      "url": "https://ganjoor.net/ferdousi/shahname/sohrab/sh17",
      "api": "https://api.ganjoor.net/api/ganjoor/poem/1475",
      "underkalla": "ویکی‌درج",
      "diktare": "Ferdowsi",
      "verk": "Shahnameh – Konungaboken",
      "avsnitt": "بخش ۱۷ - گفت‌وگوی سهراب با هومان، پیشنهاد آشتی، و رهایی رستم در کشتی نخست به فریب",
      "slug": "sh17",
      "poem_id": 1475,
      "bayt": 26,
      "vOrder": [
        51,
        52
      ],
      "hamtad": "2026-11-21"
    }
  },
  "6": {
    "natt": 6,
    "mesra": [
      "چو بگشاد خفتان و آن مهره دید",
      "همه جامه بر خویشتن بردرید"
    ],
    "tolkning": "När han öppnade rustningen och såg tecknet, slet han kläderna av sig.",
    "anmarkning": "مهره är tecknet (stenen/armringen). Ingen beskrivning av såret läggs till.",
    "kalla": {
      "namn": "Ganjoor",
      "url": "https://ganjoor.net/ferdousi/shahname/sohrab/sh18",
      "api": "https://api.ganjoor.net/api/ganjoor/poem/1476",
      "underkalla": "ویکی‌درج",
      "diktare": "Ferdowsi",
      "verk": "Shahnameh – Konungaboken",
      "avsnitt": "بخش ۱۸ - کشته شدن سهراب بر دست رستم، شناختن پسر از مهره و بازداشتن پدر از خودکشی",
      "slug": "sh18",
      "poem_id": 1476,
      "bayt": 34,
      "vOrder": [
        67,
        68
      ],
      "hamtad": "2026-11-21"
    }
  },
  "7": {
    "natt": 7,
    "mesra": [
      "ازان نوشدارو که در گنج تست",
      "کجا خستگان را کند تن درست"
    ],
    "tolkning": "Av det botemedel som ligger i din skatt, som gör de sårade hela igen.",
    "anmarkning": "نوشدارو återges med termbankens botemedel, inte som ett egennamn.",
    "kalla": {
      "namn": "Ganjoor",
      "url": "https://ganjoor.net/ferdousi/shahname/sohrab/sh19",
      "api": "https://api.ganjoor.net/api/ganjoor/poem/1477",
      "underkalla": "ویکی‌درج",
      "diktare": "Ferdowsi",
      "verk": "Shahnameh – Konungaboken",
      "avsnitt": "بخش ۱۹ - درخواست نوشداروی رستم از کاووس و امتناع شاه از درمان سهراب",
      "slug": "sh19",
      "poem_id": 1477,
      "bayt": 5,
      "vOrder": [
        9,
        10
      ],
      "hamtad": "2026-11-21"
    }
  }
};

/* ---- content.js ---- */
// Rostam och Sohrab – nyskriven svensk återberättelse efter Ferdowsi.
// Inga långa citat ur skyddade eller overifierade översättningar.
// Persiska verser: se verser/VERSLOGG.md (Ganjoor, kontrollerade 21 nov 2026).
const BOOK = window.BOOK = {
  id: 'rostam-och-sohrab',
  title: 'Rostam och Sohrab',
  kicker: 'En natt vid elden',
  subtitle: 'Sju nätter ur Shahnameh – Konungaboken',
  icon: '◇', doneIcon: '◆', unit: 'Natt', unitPlural: 'nätter',
  defaultName: 'gäst',
  theme: { path: 'river' },
  labels: {
    begin: 'Sätt dig vid elden', afterIntro: 'Lyssna', start: 'Börja första natten',
    open: 'Öppna natten', welcome: 'Välkommen till elden, {namn}.',
    locked: 'Den natten har inte fallit än. En natt i taget.',
    pace: 'En natt, ett kapitel. Berättelsen behöver mörkret emellan.',
    dayDone: 'Natt {n} är läst. Eldröken lägger sig.'
  },
  namePrompt: 'Vad ska berättaren kalla dig, som sitter här i natt?',
  nameHint: 'Bara förnamnet räcker. Det är så man hälsar vid elden.',
  intentionPrompt: 'Vad vill du lägga märke till i den här berättelsen?',
  bookTitle: 'Din bok', bookSub: 'Det du såg, natt för natt, medan berättelsen lästes.',
  notice: {
    kicker: 'Innan elden tänds',
    title: 'En tung berättelse',
    body: [
      'En nyskriven svensk återberättelse efter Ferdowsi, ur Shahnameh – Konungaboken. Inte en översättning av någon skyddad utgåva.',
      'Berättelsen är en tragedi. En ung kämpe söker ett namn. Det som inte sägs i tid kan inte tas tillbaka. Du kan inte rädda slutet, bara lyssna klart, en natt i taget.',
      'Sohrab är en ung vuxen krigare, inte ett barn. Vi stannar vid namnet och tecknet, inte vid såren.'
    ]
  },
  glossary: [
    { term: 'Shahnameh – Konungaboken', body: 'Ferdowsis epos. Den samling den här natten är hämtad ur.' },
    { term: 'Ferdowsi', body: 'Diktaren. Han skrev på persiska, för länge sedan.' },
    { term: 'Tahmina', body: 'Kungens dotter i Samangan, Sohrabs mor. Hon säger sitt namn först.' },
    { term: 'Rakhsh', body: 'Rostams häst. En hjälte utan sin häst är bara en trött man.' },
    { term: 'Samangan', body: 'Staden där Rostam tas emot, och där Tahmina kommer till honom om natten.' },
    { term: 'Turan och Iran', body: 'Två riken. Sohrab går i tåget med Turans här för att finna sin far i Iran.' },
    { term: 'armring', body: 'Tecknet Rostam lämnar. Tahmina sätter den på Sohrabs arm. Den ska räcka för att fadern ska känna igen honom.' },
    { term: 'visir', body: 'Den del av hjälmen som kan sänkas över ansiktet. Den skyddar, och den döljer.' },
    { term: 'vadställe', body: 'Det grunda stället i floden, där man kan gå över mellan lägren.' },
    { term: 'botemedel', body: 'Det Rostam ber om i sista natten, när tiden redan är knapp.' }
  ],
  intro: [
    { t: 'Det är sent, och lägret har tystnat.', s: 'Bara en eld brinner kvar, och någon som kan berättelsen sitter redan där, med ryggen mot mörkret.' },
    { t: '”Kom”, säger rösten. ”I natt börjar Rostam och Sohrab.”', s: '”Det är ingen saga man skyndar sig genom. Den behöver sju nätter, och du får inte rädda slutet. Du får bara lyssna klart.”' },
    { t: 'Vinden kommer från floden, kall och ren.', s: 'Ett namn som inte sägs kan väga mer än ett svärd. Det får du se.' },
    { t: 'Berättaren ser på dig över glöden.', s: '”Säg vad du heter, så att elden vet vem som sitter här. Sen tänder vi första natten.”' }
  ],
  finale: {
    kicker: 'När elden sjunkit',
    title: 'Det som blev kvar',
    lines: [
      'Berättaren strör sand över den sista glöden. Det doftar rök och kall morgon.',
      '”Nu vet du hur det gick”, säger rösten. ”Du kunde inte vända det, och det var inte därför du satt här.”',
      '”Du skrev, {namn}: {reflektion.5|att namnet måste sägas}. Och när valet kom, valde du {val.5|att lyssna}.”',
      '”Ta med dig det ut ur mörkret. Inte som en läxa. Som en vana: att fråga, och att svara, medan det ännu finns tid.”',
      'Himlen över lägret blir grå. Någon långt borta sadlar en häst. Berättelsen är slut, och dagen är vanlig.'
    ]
  },
  days: [
    {
      n: 1, short: 'Samangan', place: 'Samangan', title: 'Den som kom om natten',
      chapter: [
        'Rostam hade jagat tills hästen Rakhsh försvann mellan kullarna. En hjälte utan sin häst är bara en trött man, och han gick till Samangans portar för att vila.',
        'Kungen tog emot honom med heder. I hallen brann lampor av mässing, och turkosplattorna höll kvar värmen. Rostam åt, tackade, och somnade tungt.',
        'Mitt i natten stod Tahmina i dörren. Hon var kungens dotter, och hon hade hört hans namn länge innan hon såg hans ansikte. ”Jag vet vem du är”, sade hon. ”Jag vill att vårt barn ska bära ditt mod, och jag vill att du ska veta mitt namn.”',
        'De talade lågt, utan skryt. I en stad som sover kan två människor säga sitt namn till varandra och mena det. Nästa natt får du se vad de lämnade efter sig.'
      ],
      principle: {
        name: 'Att bli sedd',
        body: 'Tahmina kommer inte som en gåta. Hon kommer med ett namn. Det som blir stort börjar ofta med att någon vågar säga vem hen är.',
        points: ['Ett namn är ingen prydnad, det är en nyckel', 'Den som döljer sig kan inte bli funnen', 'Mod kan vara att träda fram, inte bara att slå']
      },
      reflection: { q: 'När sade du senast ditt namn till någon på riktigt – inte av rutin, utan för att du ville bli känd?', hint: 'Skriv kort. En person, en plats, en mening.' },
      breath: { title: 'Elden', intro: 'Titta in i glöden. In, håll, ut, håll, sex sekunder vardera.' },
      mission: { title: 'Nattens uppdrag', body: 'Säg ditt namn tydligt till någon i dag, och lyssna lika tydligt på deras.' },
      cliff: 'På morgonen sadlas hästarna. Tahmina har ett tecken i handen, och Rostam måste rida. I morgon natt: det som lämnas kvar.',
      next: 'I morgon: Armringen – vad lämnar den som rider vidare?'
    },
    {
      n: 2, short: 'Armringen', place: 'Samangan', title: 'Det som lämnas kvar',
      chapter: [
        'Innan Rostam red bad Tahmina honom om ett tecken. Han gav henne en armring av guld, tung och enkel, utan inskrift. ”Om det blir en son”, sade han, ”sätt den på hans arm när han är stark nog att bära den. Då ska jag känna igen honom.”',
        'Han kysste henne och red. Rakhsh fanns åter, och slätten tog emot dem. Tahmina stod kvar i porten tills dammet lagt sig.',
        'När sonen föddes gav hon honom namnet Sohrab. Han växte snabbt, som om åren hade bråttom. En dag frågade han efter sin far. Hon tvekade, sedan talade hon sant, och hon gav honom ringen.',
        '”Sök honom”, sade hon, ”men säg ditt namn tidigt. Stolthet är en dimma, min son. Gå inte in i den.” Sohrab lyssnade – och redan då hörde han mest orden om att söka, inte orden om att säga.'
      ],
      principle: {
        name: 'Att lämna ett tecken',
        body: 'Ringen är ett löfte: jag ska känna igen dig. Men ett löfte som inte följs av en fråga räcker inte. Det får ligga mot huden i åratal och ändå komma fram för sent.',
        points: ['Ett tecken behöver en mun som talar', 'Att rida vidare är också ett val', 'Det vi lämnar efter oss måste kunna förstås']
      },
      reflection: { q: 'Vad har du lämnat efter dig till någon – ett löfte, ett tecken, en mening – som ännu inte är uttalat till punkt?', hint: 'Skriv vad det är, och vad som saknas för att det ska bli tydligt.' },
      breath: { title: 'Elden', intro: 'Håll ringen i tanken: tung, enkel, utan ord. In, håll, ut, håll.' },
      mission: { title: 'Nattens uppdrag', body: 'Skriv en enda mening till någon du bryr dig om, och skicka den i dag.' },
      choice: {
        prompt: 'Om du hade varit Tahmina vid porten, vad hade du ropat sist?',
        options: [
          { id: 'name', label: 'Säg ditt namn tidigt, vad det än kostar' },
          { id: 'seek', label: 'Sök honom. Resten får tiden sköta' }
        ]
      },
      cliff: 'Sohrab samlar män. Han ska inte bara finna en far – han ska sätta honom på en tron. I morgon natt: två läger vid samma flod.',
      next: 'I morgon: Tåget – två härar, en enda fråga.'
    },
    {
      n: 3, short: 'Tåget', place: 'Floden', title: 'Två läger, en flod',
      chapter: [
        'Sohrab gick i tåget med Turans här, inte för att lägga Iran öde, utan för att finna Rostam och lyfta honom till kungen. Det var en sons plan, stor och farlig, och den lät som ära i de andras öron.',
        'Vid floden slogs lägren upp mot varandra. På ena sidan vaknade Irans eldar, på den andra Turans. Mellan dem rann vattnet, grunt vid vadstället, djupt längre ner.',
        'Rostam var i Irans läger. Han hörde talas om en ung kämpe av ovanlig kraft, och något i honom rörde sig – en aning, inte mer. Han sade inte sitt namn högt den kvällen. Ingen frågade Sohrab klart.',
        'Från strand till strand såg man bara tält och rök. Två frågor gick mot samma vad. Ingen av dem hade ännu fått en mun.'
      ],
      principle: {
        name: 'Att söka utan att fråga',
        body: 'Sohrab söker en far. Rostam anar en son. Ändå står de på varsin strand. Sökandet utan frågan är redan början på sorgen.',
        points: ['Närhet är inte samma sak som erkännande', 'En aning som inte uttalas hjälper ingen', 'Floden mellan två människor är ofta bara ett ord']
      },
      reflection: { q: 'Vem står du nära just nu, utan att ni har sagt det viktigaste till varandra?', hint: 'Inga långa förklaringar. Ett namn, och meningen ni inte har sagt.' },
      breath: { title: 'Floden', intro: 'Andas som vattnet: in mot en strand, ut mot den andra. Sex sekunder.' },
      mission: { title: 'Nattens uppdrag', body: 'Tänk på någon på andra sidan en tystnad. Ta ett litet steg över: ett meddelande, en fråga, ett hej.' },
      cliff: 'I morgon ska härarna välja kämpar. En ung man träder fram, och en äldre. I morgon natt: den okände.',
      next: 'I morgon: Den okände – två kämpar utan namn.'
    },
    {
      n: 4, short: 'Den okände', place: 'Fältet', title: 'Två kämpar',
      chapter: [
        'När morgonen kom ropades det efter den som skulle bära striden. Ur Turans led steg Sohrab, ung och rak, med ringen under ärmen. Ur Irans led steg Rostam, tung i steget, med visiret sänkt.',
        'De såg varandra och kände en främmande värme, som släktskap utan namn. Sohrab frågade, försiktigt, om den äldre var Rostam. Svaret kom undan. Rostam ville inte ge sitt namn åt en fiende. Stoltheten talade först.',
        'De slogs den dagen tills dammet stod som en vägg. De var jämna på ett sätt som skrämde båda. När skymningen föll skilde de sig, oskadda nog att återvända, och var och en bar en fråga in i tältet.',
        'Runt cirkeln stod hästarna och väntade. Ingen i lägren visste att världen hade ställt far och son mot varandra, och att dagen hade gått utan att någon sagt det enda som hade räckt.'
      ],
      principle: {
        name: 'Att stå mot den man inte känner',
        body: 'De slåss för att de inte vet. Vetandet låg en fråga bort. Natten ger rum att känna hur nära det var, och hur långt det ändå var.',
        points: ['Visiret skyddar, och det döljer', 'En fråga i rätt tid väger mer än ett hugg', 'Det som känns som öde är ofta tystnad']
      },
      reflection: { q: 'När mötte du senast någon med visiret nere – du eller den andre – och vad blev osagt?', hint: 'Skriv mötet i tre rader.' },
      breath: { title: 'Dammet lägger sig', intro: 'Andas ut längre än du andas in. Låt cirkeln i dammet tystna.' },
      mission: { title: 'Nattens uppdrag', body: 'När du talar med någon i dag, lyft visiret en gång: säg vad du faktiskt menar.' },
      cliff: 'Andra dagen väntar. Sohrab har nästan frågat. Rostam har nästan svarat. I morgon natt: frågan.',
      next: 'I morgon: Frågan – det som nästan sägs.'
    },
    {
      n: 5, short: 'Frågan', place: 'Fältet', title: 'Det som inte sägs',
      chapter: [
        'Andra dagen var tyngre. Sohrab pressade den äldre bakåt, och i ett andetag hade han övertaget. Då, mitt i andhämtningen, låg frågan mellan dem igen, nästan färdig.',
        '”Säg vem du är”, kunde någon ha ropat. Ingen gjorde det klart. Rostam samlade sig ur nästan-förlusten och vägrade fortfarande att ge sitt namn åt den unge. Sohrab, stolt över sin styrka, trodde att tiden var på hans sida.',
        'De skildes en andra skymning. I båda tälten brann lampor. I båda tälten fanns en chans kvar. Berättaren tystnar här lite längre än vanligt, som om natten själv ber dig lägga märke till den chansen.',
        'Du som sitter vid elden vet mer än de. Det är därför det gör ont. I morgon natt kommer ringen fram. Den kommer inte i tid.'
      ],
      principle: {
        name: 'Frågan som inte ställs',
        body: 'Här väger den osagda meningen som tyngst. Allt som kommer efteråt hänger på den. Stolthet är inte alltid högljudd. Ibland är den bara tyst när den borde tala.',
        points: ['Nästan är inte samma sak som sagt', 'Tid som känns riklig kan vara den sista', 'Att fråga är också ett slags mod']
      },
      reflection: { q: 'Vilken fråga har du skjutit upp, och vad vore den minsta ärliga formuleringen i dag?', hint: 'Skriv frågan som du skulle säga den, i ett enda andetag.' },
      breath: { title: 'Mellan två dagar', intro: 'In, håll, ut, håll. Låt frågan vila i utandningen, osagd ännu.' },
      mission: { title: 'Nattens uppdrag', body: 'Ställ en fråga du har skjutit upp. Den behöver inte vara stor. Den behöver vara sann.' },
      choice: {
        prompt: 'Om du hade stått vid cirkelns kant den andra skymningen, vad hade du ropat?',
        options: [
          { id: 'ask', label: 'Ropa att de ska säga sina namn' },
          { id: 'wait', label: 'Tiga, och tro att morgondagen räcker' }
        ]
      },
      cliff: 'Tredje dagen gryr redan i öster. I morgon natt: ringen.',
      next: 'I morgon: Ringen – när tecknet kommer för sent.'
    },
    {
      n: 6, short: 'Ringen', place: 'Fältet', title: 'När tecknet kommer',
      chapter: [
        'Tredje dagen samlade Rostam all sin kraft. Hugget som föll var tungt och slutgiltigt. Sohrab sjönk, inte som en fiende i en visa, utan som en ung man som plötsligt förstod att tiden var ute.',
        'Då, först då, öppnades ärmen. Armringen låg där, den som Tahmina hade fått, den som Rostam själv hade lämnat. Guldet fattade sista ljuset. Rostam kände igen sitt eget tecken, och världen ändrade tyngd.',
        'Han ropade sonens namn när namnet inte längre kunde bära honom tillbaka. Sohrab såg på honom utan hat. Det fanns ingen tid över för hat. Det fanns bara den korta, klara sorgen att de hade stått så nära.',
        'Berättaren säger inte mer om såret. Det som ska ses är ringen i ljuset, och två människor som äntligen vet.'
      ],
      principle: {
        name: 'Att känna igen för sent',
        body: 'Igenkänningen är inte en tröst som suddar ut det som skett. Den är sanningen, och den kommer med sitt pris. Vi stannar här utan att vända bort blicken, och utan att göra scenen till skådespel.',
        points: ['Ett tecken måste fram medan någon ännu kan svara', 'Sorgen efteråt är också en form av kärlek', 'Att se klart kan göra ont, och ändå vara rätt']
      },
      reflection: { q: 'Finns det någon du vill känna igen – eller bli igenkänd av – medan det fortfarande finns tid? Vad vore första steget?', hint: 'Skriv steget så litet att du kan ta det i veckan.' },
      breath: { title: 'Det stilla fältet', intro: 'Andas långsamt. Ingen brådska. Sex sekunder, fyra gånger.' },
      mission: { title: 'Nattens uppdrag', body: 'Hör av dig till någon du har väntat med att erkänna, eller be om ursäkt, eller bara hälsa.' },
      cliff: 'Ännu en natt återstår. Rostam ska be om ett botemedel. Hovet ska tveka. I morgon: klagosången.',
      next: 'I morgon: Klagosången – det som inte kan skyndas ikapp.'
    },
    {
      n: 7, short: 'Klagosången', place: 'Lägret', title: 'Det som blev kvar',
      chapter: [
        'Rostam sände bud till kungen om ett botemedel, med en röst som inte längre liknade en hjältes. Budet nådde hovet. Där vägdes gammalt groll tyngre än brådskan, och svaret fördröjdes.',
        'När hjälpen inte kom i tid dog Sohrab i lägret, med ringen ännu vid armen. Rostam klagade så att de som stod långt borta tystnade. Tahmina, långt därifrån, skulle få veta senare. Den här natten hörs bara fältet och fadern.',
        'På morgonen var himlen vanlig. En häst stampade i kylan. Berättelsen lämnar dig med en ring, en osagd mening, och en dag som ändå börjar.',
        'Berättaren ser på dig över den sista glöden. ”Nu är de sju nätterna slut. Det du skrev i Din bok får du bära själv.”'
      ],
      principle: {
        name: 'Att stanna i sorgen',
        body: 'Att skynda bakom det som inte kan göras ogjort hjälper inte. Att stanna, att kalla saker vid deras namn, och att gå ut i en vanlig morgon – det är det sista kapitlet ger.',
        points: ['En vanlig morgon efter en svår natt är också en del av berättelsen', 'Fördröjd hjälp är en form av vägran', 'Det du tar med dig härifrån ska vara en vana, inte en fras']
      },
      reflection: { q: 'Vad tar du med dig ut från elden – en vana, en fråga, ett namn? Skriv det som en mening du vill kunna läsa om ett år.', hint: 'En mening. Vänlig, bestämd, din.' },
      breath: { title: 'Morgonen', intro: 'Andas som om dagen redan har börjat. In, håll, ut, håll. Sex sekunder.' },
      mission: { title: 'Nattens uppdrag', body: 'Läs den mening du skrev. Behåll den. Ta den med ut i en vanlig dag.' },
      cliff: 'Elden är släckt. I Din bok finns det du såg. Berättelsen stannar här, tills någon annan sätter sig ner och ber att få höra den igen.'
    }
  ]
};

/* ---- sidor.js ---- */
/** Bygger bokens uppslag som canvas-sidor till Sidvandning. */


const KONST_FILER = {
  cover: 'cover.webp',
  bord: 'bord.webp',
  eld: 'eld.webp',
  avslut: 'avslut.webp',
  1: 'hall.webp',
  2: 'token.webp',
  3: 'camps.webp',
  4: 'field.webp',
  5: 'dusk.webp',
  6: 'ring.webp',
  7: 'morning.webp',
};

const FORSTA_KONST = ['cover', 'bord', 'eld'];

const KONST_VAG = './konst/';

async function vantaTypsnitt() {
  if (!document.fonts) return;
  try {
    await document.fonts.load('16px "Cormorant Garamond"');
    await document.fonts.load('italic 16px "Cormorant Garamond"');
    await document.fonts.load('18px Cinzel');
    if (document.fonts.check('20px "Noto Nastaliq Urdu"') || true) {
      try { await document.fonts.load('20px "Noto Nastaliq Urdu"'); } catch {}
    }
    await document.fonts.ready;
  } catch { /* systemfallback */ }
}

function laddaBild(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`bilden saknas: ${url}`));
    img.src = url;
  });
}

async function laddaKonst(bas = KONST_VAG, nycklar = null) {
  const par = nycklar
    ? Object.entries(KONST_FILER).filter(([k]) => nycklar.map(String).includes(String(k)))
    : Object.entries(KONST_FILER);
  const ut = {};
  await Promise.all(par.map(async ([k, fil]) => {
    try {
      const kart = (typeof window !== 'undefined' && window.KVARNEN_KONST) ? window.KVARNEN_KONST : {};
      const kalla = kart[fil] || (fil.indexOf('data:') === 0 ? fil : bas + fil);
      ut[k] = await laddaBild(kalla);
    } catch {
      ut[k] = null; // ingen suddig reserv; sidbyggaren använder indigo + ornament
    }
  }));
  return ut;
}

function canvasSida(cssW, cssH, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(cssW * dpr));
  c.height = Math.max(2, Math.round(cssH * dpr));
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  return c;
}

function märk(c, meta) {
  c.meta = meta;
  return c;
}

function radbryt(ctx, text, maxW) {
  const stycken = String(text).split('\n');
  const rader = [];
  for (const stycke of stycken) {
    const ord = stycke.split(/\s+/).filter(Boolean);
    let rad = '';
    for (const o of ord) {
      const prova = rad ? `${rad} ${o}` : o;
      if (ctx.measureText(prova).width > maxW && rad) {
        rader.push(rad);
        rad = o;
      } else rad = prova;
    }
    if (rad) rader.push(rad);
    if (stycken.length > 1) rader.push('');
  }
  if (rader[rader.length - 1] === '') rader.pop();
  return rader;
}

function marginal(w, h, sida, dpr) {
  const yttre = Math.round(Math.min(w, h) * 0.08);
  const ränna = Math.round(Math.min(w, h) * 0.1);
  const left = sida === 'vanster' ? yttre : ränna;
  const right = sida === 'vanster' ? ränna : yttre;
  return { left, right, top: Math.round(h * 0.08), bottom: Math.round(h * 0.1), yttre };
}

function ritaBildTäck(ctx, img, dx, dy, dw, dh, { källa = 'hela', sida } = {}) {
  if (!img || !img.width) return;
  const iw = img.width, ih = img.height;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (källa === 'vanster') { sw = iw / 2; sx = 0; }
  else if (källa === 'hoger') { sw = iw / 2; sx = iw / 2; }
  const skal = Math.max(dw / sw, dh / sh);
  const tw = sw * skal, th = sh * skal;
  const tx = dx + (dw - tw) / 2;
  const ty = dy + (dh - th) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, tx, ty, tw, th);
}

function skuggaNertill(ctx, w, h, t = 0.42) {
  const g = ctx.createLinearGradient(0, h * (1 - t), 0, h);
  g.addColorStop(0, 'rgba(18,24,46,0)');
  g.addColorStop(0.45, 'rgba(18,24,46,0.45)');
  g.addColorStop(1, 'rgba(10,12,22,0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function folio(ctx, w, h, dpr, nr, sida, farg = FARG.guld) {
  ctx.save();
  ctx.fillStyle = farg;
  ctx.globalAlpha = 0.7;
  ctx.font = `${Math.round(9 * dpr)}px Cinzel, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(nr), w / 2, h - Math.round(14 * dpr));
  ctx.restore();
}

function textblock(ctx, rader, x, y, lh, maxY) {
  for (const rad of rader) {
    if (y + lh > maxY) break;
    ctx.fillText(rad, x, y);
    y += rad === '' ? lh * 0.45 : lh;
  }
  return y;
}

function sidaPapper(cssW, cssH, dpr, { typ, natt, rum, folioNr, sida, rubrik, kicker, stycken, fot, citat }, bakom) {
  const c = canvasSida(cssW, cssH, dpr);
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  papper(ctx, w, h);
  ram(ctx, 0, 0, w, h, dpr);
  const m = marginal(w, h, sida, dpr);
  const maxW = w - m.left - m.right;
  let y = m.top;
  if (kicker) {
    ctx.fillStyle = FARG.karmosin;
    ctx.font = `${Math.round(9.5 * dpr)}px Cinzel, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.letterSpacing = `${0.14 * dpr}px`;
    ctx.fillText(kicker.toUpperCase(), m.left, y);
    ctx.letterSpacing = '0px';
    y += 16 * dpr;
  }
  const tat = typ === 'notis' || typ === 'ordlista' || typ === 'princip';
  if (rubrik) {
    ctx.fillStyle = FARG.bläck;
    ctx.font = `${Math.round(Math.min(tat ? 18 : 22, cssW * (tat ? 0.058 : 0.07)) * dpr)}px Cinzel, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const r = radbryt(ctx, rubrik, maxW);
    for (const rad of r) {
      ctx.fillText(rad, m.left, y);
      y += 24 * dpr;
    }
    y += 8 * dpr;
  }
  ctx.fillStyle = FARG.bläck;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const kroppPx = Math.round(Math.min(tat ? 14.5 : 16, cssW * (tat ? 0.038 : 0.042)) * dpr);
  ctx.font = `${kroppPx}px "Cormorant Garamond", serif`;
  const lh = kroppPx * 1.62;
  const maxY = h - m.bottom;
  if (citat) {
    ctx.save();
    ctx.fillStyle = FARG.turkos;
    ctx.font = `italic ${kroppPx}px "Cormorant Garamond", serif`;
    const cr = radbryt(ctx, `«${citat.text}»`, maxW);
    y = textblock(ctx, cr, m.left, y, lh, maxY);
    if (citat.src) {
      ctx.font = `${Math.round(10 * dpr)}px Cinzel, serif`;
      ctx.fillStyle = FARG.karmosin;
      ctx.fillText(citat.src, m.left, y + 4 * dpr);
      y += 22 * dpr;
    } else y += 8 * dpr;
    ctx.restore();
  }
  if (stycken && stycken.length) {
    for (const s of stycken) {
      const rader = radbryt(ctx, s, maxW);
      y = textblock(ctx, rader, m.left, y, lh, maxY);
      y += lh * 0.4;
    }
  }
  if (fot) {
    ctx.save();
    ctx.fillStyle = FARG.turkos;
    ctx.font = `italic ${Math.round(12 * dpr)}px "Cormorant Garamond", serif`;
    const fr = radbryt(ctx, fot, maxW);
    // lägg foten mot botten om det finns rum
    const fotH = fr.length * lh * 0.9;
    const fy = Math.max(y + 8 * dpr, h - m.bottom - fotH);
    textblock(ctx, fr, m.left, fy, lh * 0.9, h - 8 * dpr);
    ctx.restore();
  }
  if (folioNr) folio(ctx, w, h, dpr, folioNr, sida, '#6a5430');
  return märk(c, { typ, natt, rum, sida, folio: folioNr, ...(bakom || {}) });
}

function sidaKonst(cssW, cssH, dpr, { typ, natt, rum, folioNr, sida, rubrik, kicker, text, img, källa }) {
  const c = canvasSida(cssW, cssH, dpr);
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  nattBakgrund(ctx, w, h);
  if (img) ritaBildTäck(ctx, img, 0, 0, w, h, { källa, sida });
  skuggaNertill(ctx, w, h, typ === 'omslag' ? 0.5 : 0.4);
  ram(ctx, 0, 0, w, h, dpr, { farg: FARG.guld, inset: 0.045 });
  const m = marginal(w, h, sida, dpr);
  let y = h * 0.68;
  if (kicker) {
    ctx.fillStyle = FARG.guld;
    ctx.font = `${Math.round(9.5 * dpr)}px Cinzel, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(kicker).toUpperCase(), m.left, y);
    y += 16 * dpr;
  }
  if (rubrik) {
    ctx.fillStyle = FARG.sand;
    ctx.font = `${Math.round(Math.min(26, cssW * 0.085) * dpr)}px Cinzel, serif`;
    ctx.textAlign = 'left';
    const r = radbryt(ctx, rubrik, w - m.left - m.right);
    for (const rad of r) {
      ctx.fillText(rad, m.left, y);
      y += 28 * dpr;
    }
  }
  if (text) {
    ctx.fillStyle = FARG.sand;
    ctx.globalAlpha = 0.9;
    ctx.font = `italic ${Math.round(14 * dpr)}px "Cormorant Garamond", serif`;
    const r = radbryt(ctx, text, w - m.left - m.right);
    for (const rad of r) {
      ctx.fillText(rad, m.left, y);
      y += 20 * dpr;
    }
    ctx.globalAlpha = 1;
  }
  if (folioNr) folio(ctx, w, h, dpr, folioNr, sida);
  return märk(c, { typ, natt, rum, sida, folio: folioNr });
}

function sidaTitelVänster(cssW, cssH, dpr, folioNr) {
  const c = canvasSida(cssW, cssH, dpr);
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  nattBakgrund(ctx, w, h);
  ram(ctx, 0, 0, w, h, dpr);
  medaljong(ctx, w / 2, h * 0.46, Math.min(w, h) * 0.18, dpr);
  ctx.fillStyle = FARG.guld;
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(10 * dpr)}px Cinzel, serif`;
  ctx.fillText('SHAHNAMEH', w / 2, h * 0.72);
  ctx.font = `italic ${Math.round(13 * dpr)}px "Cormorant Garamond", serif`;
  ctx.fillStyle = FARG.sand;
  ctx.fillText('Konungaboken', w / 2, h * 0.72 + 20 * dpr);
  if (folioNr) folio(ctx, w, h, dpr, folioNr);
  return märk(c, { typ: 'titel', natt: 0, rum: 'rum', sida: 'vanster', folio: folioNr });
}

function subst(text, läge) {
  if (!text) return '';
  return String(text)
    .replaceAll('{namn}', läge.namn || BOOK.defaultName || 'gäst')
    .replace(/\{reflektion\.(\d)\|([^}]+)\}/g, (_, n, fallback) => (läge.reflektioner && läge.reflektioner[n]) || fallback)
    .replace(/\{val\.(\d)\|([^}]+)\}/g, (_, n, fallback) => {
      const id = läge.val && läge.val[n];
      return id || fallback;
    });
}

function rumFör(natt) {
  if (natt <= 2) return 'rum';
  if (natt === 3) return 'talt';
  if (natt >= 6) return 'talt';
  return 'talt';
}

/**
 * Bygger en jämn lista canvas-sidor. Läget (namn, val, reflektioner) vävs in i finalen.
 */

function sidaVers(cssW, cssH, dpr, { natt, rum, folioNr, sida, vers }) {
  const c = canvasSida(cssW, cssH, dpr);
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  papper(ctx, w, h);
  ram(ctx, 0, 0, w, h, dpr);
  const m = marginal(w, h, sida, dpr);
  const maxW = w - m.left - m.right;
  let y = m.top;
  ctx.fillStyle = FARG.karmosin;
  ctx.font = `${Math.round(9.5 * dpr)}px Cinzel, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('FERDOWSI', m.left, y);
  y += 22 * dpr;

  const mesra = (vers && vers.mesra) || [];
  const nastPx = Math.round(Math.min(22, cssW * 0.055) * dpr);
  ctx.save();
  ctx.fillStyle = FARG.bläck;
  ctx.font = `${nastPx}px "Noto Nastaliq Urdu", serif`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const xR = w - m.right;
  const lh = nastPx * 2.15;
  y += lh * 0.7;
  for (const rad of mesra) {
    ctx.fillText(rad, xR, y);
    y += lh;
  }
  ctx.restore();

  y += 16 * dpr;
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = FARG.turkos;
  ctx.font = `italic ${Math.round(15 * dpr)}px "Cormorant Garamond", serif`;
  const tolk = vers && vers.tolkning ? vers.tolkning : '';
  for (const rad of radbryt(ctx, tolk, maxW)) {
    ctx.fillText(rad, m.left, y);
    y += 22 * dpr;
  }
  if (vers && vers.kalla) {
    y += 10 * dpr;
    ctx.fillStyle = '#6a5430';
    ctx.font = `${Math.round(8.5 * dpr)}px Cinzel, serif`;
    const k = vers.kalla;
    const kalla = `Ganjoor, ${k.slug}, bayt ${k.bayt}`;
    ctx.fillText(kalla, m.left, y);
  }
  if (folioNr) folio(ctx, w, h, dpr, folioNr, sida, '#6a5430');
  return märk(c, { typ: 'vers', natt, rum, sida, folio: folioNr });
}

function byggSidor(cssW, cssH, { konst, läge = {}, dpr = 2, olåstNatt = 7 } = {}) {
  const sidor = [];
  let folioNr = 0;
  const push = (s) => { sidor.push(s); };

  const omslag = konst.cover;
  push(sidaTitelVänster(cssW, cssH, dpr, null));
  push(sidaKonst(cssW, cssH, dpr, {
    typ: 'omslag', natt: 0, rum: 'rum', folioNr: null, sida: 'hoger',
    img: omslag, källa: 'hela',
    kicker: BOOK.kicker,
    rubrik: BOOK.title,
    text: 'Sju nätter ur Shahnameh – Konungaboken',
  }));

  folioNr = 1;
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'flygblad', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'vanster',
    kicker: 'Efter Ferdowsi',
    rubrik: 'Shahnameh – Konungaboken',
    stycken: [
      'Det här är en nyskriven svensk återberättelse, inte en översättning av någon skyddad utgåva. Diktaren är Ferdowsi. Samlingen heter Shahnameh – Konungaboken.',
    ],
  }));
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'intro', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'hoger',
    kicker: BOOK.kicker,
    rubrik: BOOK.intro[0].t,
    stycken: [BOOK.intro[0].s, BOOK.intro[1].t, BOOK.intro[1].s],
  }));

  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'intro', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'vanster',
    stycken: [BOOK.intro[2].t, BOOK.intro[2].s, BOOK.intro[3].t, BOOK.intro[3].s],
  }));
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'namn', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'hoger',
    kicker: 'Vid elden',
    rubrik: BOOK.namePrompt,
    stycken: [BOOK.nameHint],
    fot: läge.namn ? `Elden känner dig som ${läge.namn}.` : 'Skriv ditt namn i fältet som öppnas.',
  }));

  const notis = BOOK.notice || {};
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'notis', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'vanster',
    kicker: notis.kicker || 'Innan elden tänds',
    rubrik: notis.title || 'En tung berättelse',
    stycken: notis.body || [],
  }));
  const gloss = BOOK.glossary || [];
  const halv = Math.ceil(gloss.length / 2);
  const somStycken = (arr) => arr.map((g) => `${g.term}. ${g.body}`);
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'ordlista', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'hoger',
    kicker: 'Ord vid elden',
    rubrik: 'Några namn och ting',
    stycken: somStycken(gloss.slice(0, halv)),
  }));
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'ordlista', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'vanster',
    stycken: somStycken(gloss.slice(halv)),
  }));
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'flygblad', natt: 0, rum: 'rum', folioNr: folioNr++, sida: 'hoger',
    kicker: 'Sju nätter',
    stycken: ['Berättelsen väntar. Vänd blad när du är redo för första natten.'],
  }));

  for (const dag of BOOK.days) {
    const n = dag.n;
    const rum = rumFör(n);
    const img = konst[n] || konst.cover;
    const låst = n > olåstNatt;

    push(sidaKonst(cssW, cssH, dpr, {
      typ: 'konst', natt: n, rum, folioNr: folioNr++, sida: 'vanster',
      img, källa: 'vanster',
      kicker: låst ? 'Inte ännu' : `Natt ${n} · ${dag.place}`,
      rubrik: låst ? 'Den natten har inte fallit än.' : dag.short,
    }));
    push(sidaKonst(cssW, cssH, dpr, {
      typ: 'konst', natt: n, rum, folioNr: folioNr++, sida: 'hoger',
      img, källa: 'hoger',
      kicker: låst ? '' : `Natt ${n}`,
      rubrik: låst ? '' : dag.title,
    }));

    if (låst) {
      push(sidaPapper(cssW, cssH, dpr, {
        typ: 'låst', natt: n, rum, folioNr: folioNr++, sida: 'vanster',
        rubrik: 'En natt, ett kapitel.',
        stycken: [BOOK.labels.locked, BOOK.labels.pace],
      }));
      push(sidaPapper(cssW, cssH, dpr, {
        typ: 'låst', natt: n, rum, folioNr: folioNr++, sida: 'hoger',
        stycken: ['Berättelsen behöver mörkret emellan. Kom tillbaka när elden är tänd för nästa natt.'],
      }));
      continue;
    }

    const kap = dag.chapter || [];
    const mitt = Math.ceil(kap.length / 2);
    push(sidaPapper(cssW, cssH, dpr, {
      typ: 'brod', natt: n, rum, folioNr: folioNr++, sida: 'vanster',
      kicker: `Natt ${n} · ${dag.short}`,
      rubrik: dag.title,
      stycken: kap.slice(0, mitt),
    }));
    push(sidaPapper(cssW, cssH, dpr, {
      typ: 'brod', natt: n, rum, folioNr: folioNr++, sida: 'hoger',
      stycken: kap.slice(mitt),
      fot: dag.cliff,
    }));

    const vers = VERSER[String(n)];
    push(sidaVers(cssW, cssH, dpr, {
      natt: n, rum, folioNr: folioNr++, sida: 'vanster', vers,
    }));
    const princ = dag.principle || {};
    push(sidaPapper(cssW, cssH, dpr, {
      typ: 'princip', natt: n, rum, folioNr: folioNr++, sida: 'hoger',
      kicker: princ.name,
      stycken: [princ.body, ...((princ.points || []).map((p) => `· ${p}`))],
    }));

    push(sidaPapper(cssW, cssH, dpr, {
      typ: 'reflektion', natt: n, rum, folioNr: folioNr++, sida: 'vanster',
      kicker: 'Din bok',
      rubrik: dag.reflection?.q,
      stycken: [dag.reflection?.hint, läge.reflektioner?.[n] ? `Du skrev: ${läge.reflektioner[n]}` : 'Skriv i fältet som öppnas.'],
    }, { val: dag.choice || null }));
    push(sidaPapper(cssW, cssH, dpr, {
      typ: 'andning', natt: n, rum, folioNr: folioNr++, sida: 'hoger',
      kicker: dag.breath?.title,
      stycken: [dag.breath?.intro, dag.mission?.title ? `${dag.mission.title}. ${dag.mission.body}` : ''],
      fot: dag.next,
    }));
  }

  const fin = BOOK.finale;
  const rader = (fin.lines || []).map((l) => subst(l, läge));
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'final', natt: 7, rum: 'talt', folioNr: folioNr++, sida: 'vanster',
    kicker: fin.kicker,
    rubrik: fin.title,
    stycken: rader.slice(0, 3),
  }));
  push(sidaPapper(cssW, cssH, dpr, {
    typ: 'final', natt: 7, rum: 'talt', folioNr: folioNr++, sida: 'hoger',
    stycken: rader.slice(3),
    fot: 'Elden är släckt. Dagen är vanlig.',
  }));

  if (sidor.length % 2) {
    push(sidaPapper(cssW, cssH, dpr, {
      typ: 'flygblad', natt: 7, rum: 'talt', folioNr: folioNr++, sida: 'hoger',
      stycken: [''],
    }));
  }
  return sidor;
}

function metaFör(sidor, index) {
  const s = sidor[index] || sidor[index + 1];
  return (s && s.meta) || { typ: 'okand', natt: 0, rum: 'inget' };
}

function forstaIndexFörNatt(sidor, natt) {
  const i = sidor.findIndex((s) => s.meta && s.meta.natt === natt && s.meta.typ === 'konst' && s.meta.sida === 'vanster');
  return i < 0 ? 0 : i;
}

/* ---- ljudbild.js ---- */
/**
 * Ljudbild per natt: eld, vind, daf-puls och rum via faltning, med ducking.
 * Inga oscillatorer. Daf är inspelade CC0-slag, spelade som puls.
 */

const PROFIL = {
  0: { eld: 0.22, vind: 0.12, daf: 0.00, puls: 0,    rum: 'rum'  },
  1: { eld: 0.18, vind: 0.08, daf: 0.10, puls: 2400, rum: 'rum'  },
  2: { eld: 0.16, vind: 0.10, daf: 0.09, puls: 2600, rum: 'rum'  },
  3: { eld: 0.14, vind: 0.22, daf: 0.13, puls: 2000, rum: 'talt' },
  4: { eld: 0.08, vind: 0.25, daf: 0.11, puls: 2200, rum: 'talt' },
  5: { eld: 0.10, vind: 0.20, daf: 0.08, puls: 2500, rum: 'talt' },
  6: { eld: 0.10, vind: 0.16, daf: 0.06, puls: 2800, rum: 'talt' },
  7: { eld: 0.16, vind: 0.10, daf: 0.05, puls: 3200, rum: 'talt' },
};

const DUCKAS = new Set(['princip', 'reflektion', 'citat', 'vers', 'andning']);

class Ljudbild {
  constructor(ljud) {
    this.ljud = ljud;
    this.natt = -1;
    this._timer = 0;
    this._duckad = false;
    this._profil = PROFIL[0];
  }

  startGrund() {
    this.ljud.startLoop('eld', 'eld', { buss: 'ambience', volume: PROFIL[0].eld, fade: 1.4 });
    this.ljud.startLoop('vind', 'vind', { buss: 'ambience', volume: PROFIL[0].vind, fade: 1.6 });
  }

  applicera(meta = {}) {
    const natt = Number(meta.natt || 0);
    const typ = meta.typ || 'brod';
    const p = PROFIL[natt] || PROFIL[0];
    this._profil = p;
    this.ljud.setRum(meta.rum || p.rum);
    this.ljud.setLoop('eld', { volume: p.eld, fade: 0.8 });
    this.ljud.setLoop('vind', { volume: p.vind, fade: 0.8 });
    if (natt !== this.natt) {
      this.natt = natt;
      this._startaPuls(p);
    }
    const skaDucka = DUCKAS.has(typ);
    if (skaDucka && !this._duckad) {
      this.ljud.duck({ targets: ['music', 'ambience'], amount: 0.35, attack: 0.15, release: 0.6 });
      this._duckad = true;
    } else if (!skaDucka && this._duckad) {
      this.ljud.unduck({ targets: ['music', 'ambience'], release: 0.6 });
      this._duckad = false;
    }
  }

  _startaPuls(p) {
    this._stoppPuls();
    if (!p.daf || !p.puls) return;
    const slag = () => {
      try {
        this.ljud.play('daf', { buss: 'music', volume: p.daf, pitchJitter: 0.06, volJitter: 1.5 });
      } catch { /* banken kanske inte är laddad ännu */ }
    };
    // Första slaget lite senare, så elden får sätta sig.
    this._timer = setInterval(slag, p.puls);
  }

  _stoppPuls() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = 0;
    }
  }

  dispose() {
    this._stoppPuls();
    if (this._duckad) {
      try { this.ljud.unduck({ targets: ['music', 'ambience'] }); } catch {}
      this._duckad = false;
    }
  }
}


/* ---- scener.js ---- */
/** Öppning, nattövergång, parallax och avslutsritual. Ingen suddig reservbild. */


function visaHoppa(el, onHoppa) {
  if (!el) return () => {};
  el.classList.add('synlig');
  const fn = (e) => {
    e.preventDefault();
    onHoppa();
  };
  el.addEventListener('click', fn);
  return () => {
    el.removeEventListener('click', fn);
    el.classList.remove('synlig');
  };
}

function hoppaStudioIntro() {
  const root = document.getElementById('si-root');
  if (root) {
    root.remove();
  }
}

function monteraParallax(vard) {
  const sc = document.createElement('div');
  sc.className = 'parallax';
  sc.setAttribute('data-testid', 'parallax');
  sc.hidden = true;
  sc.innerHTML = `
    <div class="parallax-far"></div>
    <div class="parallax-nara"></div>
    <svg class="parallax-ram" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect x="2.5" y="3" width="95" height="94" fill="none" stroke="#e2b657" stroke-width="0.7" opacity="0.7"/>
      <rect x="3.6" y="4.1" width="92.8" height="91.8" fill="none" stroke="#e2b657" stroke-width="0.25" opacity="0.4"/>
    </svg>`;
  vard.appendChild(sc);
  const far = sc.querySelector('.parallax-far');
  const nara = sc.querySelector('.parallax-nara');
  let px = 0, py = 0, tx = 0, ty = 0, on = false, raf = 0;

  function tick() {
    px += (tx - px) * 0.08;
    py += (ty - py) * 0.08;
    far.style.transform = `translate(${px * 0.35}px, ${py * 0.35}px) scale(1.12)`;
    nara.style.transform = `translate(${px * 0.7}px, ${py * 0.7}px) scale(1.04)`;
    if (on) raf = requestAnimationFrame(tick);
  }

  function flytta(e) {
    if (!on || reduceradRorelse()) return;
    const r = vard.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 28;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 16;
  }

  window.addEventListener('pointermove', flytta);

  return {
    visa(img) {
      if (!img) { this.dolj(); return; }
      const url = `url(${JSON.stringify(img.src)})`;
      far.style.backgroundImage = url;
      nara.style.backgroundImage = url;
      sc.hidden = false;
      on = true;
      if (!reduceradRorelse()) raf = requestAnimationFrame(tick);
    },
    dolj() {
      sc.hidden = true;
      on = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      tx = ty = px = py = 0;
    },
    el: sc,
  };
}

async function korOppning({ bilder, host, onKlar }) {
  const el = document.getElementById('oppnar');
  if (!el) { onKlar && onKlar(); return; }
  el.hidden = false;
  const bord = el.querySelector('[data-lag="bord"]');
  const eld = el.querySelector('[data-lag="eld"]');
  const pärm = el.querySelector('[data-lag="parm"]');
  if (bilder.bord) bord.src = bilder.bord.src;
  if (bilder.eld) eld.src = bilder.eld.src;
  if (bilder.cover) pärm.src = bilder.cover.src;
  const snabb = reduceradRorelse();
  el.dataset.steg = 'bord';
  await vanta(snabb ? 200 : 900);
  el.dataset.steg = 'eld';
  await vanta(snabb ? 200 : 1100);
  el.dataset.steg = 'oppna';
  await vanta(snabb ? 300 : 1400);
  el.dataset.steg = 'klar';
  await vanta(snabb ? 150 : 400);
  el.hidden = true;
  onKlar && onKlar();
}

async function korRitual({ bilder, onKlar }) {
  const el = document.getElementById('ritual');
  if (!el) { onKlar && onKlar(); return; }
  const img = el.querySelector('img');
  if (bilder.avslut && img) img.src = bilder.avslut.src;
  el.hidden = false;
  const snabb = reduceradRorelse();
  await vanta(snabb ? 400 : 2200);
  el.hidden = true;
  onKlar && onKlar();
}

function vanta(ms) {
  return new Promise((r) => setTimeout(r, ms));
}


/* ---- bok.js ---- */

const ALLA = /(?:[?&#]alla=1)(?:&|$)/.test(location.search + location.hash);
const HOPPA_OPPNAR = /(?:[?&#]oppnar=0)(?:&|$)/.test(location.search + location.hash);
const HOPPA_INTRO = /(?:[?&#]studiointro=0)(?:&|$)/.test(location.search + location.hash)
  || /(?:[?&#]skipintro=1)(?:&|$)/.test(location.search + location.hash)
  || window.__SKIP_STUDIOINTRO === true;

const defaultLäge = () => ({
  index: 0,
  namn: '',
  avsikt: '',
  reflektioner: {},
  val: {},
  olåstNatt: ALLA ? 7 : 1,
});

let ljud, spar, bok, partiklar, konst, ljudbild, parallax;
let forraNatt = -1, ritualGjort = false, oppnarKlar = false;
let läge = defaultLäge();
let cssW = 0, cssH = 0;
let byggerOm = false;

const $ = (id) => document.getElementById(id);

function sättStatus(text) {
  const el = $('spar-status');
  if (el) el.textContent = text || '';
}

function nattEtikett(meta) {
  if (!meta || !meta.natt) return BOOK.kicker;
  const dag = BOOK.days.find((d) => d.n === meta.natt);
  return dag ? `Natt ${dag.n} · ${dag.short}` : `Natt ${meta.natt}`;
}

function visaArk(id, visa) {
  const el = $(id);
  if (!el) return;
  el.hidden = !visa;
}

function uppdateraArk(index) {
  const sidor = bok?.sidor || [];
  const v = sidor[index]?.meta;
  const h = sidor[index + 1]?.meta;
  const typ = [v, h].map((m) => m && m.typ);
  const natt = (h && h.natt) || (v && v.natt) || 0;
  const dag = BOOK.days.find((d) => d.n === natt);

  visaArk('ark-namn', typ.includes('namn'));
  visaArk('ark-reflektion', typ.includes('reflektion'));
  visaArk('ark-val', typ.includes('reflektion') && !!(dag && dag.choice));

  if (typ.includes('namn')) {
    $('namn-falt').value = läge.namn || '';
  }
  if (typ.includes('reflektion') && dag) {
    $('reflektion-fraga').textContent = dag.reflection?.q || '';
    $('reflektion-hint').textContent = dag.reflection?.hint || '';
    $('reflektion-falt').value = läge.reflektioner[natt] || '';
    $('reflektion-falt').dataset.natt = String(natt);
    if (dag.choice) {
      $('val-fraga').textContent = dag.choice.prompt;
      const box = $('val-val');
      box.innerHTML = '';
      for (const o of dag.choice.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.label;
        b.dataset.id = o.id;
        if (läge.val[natt] === o.id) b.classList.add('primar');
        b.addEventListener('click', () => {
          läge.val[natt] = o.id;
          for (const x of box.querySelectorAll('button')) x.classList.toggle('primar', x === b);
          spar.autosave();
        });
        box.appendChild(b);
      }
    }
  }

  // Lås upp nästa natt när läsaren når nattens andning/final
  if (typ.includes('andning') && natt >= läge.olåstNatt && natt < 7) {
    läge.olåstNatt = natt + 1;
  }
  if (typ.includes('final')) läge.olåstNatt = 7;

  const namnEl = $('natt-namn');
  if (namnEl) namnEl.textContent = nattEtikett(h || v);
}

async function byggOm({ bevaraIndex = true } = {}) {
  if (!konst || !bok) return;
  const host = $('bok');
  const r = host.getBoundingClientRect();
  const w = Math.max(2, r.width / 2);
  const h = Math.max(2, r.height);
  if (Math.abs(w - cssW) < 1 && Math.abs(h - cssH) < 1 && bevaraIndex) {
    bok.resize();
    return;
  }
  cssW = w; cssH = h;
  byggerOm = true;
  const index = bevaraIndex ? bok.index : läge.index;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sidor = byggSidor(cssW, cssH, {
    konst, läge, dpr, olåstNatt: ALLA ? 7 : läge.olåstNatt,
  });
  bok.sidor = sidor;
  const maxJämn = sidor.length - 2;
  bok.index = Math.max(0, Math.min(maxJämn, index - (index % 2)));
  bok.resize();
  byggerOm = false;
  uppdateraArk(bok.index);
}

function påSpread(index) {
  läge.index = index;
  uppdateraArk(index);
  const meta = metaFör(bok.sidor, index);
  if (ljudbild) ljudbild.applicera(meta);
  const typ = meta.typ;
  const img = typ === 'omslag' ? konst && konst.cover : (konst && konst[meta.natt]);
  if (parallax) {
    if (typ === 'konst' || typ === 'omslag') parallax.visa(img);
    else parallax.dolj();
  }
  if (meta.natt && meta.natt !== forraNatt && typ === 'konst' && forraNatt >= 0) {
    fadeGenom({ farg: 'var(--shah-indigo, #12182e)' }).catch(() => {});
  }
  forraNatt = meta.natt || 0;
  if (typ === 'final' && !ritualGjort && oppnarKlar) {
    ritualGjort = true;
    korRitual({ bilder: konst, onKlar: () => {} });
  }
}

async function spelaStudioIntro() {
  if (HOPPA_INTRO || typeof StudioIntro === 'undefined') return;
  await new Promise((resolve) => {
    let klar = false;
    const klart = () => { if (klar) return; klar = true; stang && stang(); resolve(); };
    const stang = visaHoppa($('hoppa-intro'), () => { hoppaStudioIntro(); klart(); });
    try {
      StudioIntro.play({
        brand: 'kunskap',
        copyright: 'KunskapsKvarnen',
        onDone: klart,
      });
    } catch {
      klart();
    }
  });
}

async function startaLjud() {
  await ljud.unlock();
  try {
    await ljud.loadManifest('./delat/ljud/bank.json');
  } catch (err) {
    console.warn('ljudbank', err);
  }
  if (!ljudbild) ljudbild = new Ljudbild(ljud);
  ljudbild.startGrund();
  if (bok) ljudbild.applicera(metaFör(bok.sidor, bok.index));
}

async function startaBoken() {
  ljud = new Ljudmotor({ storageKey: 'rostam-sohrab-volym', basUrl: '' });
  ljud.attachUnlock(document);
  const bekraftaNytt = monteraBekraftelse({
    titel: 'Börja om?',
    text: 'Det raderar det sparade läget vid elden.',
    okEtikett: 'Nytt',
    avbrytEtikett: 'Avbryt',
  });
  spar = new Spar({
    nyckel: 'rostam-och-sohrab-referens',
    autoMs: 4000,
  });
  spar.onChange(() => sättStatus(spar.formatSparat()));
  await spar.init();
  const sparat = await spar.load();
  if (sparat && typeof sparat === 'object') {
    läge = { ...defaultLäge(), ...sparat };
    if (ALLA) läge.olåstNatt = 7;
  }
  spar.watch(() => ({ ...läge, index: bok ? bok.index : läge.index }), { autoMs: 4000 });

  await spelaStudioIntro();

  const start = $('start');
  start.hidden = false;
  const borja = $('knapp-borja');
  borja.disabled = true;
  borja.textContent = 'Ett ögonblick…';

  await vantaTypsnitt();
  konst = await laddaKonst("./konst/", FORSTA_KONST);

  const host = $('bok');
  const damm = $('damm');
  partiklar = new PartikelLag(damm, { max: 80 });
  partiklar.storlek(host.clientWidth, host.clientHeight);
  partiklar.start();

  const r = host.getBoundingClientRect();
  cssW = Math.max(2, r.width / 2);
  cssH = Math.max(2, r.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sidor = byggSidor(cssW, cssH, {
    konst, läge, dpr, olåstNatt: ALLA ? 7 : läge.olåstNatt,
  });

  bok = new Sidvandning(host, {
    sidor,
    startIndex: Math.max(0, (läge.index || 0) - ((läge.index || 0) % 2)),
    ljud,
    partiklar,
    niva: 2,
  });
  const _hoppa = bok.hoppaTill.bind(bok);
  bok.hoppaTill = (i) => { _hoppa(i); påSpread(bok.index); };
  bok.on('flip', ({ index }) => påSpread(index));
  bok.on('landning', ({ index }) => påSpread(index));
  påSpread(bok.index);

  $('vol-ljud').value = ljud.getVolume('ambience');
  $('vol-allt').value = ljud.getVolume('master') ?? 0.85;
  $('vol-ljud').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    ljud.setVolume('ambience', v);
    ljud.setVolume('sfx', v);
  });
  $('vol-allt').addEventListener('input', (e) => ljud.setVolume('master', Number(e.target.value)));


  function uppdateraHelskarmKnapp() {
    const k = $('knapp-helskarm');
    if (!k) return;
    const inne = !!(document.fullscreenElement || document.webkitFullscreenElement);
    k.textContent = inne ? 'Lämna helskärm' : 'Helskärm';
    k.setAttribute('aria-pressed', inne ? 'true' : 'false');
  }
  async function vaxlaHelskarm() {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (err) {
      console.warn('helskärm', err);
    }
    uppdateraHelskarmKnapp();
  }
  $('knapp-helskarm').addEventListener('click', () => {
    vaxlaHelskarm();
    try { ljud.play('ui-klick', { buss: 'ui' }); } catch {}
  });
  document.addEventListener('fullscreenchange', uppdateraHelskarmKnapp);
  document.addEventListener('webkitfullscreenchange', uppdateraHelskarmKnapp);
  uppdateraHelskarmKnapp();

  $('knapp-spara').addEventListener('click', async () => {
    läge.index = bok.index;
    await spar.sparaManuellt();
    ljud.play('ui-bekraft', { buss: 'ui' });
  });
  $('knapp-fortsatt').addEventListener('click', async () => {
    const sparatNu = await spar.load();
    const idx = sparatNu && Number.isFinite(sparatNu.index) ? sparatNu.index : 0;
    await fadeGenom({ farg: 'var(--shah-indigo, #12182e)', mitt: () => bok.hoppaTill(idx) });
  });
  $('knapp-nytt').addEventListener('click', async () => {
    const res = await spar.nytt({ bekrafta: bekraftaNytt });
    if (res && res.avbrott) return;
    läge = defaultLäge();
    await fadeGenom({
      farg: 'var(--shah-indigo, #12182e)',
      mitt: async () => {
        await byggOm({ bevaraIndex: false });
        bok.hoppaTill(0);
      },
    });
  });

  $('knapp-namn').addEventListener('click', async () => {
    läge.namn = $('namn-falt').value.trim() || '';
    await byggOm();
    spar.autosave();
    ljud.play('ui-bekraft', { buss: 'ui' });
  });
  $('knapp-reflektion').addEventListener('click', async () => {
    const n = Number($('reflektion-falt').dataset.natt || 0);
    if (n) läge.reflektioner[n] = $('reflektion-falt').value.trim();
    await byggOm();
    spar.autosave();
    ljud.play('ui-bekraft', { buss: 'ui' });
  });

  let resizeTimer = 0;
  const vidResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      partiklar.storlek(host.clientWidth, host.clientHeight);
      byggOm();
    }, 120);
  };
  window.addEventListener('resize', vidResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', vidResize);

  const skal = document.querySelector('.bok-skal') || host;
  parallax = monteraParallax(skal);
  host.addEventListener('pointerdown', () => { if (parallax) parallax.dolj(); });
  påSpread(bok.index);

  borja.disabled = false;
  borja.textContent = BOOK.labels.begin;
  borja.addEventListener('click', async () => {
    start.hidden = true;
    await startaLjud();
    try { ljud.play('ui-klick', { buss: 'ui', volume: 0.8 }); } catch {}
    if (!HOPPA_OPPNAR) {
      let hoppad = false;
      const stoppHoppa = visaHoppa($('hoppa-oppnar'), () => { hoppad = true; const o=$('oppnar'); if(o){ o.dataset.avbryt='1'; o.hidden = true; } });
      await Promise.race([
        korOppning({ bilder: konst, host }),
        new Promise((r) => {
          const iv = setInterval(() => { if (hoppad) { clearInterval(iv); r(); } }, 80);
        }),
      ]);
      stoppHoppa && stoppHoppa();
    }
    oppnarKlar = true;
    const op = $('oppnar'); if (op) op.hidden = true;
    // resten av konsten i bakgrunden
    laddaKonst("./konst/").then(async (alla) => {
      konst = { ...konst, ...alla };
      await byggOm();
    }).catch(() => {});
  }, { once: true });

  // Exponeras för tester och senare steg.
  const ritHoppa = $('hoppa-ritual');
  if (ritHoppa) ritHoppa.addEventListener('click', () => { const r = $('ritual'); if (r) r.hidden = true; });

  window.ReferensBok = {
    get bok() { return bok; },
    get ljud() { return ljud; },
    get ljudbild() { return ljudbild; },
    get konst() { return konst; },
    async mataLjud(bankNamn) {
      const bank = ljud.bankar.get(bankNamn);
      if (!bank || !bank.buffers || !bank.buffers.length) return null;
      return renderaOchMata({ audioBuffer: bank.buffers[0], inkluderGraph: true });
    },
    get spar() { return spar; },
    get läge() { return läge; },
    byggOm,
    forstaIndexFörNatt: (n) => forstaIndexFörNatt(bok.sidor, n),
    metaFör: (i) => metaFör(bok.sidor, i),
  };
}

startaBoken().catch((err) => {
  console.error(err);
  const s = $('start');
  if (s) {
    s.hidden = false;
    s.querySelector('p').textContent = 'Boken kunde inte öppnas. Försök igen från en lokal server.';
  }
});

})();
