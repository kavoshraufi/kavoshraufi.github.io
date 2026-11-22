import {
  save, ljud, ensureAudio, preloadAudio, playSfx, playNote, puls,
  loadCoreAssets, loadBg, drawBgPlate, getPlayRect, updateSafeInsets, drawPortrait, gladjedans,
  JuiceParticles,
} from './core.js';
import { ST } from './speltest.js';
import { MapScene } from './map.js';
import { Besokare } from './besok.js';
import { drawIkon, ikonUrl } from './core.js';
const ikonImg = (n, extra = '') => `<img class="ico ${extra}" src="${ikonUrl(n)}" alt="">`;
import { level01 } from './levels/L01-rescue.js';
import { level02 } from './levels/L02-brook.js';
import { level03 } from './levels/L03-garden.js';
import { level04 } from './levels/L04-sort.js';
import { level05 } from './levels/L05-music.js';
import { level06 } from './levels/L06-clouds.js';
import { level07 } from './levels/L07-bridge.js';
import { level08 } from './levels/L08-stars.js';
import { level09 } from './levels/L09-treasure.js';
import { level10 } from './levels/L10-bakery.js';

export const LEVELS = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
];

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const btnMap = document.getElementById('btnMap');
const btnBook = document.getElementById('btnBook');
const btnMute = document.getElementById('btnMute');
const muteIco = document.getElementById('muteIco');
const btnFull = document.getElementById('btnFull');
const btnParent = document.getElementById('btnParent');
const starCountEl = document.getElementById('starCount');
const levelTitleEl = document.getElementById('levelTitle');
const progressBarEl = document.getElementById('progressBar');
const winBarEl = document.getElementById('winBar');
const winStarsEl = document.getElementById('winStars');
const btnNextLevel = document.getElementById('btnNextLevel');
const btnReplay = document.getElementById('btnReplay');
const btnWinMap = document.getElementById('btnWinMap');

const bookModal = document.getElementById('bookModal');
const bookGrid = document.getElementById('bookGrid');
const btnCloseBook = document.getElementById('btnCloseBook');

const parentModal = document.getElementById('parentModal');
const parentStats = document.getElementById('parentStats');
const btnCloseParent = document.getElementById('btnCloseParent');
const btnDoneParent = document.getElementById('btnDoneParent');
const btnUnlockAll = document.getElementById('btnUnlockAll');
const btnResetSave = document.getElementById('btnResetSave');

const volMaster = document.getElementById('volMaster');
const volSfx = document.getElementById('volSfx');
const volUi = document.getElementById('volUi');

const sisBtns = [...document.querySelectorAll('.sis-btn')];
const particles = new JuiceParticles(240);
const besok = new Besokare(particles, ST);
ST?.attach(canvas);

let W = 844, H = 390, dpr = 1;
let T = 0;
let mode = 'map'; // 'map' | 'level'
let curLevelDef = null;
let curLevelState = null;
let levelProgress = 0;
let levelWon = false;
// Rundor: varje bana spelas i flera rundor som trappar upp milt (api.round = 1..rounds).
let round = 1;
let roundBase = 0;        // avklarade delmål i tidigare rundor
let roundSwitchT = 0;     // > 0 medan rundbytet firas (tips av, gamla rundan syns kvar)
let roundBannerT = 0;     // tid kvar för ”Runda N”-skylten
let levelT0 = 0;
// Myntet: en liten målad skatt gömd i kanten av scenen (ny plats varje runda) — frivillig upptäckt.
const MYNT_PLATSER = [[0.03, 0.18], [0.97, 0.22], [0.03, 0.4], [0.97, 0.38], [0.03, 0.28], [0.97, 0.3]];
let mynt = null;       // { x, y, t } medan det ligger kvar
let myntHittat = false;
let senasteStjarnor = null;
// Små lekdetaljer längs kanten — svarar med ton och glitter, så det alltid finns flera ställen att upptäcka.
const LEK_ART = ['blomma', 'apple', 'sprout', 'bud', 'bar'];
const LEK_POS = [[0.04, 0.20], [0.96, 0.20], [0.04, 0.44], [0.96, 0.36], [0.16, 0.10]];
let lek = [];
function placeraLek() {
  lek = LEK_POS.map(([rx, ry], i) => ({ art: LEK_ART[i % LEK_ART.length], rx, ry, x: 0, y: 0, pop: 0, funnen: false }));
}
function tickLek(dt, W, H) {
  const pr = getPlayRect(W, H);
  for (const o of lek) { o.x = pr.x + pr.w * o.rx; o.y = pr.y + pr.h * o.ry; if (o.pop > 0) o.pop = Math.max(0, o.pop - dt * 2.5); }
}
function drawLek(c, T) {
  for (const o of lek) {
    const sc = (o.funnen ? 0.85 : 1) + Math.sin(o.pop * Math.PI) * 0.3;
    const bob = Math.sin(T * 2.2 + o.x) * 3;
    drawIkon(c, o.art, o.x, o.y + bob, 28 * sc, { alpha: o.funnen ? 0.7 : 1 });
  }
}
function hitLek(x, y) {
  for (const o of lek) {
    if (Math.hypot(x - o.x, y - o.y) < 24) {
      o.pop = 1;
      o.funnen = true;
      playNote(LEK_ART.indexOf(o.art), 0.32);
      particles.burst(o.x, o.y, 10, { kind: 'star', colors: ['#ffe17a', '#ffffff', '#cfeaff'] });
      return true;
    }
  }
  return false;
}

function placeraMynt() {
  if (myntHittat || !curLevelDef) { mynt = null; return; }
  const li = LEVELS.findIndex((l) => l.id === curLevelDef.id);
  const [rx, ry] = MYNT_PLATSER[(li * 3 + round * 2) % MYNT_PLATSER.length];
  mynt = { rx, ry, t: 0, x: 0, y: 0 };
}
const roundsOf = (def) => (def && def.rounds) || 1;
const goalOf = (def, r) => (def.goalFor ? def.goalFor(r) : def.goalTotal);
const totalGoals = (def) => { let n = 0; for (let r = 1; r <= roundsOf(def); r++) n += goalOf(def, r); return n; };

const mapScene = new MapScene(LEVELS, (id) => startLevel(id), particles);

const stageEl = document.getElementById('stage');
function resize() {
  updateSafeInsets();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = (stageEl && stageEl.clientWidth) || window.innerWidth;
  H = (stageEl && stageEl.clientHeight) || window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx._dpr = dpr;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 60));
window.visualViewport?.addEventListener('resize', resize);
resize();

// Förhindra iOS pinch-zoom & kontextmeny vid långt tryck
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}
stageEl?.addEventListener('contextmenu', (e) => e.preventDefault());
if (!document.documentElement.requestFullscreen ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true) {
  btnFull.classList.add('hidden');
}

function syncHud() {
  starCountEl.textContent = `${save.totalStars()} / ${LEVELS.length * 3}`;
  sisBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.sis === save.sister));
  btnMute.classList.toggle('is-muted', save.muted);
  muteIco.src = save.muted ? ikonUrl('ljud-av') : ikonUrl('ljud');

  const onMap = mode === 'map';
  btnMap.classList.toggle('hidden', onMap);
  btnBook.classList.toggle('hidden', !onMap);
  levelTitleEl.classList.toggle('hidden', onMap || levelWon);
  progressBarEl.classList.toggle('hidden', onMap || !curLevelDef || levelWon);
  winBarEl.classList.toggle('hidden', onMap || !levelWon);
  winStarsEl.classList.toggle('hidden', onMap || !levelWon || !senasteStjarnor);
  if (!onMap && levelWon && senasteStjarnor) renderWinStars();

  if (!onMap && curLevelDef) {
    const idx = LEVELS.findIndex((l) => l.id === curLevelDef.id);
    const hasNext = idx >= 0 && idx + 1 < LEVELS.length;
    btnNextLevel.classList.toggle('hidden', !hasNext);
  }
}

function renderProgressBar() {
  if (!curLevelDef) return;
  progressBarEl.innerHTML = '';
  const R = roundsOf(curLevelDef);
  if (R > 1) {
    const pips = document.createElement('div');
    pips.className = 'round-pips';
    for (let r = 1; r <= R; r++) {
      const d = document.createElement('span');
      d.className = 'round-pip' + (r < round || levelWon ? ' is-done' : r === round ? ' is-cur' : '');
      pips.appendChild(d);
    }
    progressBarEl.appendChild(pips);
  }
  const g = goalOf(curLevelDef, round);
  const here = levelWon ? g : Math.max(0, levelProgress - roundBase);
  for (let i = 0; i < g; i++) {
    const d = document.createElement('div');
    d.className = 'prog-dot' + (i < here ? ' is-done' : '');
    if (i < here) d.innerHTML = ikonImg(curLevelDef.goalArt); else d.textContent = '·';
    progressBarEl.appendChild(d);
  }
}

function renderWinStars() {
  const st = senasteStjarnor;
  const rad = [
    ['gnista', 'Klar!', true],
    ['mynt', st.mynt ? 'Myntet!' : 'Myntet?', st.mynt],
    ['fjaril', st.besok ? 'Vännen!' : 'Vännen?', st.besok],
  ];
  winStarsEl.innerHTML = rad.map(([why, txt, on]) => `<span class="win-star${on ? '' : ' is-off'}"><img src="${ikonUrl('stjarna')}" alt=""><img class="ws-why" src="${ikonUrl(why)}" alt="">${txt}</span>`).join('');
}

function drawMynt(c, dt) {
  const pr = getPlayRect(W, H);
  mynt.x = pr.x + pr.w * mynt.rx;
  mynt.y = pr.y + pr.h * mynt.ry;
  mynt.t += dt;
  // Halvt gömt: lutar och blinkar till var tredje sekund så ett nyfiket öga hittar det.
  const blink = (mynt.t % 3) < 0.35 ? 1 : 0;
  c.save();
  c.globalAlpha = 0.85;
  drawIkon(c, 'mynt', mynt.x, mynt.y, 24 + blink * 4, { rot: -0.3 });
  if (blink) {
    c.globalAlpha = 0.7;
    c.fillStyle = '#fffbe0';
    c.beginPath(); c.arc(mynt.x + 8, mynt.y - 8, 3 + Math.sin(mynt.t * 18) * 1.5, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function nextRound() {
  // Firar rundan; bytet sker i tickRounds via dt (inte setTimeout — den kan fördröjas om fliken vilar).
  if (roundSwitchT > 0) return;
  roundSwitchT = 1.0;
  playSfx('pling');
  particles.confetti(W, H, 18);
}

function tickRounds(dt) {
  if (roundSwitchT <= 0) return;
  roundSwitchT -= dt;
  // En mjuk ton mitt i övergången så tystnaden inte blir längre än en sekund även om rAF hakar upp sig efteråt.
  if (roundSwitchT <= 0.5 && roundSwitchT + dt > 0.5) playNote((round) % 6, 0.3);
  if (roundSwitchT > 0) return;
  const def = curLevelDef;
  if (!def || levelWon) { roundSwitchT = 0; return; }
  roundBase += goalOf(def, round);
  round += 1;
  roundBannerT = 1.6;
  curLevelState = def.create(buildApi());
  placeraMynt();
  ST?.event('round', { round, of: roundsOf(def) });
  roundSwitchT = 0;
  renderProgressBar();
  playSfx('ok');
}

function renderBook() {
  bookGrid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const st = save.stars[lv.id] || 0;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'book-item' + (st > 0 ? '' : ' is-locked');
    el.innerHTML = `
      <div class="book-ico">${ikonImg(st > 0 ? lv.art : 'hanglas')}</div>
      <div class="book-name">${i + 1}. ${lv.title}</div>
      <div class="book-stars">${st > 0 ? [0, 1, 2].map((k) => ikonImg('stjarna', k < st ? '' : 'is-off')).join('') : 'Låst'}</div>
    `;
    el.addEventListener('click', () => {
      ensureAudio();
      if (st > 0) {
        playSfx('cheer');
        el.classList.remove('is-pop');
        void el.offsetWidth;
        el.classList.add('is-pop');
        particles.burst(W * 0.5, H * 0.45, 16, { kind: 'heart' });
      } else {
        playSfx('softno');
      }
    });
    bookGrid.appendChild(el);
  });
}

function buildApi() {
  return {
    get W() { return W; },
    get H() { return H; },
    get sister() { return save.sister; },
    get won() { return levelWon || roundSwitchT > 0; }, // under rundbyte: stoppa vidare delmål (musik kraschade annars på SONGS[round])
    get round() { return round; },
    get rounds() { return roundsOf(curLevelDef); },
    particles,
    playRect: getPlayRect,
    gladjedans,
    setProgress(n) {
      if (!curLevelDef) return;
      const tot = roundBase + n;
      if (tot > levelProgress) ST?.event('progress', { n: tot, total: totalGoals(curLevelDef), round });
      levelProgress = Math.max(levelProgress, tot);
      renderProgressBar();
    },
    win() {
      if (levelWon || roundSwitchT > 0) return;
      if (round < roundsOf(curLevelDef)) { nextRound(); return; }
      // Stjärnorna betyder något synligt: ★ klar, ★ hittade myntet, ★ hälsade på besökaren.
      const stars = 1 + (myntHittat ? 1 : 0) + (besok.hittad ? 1 : 0);
      senasteStjarnor = { klar: true, mynt: myntHittat, besok: besok.hittad };
      ST?.event('win', { stars });
      levelWon = true;
      ST?.event('dance'); // glädjedans startar med vinsten (krokens pose-lock får inte missa den)
      const idx = LEVELS.findIndex((l) => l.id === curLevelDef.id);
      save.stars[curLevelDef.id] = Math.max(save.stars[curLevelDef.id] || 0, stars);
      if (idx >= 0 && save.unlocked <= idx && idx + 1 < LEVELS.length) {
        save.unlocked = idx + 1;
      }
      save.write();
      playSfx('cheer');
      particles.confetti(W, H, 52);
      syncHud();
    },
  };
}

export async function startLevel(id) {
  const def = LEVELS.find((l) => l.id === id) || LEVELS[0];
  if (!def) return;
  curLevelDef = def;
  levelProgress = 0;
  levelWon = false;
  round = 1; roundBase = 0; roundSwitchT = 0; roundBannerT = 0;
  besok.reset();
  levelT0 = performance.now();
  mode = 'level';
  myntHittat = false; senasteStjarnor = null;
  placeraLek();
  particles.clear();
  levelTitleEl.innerHTML = `${ikonImg(def.art)}${def.title}`;
  await loadBg(def.bg);
  curLevelState = def.create(buildApi());
  placeraMynt();
  ST?.levelStart(def.id);
  renderProgressBar();
  syncHud();
}

export function goMap() {
  mode = 'map';
  particles.clear();
  curLevelDef = null;
  curLevelState = null;
  levelWon = false;
  mapScene.enter();
  syncHud();
}

/* ---------- Pekarhändelser (< 50 ms) ---------- */
function pt(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  const [x, y] = pt(e);
  if (canvas.setPointerCapture) {
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  }
  if (mode === 'map') mapScene.onDown(x, y, W, H);
  else if (!levelWon && !roundSwitchT && hitLek(x, y)) { /* lekdetalj */ }
  else if (mynt && !levelWon && Math.hypot(x - mynt.x, y - mynt.y) < 30) {
    myntHittat = true;
    particles.burst(mynt.x, mynt.y, 20, { kind: 'star', colors: ['#ffd76a', '#fff6c8', '#ffffff'] });
    playSfx('star');
    ST?.event('mynt', {});
    mynt = null;
  }
  else if (besok.hit(x, y)) { /* frivillig upptäckt */ }
  else if (curLevelState && curLevelState.onDown) {
    const fore = puls.n;
    curLevelState.onDown(x, y, W, H);
    // Inget tryck ska vara dött: svarade banan inte alls får man ett mjukt glitter där fingret är.
    if (puls.n === fore) {
      playSfx('tap');
      particles.burst(x, y, 5, { kind: 'star', colors: ['#fff3b0', '#ffffff', '#cfeaff'], speed: 55, lift: 20, life: 0.5, r: 4 });
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  const [x, y] = pt(e);
  if (mode === 'map') mapScene.onMove(x, y, W, H);
  else if (curLevelState && curLevelState.onMove) curLevelState.onMove(x, y, W, H);
});

canvas.addEventListener('pointerup', (e) => {
  const [x, y] = pt(e);
  if (mode === 'map') mapScene.onUp(x, y, W, H);
  else if (curLevelState && curLevelState.onUp) curLevelState.onUp(x, y, W, H);
});

canvas.addEventListener('pointercancel', (e) => {
  const [x, y] = pt(e);
  if (mode === 'level' && curLevelState && curLevelState.onUp) curLevelState.onUp(x, y, W, H);
});

/* ---------- HUD-knappar ---------- */
sisBtns.forEach((b) => {
  b.addEventListener('click', () => {
    ensureAudio();
    save.sister = b.dataset.sis;
    save.write();
    playSfx('ok');
    syncHud();
  });
});

btnMap.addEventListener('click', () => { ensureAudio(); playSfx('tap'); goMap(); });
btnWinMap.addEventListener('click', () => { ensureAudio(); playSfx('tap'); goMap(); });
btnReplay.addEventListener('click', () => {
  ensureAudio();
  playSfx('ok');
  if (curLevelDef) startLevel(curLevelDef.id);
});
btnNextLevel.addEventListener('click', () => {
  ensureAudio();
  playSfx('ok');
  const idx = LEVELS.findIndex((l) => l.id === curLevelDef.id);
  const next = LEVELS[idx + 1];
  if (next) startLevel(next.id); else goMap();
});

btnMute.addEventListener('click', () => {
  ensureAudio();
  save.muted = !save.muted;
  save.write();
  if (!save.muted) playSfx('tap');
  syncHud();
});

btnFull.addEventListener('click', () => {
  ensureAudio();
  playSfx('tap');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});

btnBook.addEventListener('click', () => {
  ensureAudio();
  playSfx('open');
  renderBook();
  bookModal.classList.remove('hidden');
});
btnCloseBook.addEventListener('click', () => { playSfx('tap'); bookModal.classList.add('hidden'); });

function openParent() {
  ensureAudio();
  playSfx('tap');
  const doneCount = Object.values(save.stars).filter((v) => v > 0).length;
  parentStats.textContent = `${doneCount} av ${LEVELS.length} banor klara · ${save.totalStars()} av ${LEVELS.length * 3} stjärnor samlade.`;
  volMaster.value = ljud.volymer.master;
  volSfx.value = ljud.volymer.sfx;
  volUi.value = ljud.volymer.ui;
  btnUnlockAll.innerHTML = `${ikonImg('hanglas', 'ico-s')} ${save.unlockAll ? 'Använd vanlig ordning' : 'Lås upp alla banor'}`;
  parentModal.classList.remove('hidden');
}
btnParent.addEventListener('click', openParent);
btnCloseParent.addEventListener('click', () => { playSfx('tap'); parentModal.classList.add('hidden'); });
btnDoneParent.addEventListener('click', () => { playSfx('tap'); parentModal.classList.add('hidden'); });

volMaster.addEventListener('input', () => { ljud.setVolume('master', Number(volMaster.value)); });
volSfx.addEventListener('input', () => { ljud.setVolume('sfx', Number(volSfx.value)); });
volUi.addEventListener('input', () => { ljud.setVolume('ui', Number(volUi.value)); });

btnUnlockAll.addEventListener('click', () => {
  save.unlockAll = !save.unlockAll;
  save.write();
  playSfx('ok');
  parentModal.classList.add('hidden');
  syncHud();
});

btnResetSave.addEventListener('click', () => {
  save.reset();
  playSfx('whoosh');
  parentModal.classList.add('hidden');
  goMap();
});

/* ---------- Testkrok & Huvudloop (60 fps) ---------- */
let ready = false;
let paused = typeof document !== 'undefined' ? document.hidden : false;
let rafId = 0;

window.__nn2 = {
  get ready() { return ready; },
  get paused() { return paused; },
  get ljud() { return ljud; },
  audioState() { return { upplast: ljud.upplast, state: ljud.ctx?.state || 'idle', engine: ljud.state }; },
  get mode() { return mode; },
  get level() { return curLevelDef ? curLevelDef.id : null; },
  get progress() { return levelProgress; },
  get won() { return levelWon; },
  get levels() { return LEVELS.map((l) => l.id); },
  get state() { return curLevelState; },
  get round() { return round; },
  get rounds() { return roundsOf(curLevelDef); },
  get switching() { return roundSwitchT > 0; },
  get besok() { return besok.c ? { x: besok.c.x, y: besok.c.y - besok.c.h * 0.5 } : null; },
  goMap,
  startLevel,
  unlockAll() { save.unlockAll = true; save.write(); syncHud(); },
};

function drawRoundBanner(c, t) {
  const R = roundsOf(curLevelDef);
  const a = Math.min(1, t / 0.35, (1.6 - t) / 0.2);
  const y = H * 0.3 - (1 - Math.min(1, (1.6 - t) / 0.3)) * 30;
  c.save();
  c.globalAlpha = Math.max(0, a);
  c.font = `800 ${Math.round(Math.min(34, H * 0.08))}px Nunito, system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const txt = round === R ? 'Sista rundan!' : `Runda ${round} av ${R}`;
  const w = c.measureText(txt).width + 44;
  c.fillStyle = 'rgba(255, 248, 228, 0.92)';
  c.strokeStyle = 'rgba(154, 118, 66, 0.5)';
  c.lineWidth = 3;
  c.beginPath(); c.roundRect(W / 2 - w / 2, y - 26, w, 52, 26); c.fill(); c.stroke();
  c.fillStyle = '#7a4f1d';
  c.fillText(txt, W / 2, y + 1);
  c.restore();
}

let last = performance.now();
function frame(now) {
  if (paused) { rafId = 0; return; }
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  T += dt;

  ST?.frameStart();
  ctx.save();
  ctx.scale(dpr, dpr);
  if (mode === 'map') {
    mapScene.update(dt, W, H);
    mapScene.draw(ctx, T, W, H);
  } else if (curLevelDef && curLevelState) {
    drawBgPlate(ctx, W, H, curLevelDef.bg, curLevelDef.tint || '#d8ccb2');
    tickRounds(dt);
    curLevelState.update(dt, W, H);
    curLevelState.draw(ctx, T, W, H);
    besok.update(dt, W, H, getPlayRect(W, H), !levelWon && roundSwitchT <= 0);
    besok.draw(ctx, T);
    if (mynt && !levelWon) drawMynt(ctx, dt);
    if (!levelWon) { tickLek(dt, W, H); drawLek(ctx, T); }
    if (roundBannerT > 0) { roundBannerT -= dt; drawRoundBanner(ctx, roundBannerT); }
  }
  particles.update(dt);
  particles.draw(ctx);
  ctx.restore();
  ST?.frameEnd();

  rafId = requestAnimationFrame(frame);
}

function handleVisibility() {
  if (document.hidden) {
    paused = true;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    ST?.event('pause');
  } else {
    paused = false;
    last = performance.now();
    puls.t = last;
    if (ljud.upplast && !save.muted && ljud.ctx?.state !== 'running') {
      ljud.unlock();
    }
    ST?.event('resume');
    if (ready && !rafId) rafId = requestAnimationFrame(frame);
  }
}
document.addEventListener('visibilitychange', handleVisibility);
window.addEventListener('pageshow', () => {
  if (!document.hidden && paused) handleVisibility();
});

loadCoreAssets().then(async () => {
  document.querySelectorAll('.sis-face').forEach((c, idx) => {
    drawPortrait(c, idx === 0 ? 'nila' : 'norin');
  });
  const params = new URLSearchParams(location.search);
  const reqLv = params.get('level');
  syncHud();
  if (reqLv && LEVELS.some((l) => l.id === reqLv)) {
    await startLevel(reqLv);
  } else {
    mapScene.enter();
  }
  ready = true;
  if (!paused && !rafId) rafId = requestAnimationFrame(frame);
  // Ladda ljudbanken direkt efter första interaktiva bildrutan så Fast 3G startar snabbt
  setTimeout(() => preloadAudio(), 50);
});
