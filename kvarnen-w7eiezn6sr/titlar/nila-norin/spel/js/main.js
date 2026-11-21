import {
  save, ljud, ensureAudio, playSfx,
  loadCoreAssets, loadBg, drawBgPlate, getPlayRect, drawPortrait, gladjedans,
  JuiceParticles,
} from './core.js';
import { MapScene } from './map.js';
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
const ctx = canvas.getContext('2d');
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

let W = 844, H = 390, dpr = 1;
let T = 0;
let mode = 'map'; // 'map' | 'level'
let curLevelDef = null;
let curLevelState = null;
let levelProgress = 0;
let levelWon = false;

const mapScene = new MapScene(LEVELS, (id) => startLevel(id), particles);

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
window.addEventListener('resize', resize);
resize();

function syncHud() {
  starCountEl.textContent = `${save.totalStars()} / ${LEVELS.length * 3}`;
  sisBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.sis === save.sister));
  btnMute.classList.toggle('is-muted', save.muted);
  muteIco.textContent = save.muted ? '🔇' : '🔊';

  const onMap = mode === 'map';
  btnMap.classList.toggle('hidden', onMap);
  btnBook.classList.toggle('hidden', !onMap);
  levelTitleEl.classList.toggle('hidden', onMap || levelWon);
  progressBarEl.classList.toggle('hidden', onMap || !curLevelDef);
  winBarEl.classList.toggle('hidden', onMap || !levelWon);

  if (!onMap && curLevelDef) {
    const idx = LEVELS.findIndex((l) => l.id === curLevelDef.id);
    const hasNext = idx >= 0 && idx + 1 < LEVELS.length;
    btnNextLevel.classList.toggle('hidden', !hasNext);
  }
}

function renderProgressBar() {
  if (!curLevelDef) return;
  progressBarEl.innerHTML = '';
  for (let i = 0; i < curLevelDef.goalTotal; i++) {
    const d = document.createElement('div');
    d.className = 'prog-dot' + (i < levelProgress ? ' is-done' : '');
    d.textContent = i < levelProgress ? curLevelDef.goalIcon : '·';
    progressBarEl.appendChild(d);
  }
}

function renderBook() {
  bookGrid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const st = save.stars[lv.id] || 0;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'book-item' + (st > 0 ? '' : ' is-locked');
    el.innerHTML = `
      <div class="book-ico">${st > 0 ? lv.icon : '🔒'}</div>
      <div class="book-name">${i + 1}. ${lv.title}</div>
      <div class="book-stars">${st > 0 ? '★'.repeat(st) + '☆'.repeat(3 - st) : 'Låst'}</div>
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
    get won() { return levelWon; },
    particles,
    playRect: getPlayRect,
    gladjedans,
    setProgress(n) {
      levelProgress = n;
      renderProgressBar();
    },
    win(stars = 3) {
      if (levelWon) return;
      levelWon = true;
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
  mode = 'level';
  particles.clear();
  levelTitleEl.textContent = `${def.icon} ${def.title}`;
  await loadBg(def.bg);
  curLevelState = def.create(buildApi());
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
  else if (curLevelState && curLevelState.onDown) curLevelState.onDown(x, y, W, H);
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
  btnUnlockAll.textContent = save.unlockAll ? '🔒 Använd vanlig ordning' : '🔓 Lås upp alla banor';
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
window.__nn2 = {
  get mode() { return mode; },
  get level() { return curLevelDef ? curLevelDef.id : null; },
  get progress() { return levelProgress; },
  get won() { return levelWon; },
  get levels() { return LEVELS.map((l) => l.id); },
  get state() { return curLevelState; },
  goMap,
  startLevel,
  unlockAll() { save.unlockAll = true; save.write(); syncHud(); },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  T += dt;

  ctx.save();
  ctx.scale(dpr, dpr);
  if (mode === 'map') {
    mapScene.update(dt, W, H);
    mapScene.draw(ctx, T, W, H);
  } else if (curLevelDef && curLevelState) {
    drawBgPlate(ctx, W, H, curLevelDef.bg, curLevelDef.tint || '#d8ccb2');
    curLevelState.update(dt, W, H);
    curLevelState.draw(ctx, T, W, H);
  }
  particles.update(dt);
  particles.draw(ctx);
  ctx.restore();

  requestAnimationFrame(frame);
}

loadCoreAssets().then(() => {
  document.querySelectorAll('.sis-face').forEach((c, idx) => {
    drawPortrait(c, idx === 0 ? 'nila' : 'norin');
  });
  // ?level=rescue låter oss hoppa direkt in för snabb testning
  const params = new URLSearchParams(location.search);
  const reqLv = params.get('level');
  syncHud();
  if (reqLv && LEVELS.some((l) => l.id === reqLv)) {
    startLevel(reqLv);
  } else {
    mapScene.enter();
  }
  requestAnimationFrame(frame);
});
