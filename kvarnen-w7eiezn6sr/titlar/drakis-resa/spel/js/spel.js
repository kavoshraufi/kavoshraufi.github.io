// Drakis resa — referensspel. Ett andetag i taget.
import { K, ljud, spar, monteraBekraftelse } from './motor.js';
import { ASSETS, FORSTA_KONST } from './assets.js';
import { SONG } from './musik.js';

const TS = K.TS;
const INDIGO = '#3E63DD', INDIGO_D = '#2C4BB8';
const S = {
  scene: 'title', day: 0, hp: 3, kr: 0, air: 0, totalKr: 0, totalAir: 0,
  cardT: 0, msg: '', msgT: 0, t0: 0, deaths: 0,
  combo: 0, comboT: 0, comboBest: 0, hurtDay: false,
  dayKr: 0, dayAir: 0, starsGot: 0, bestStars: [0, 0, 0, 0, 0], unlockTrail: false,
  assist: false, pickDay: 0, unlockedDay: 0, help: false,
  pwr: { fan: 0, shield: 0, wind: 0, magnet: 0 }
};

// ---------- Bitar som banorna byggs av (12 rutor höga) ----------
// # mark, = molnplattform, o andetag, $ stjärna, c driftmoln, d dykmoln, r kryprök,
// t tjockmoln, p splittermoln, v virvelrök, C rökpelare, ^ uppvind,
// h hjärta, f superfläkt, u sköld, w medvind, m stjärndrag,
// K flagga, G dagsmål, P start, S Sotkungen, B Greve Skymning, L Sotnissen, n dimorm
const CH = {
  start: ['............', '............', '............', '............', '............', '............', '............', '............', '............', '..P.........', '############', '############'],
  flat: ['............', '............', '............', '............', '............', '............', '...$.$.$....', '............', '............', '............', '############', '############'],
  gap3: ['............', '............', '............', '............', '............', '.....$$.....', '............', '............', '............', '............', '####...#####', '####...#####'],
  gap4: ['............', '............', '............', '............', '.....o......', '............', '............', '............', '............', '............', '###....#####', '###....#####'],
  steps: ['............', '............', '............', '............', '......$.....', '............', '......o.....', '.....###....', '....#####...', '...#######..', '############', '############'],
  smoke: ['............', '............', '............', '............', '.......c....', '............', '............', '...c........', '............', '............', '############', '############'],
  crawl: ['............', '............', '............', '............', '............', '....$.$.....', '............', '............', '............', '......r.....', '############', '############'],
  dive: ['............', '............', '......d.....', '............', '............', '............', '.....o......', '............', '............', '............', '############', '############'],
  clouds: ['............', '............', '............', '.......$....', '............', '......====..', '............', '..===.......', '............', '............', '##........##', '##........##'],
  lift: ['............', '............', '............', '............', '.....$$$....', '............', '............', '............', '............', '............', '##.......###', '##..^^^..###'],
  pillar: ['............', '............', '............', '............', '......$.....', '............', '.........c..', '............', '.....##.....', '.....##.....', '############', '############'],
  spin: ['............', '............', '............', '............', '......v.....', '............', '............', '............', '.....##.....', '.....##.....', '############', '############'],
  thick: ['............', '............', '............', '.......t....', '............', '.....$......', '............', '............', '............', '............', '############', '############'],
  split: ['............', '............', '............', '............', '.....p......', '............', '............', '...c........', '............', '............', '############', '############'],
  check: ['............', '............', '............', '............', '............', '............', '............', '............', '............', '.....K......', '############', '############'],
  goal: ['............', '............', '............', '............', '............', '............', '............', '............', '............', '......G.....', '############', '############'],
  chim: ['............', '............', '............', '............', '.....$......', '............', '............', '............', '......C.....', '......#.....', '############', '############'],
  chim2: ['............', '............', '............', '...o........', '............', '............', '............', '............', '..C.....C...', '..#.....#...', '############', '############'],
  roofgap: ['............', '............', '............', '...c........', '............', '.....$......', '............', '............', '............', '#####.....##', '#####.....##', '#####.....##'],
  high: ['............', '............', '.......$....', '............', '......===...', '............', '............', '...===......', '............', '............', '###......###', '###......###'],
  tower: ['............', '............', '............', '......o.....', '............', '.....###....', '.....###....', '....####....', '....####.c..', '...#####....', '############', '############'],
  heart: ['............', '............', '............', '............', '......h.....', '............', '............', '......##....', '............', '............', '############', '############'],
  fan: ['............', '............', '............', '............', '.....f......', '............', '............', '.....###....', '............', '............', '############', '############'],
  shield: ['............', '............', '............', '............', '......u.....', '............', '............', '.....###....', '............', '............', '############', '############'],
  windp: ['............', '............', '............', '.....w......', '............', '......===...', '............', '............', '............', '............', '###......###', '###......###'],
  magnet: ['............', '............', '............', '............', '......m.....', '............', '............', '.....###....', '............', '............', '############', '############'],
  secret: ['$..........$', '............', '====...====.', '............', '............', '.....h......', '....====....', '............', '............', '............', '##........##', '##..^^^..###'],
  arenaMini: ['......................', '......................', '......................', '......................', '......................', '......................', '......................', '...====......====.....', '......................', '..........B...........', '######################', '######################'],
  arena: ['......................', '......................', '......................', '......................', '......................', '...======....======...', '......................', '......................', '......................', '..........S...........', '######################', '######################'],
  arenaLittle: ['......................', '......................', '......................', '......................', '......................', '......................', '......................', '...====......====.....', '......................', '..........L...........', '######################', '######################'],
  mist: ['............', '............', '............', '............', '.....n......', '............', '............', '.....###....', '............', '............', '############', '############']
};
const DAYS = [
  { name: 'Dag 1: Sotens morgon', theme: 'park', chunks: ['start', 'flat', 'gap3', 'smoke', 'steps', 'flat', 'crawl', 'clouds', 'gap3', 'pillar', 'check', 'heart', 'dive', 'gap4', 'lift', 'fan', 'steps', 'smoke', 'flat', 'arenaLittle', 'goal'],
    fact: 'Sotnissen rymde skrattande. "Min chef är STÖRRE! Han sitter på klipporna!" I morgon får vi se.', up: 'Drakis växer! Fläkten (B) når längre och orkar en gång till.' },
  { name: 'Dag 2: Grevens klippor', theme: 'roof', chunks: ['start', 'flat', 'chim', 'roofgap', 'crawl', 'chim2', 'gap4', 'split', 'thick', 'check', 'clouds', 'spin', 'shield', 'lift', 'chim2', 'roofgap', 'arenaMini', 'steps', 'goal'],
    fact: 'Greven flög mot toppen. "Kungen väntar. Och han är... lite nervös." Vad döljer Sotkungen där uppe?', up: 'Luften är lättare! Nu kan du hoppa en gång till i luften (A igen).' },
  { name: 'Dag 3: Sotkungens berg', theme: 'mount', chunks: ['start', 'high', 'smoke', 'tower', 'lift', 'secret', 'thick', 'mist', 'gap4', 'check', 'windp', 'high', 'split', 'spin', 'dive', 'magnet', 'tower', 'lift', 'steps', 'check', 'arena'],
    fact: 'Sotkungen blev ett litet moln. Men suget kommer i vågor. I morgon dimma i dalen.', up: 'Medvinden är din. Ett andetag i taget räcker fortfarande.' },
  { name: 'Dag 4: Dimman över dalen', theme: 'roof', chunks: ['start', 'flat', 'mist', 'gap3', 'crawl', 'clouds', 'split', 'check', 'thick', 'dive', 'lift', 'shield', 'steps', 'mist', 'gap4', 'arenaMini', 'goal'],
    fact: 'Dimman lättade. Suget är inte borta, men det gick över. En dag till.', up: 'Assist finns om du vill ta det lugnare. Samma resa, ingen skam.' },
  { name: 'Dag 5: Vinden kommer hem', theme: 'mount', chunks: ['start', 'high', 'smoke', 'tower', 'lift', 'mist', 'gap4', 'check', 'windp', 'spin', 'magnet', 'steps', 'fan', 'lift', 'check', 'arena'],
    fact: 'Vinden är hemma. Sotkungen kan komma på te. Oinbjuden. Du vet vad ett andetag kan.', up: '' }
];
const THEME = {
  park: { sky: ['#8fbaff', '#a9cbff', '#c4dcff', '#dfeeff'], grass: ['#6ed36a', '#4fbf5a', '#3fa34c', '#2e7a38'], rock: ['#8b5a3c', '#6e4630', '#5c4c43', '#9a8070'], dirt: '#7a542e', flower: ['#ff8eb0', '#c97ae8', '#ffe08a', '#ffffff'], haze: 'rgba(200,220,255,0.10)' },
  roof: { sky: ['#ff9e7a', '#ffb98a', '#ffd29e', '#ffe6bc'], grass: ['#7bc75a', '#5eae48', '#4a8c38', '#3a6e2c'], rock: ['#8a5344', '#6e4036', '#5a3a38', '#a07060'], dirt: '#6a3a32', flower: ['#ff9a70', '#ffd080', '#ff8eb0', '#fff4e0'], haze: 'rgba(255,200,160,0.12)' },
  mount: { sky: ['#5f86e8', '#7a9ef0', '#9ab8f6', '#c4d8ff'], grass: ['#8bb89a', '#6a9a80', '#4e7e68', '#3a6254'], rock: ['#7a8098', '#62687e', '#4e5468', '#a0a8b8'], dirt: '#5a6078', flower: ['#d0e8ff', '#c9a8ff', '#ffe08a', '#ffffff'], haze: 'rgba(180,200,240,0.16)' }
};
const PWR_TIME = { fan: 600, shield: 480, wind: 540, magnet: 480 };
const PWR_NAME = { fan: 'Stormfläkt', shield: 'Gnistsköld', wind: 'Medvind', magnet: 'Stjärndrag' };
const FOE = { c: 'drift', d: 'dive', r: 'crawl', t: 'thick', p: 'split', v: 'spin', n: 'mist' };

let map, ents, pl, puffs = [], parts = [], pops = [], boss, cam = { x: 0, y: 12 }, chk, playBg, pal;
let shake = 0, hitHold = 0, tilesReady = false, TILE = {}, softCloud = null, flashC = null;

function buildDay(d) {
  const day = DAYS[d], rows = Array.from({ length: 12 }, () => '');
  day.chunks.forEach(c => { for (let y = 0; y < 12; y++) rows[y] += CH[c][y]; });
  map = K.tilemap(rows); cam.lock = undefined; cam.x = 0; cam.y = (K.H >= 192 ? 192 - K.H : 12);
  ents = []; puffs = []; parts = []; pops = []; boss = null; pal = THEME[day.theme];
  S.dayKr = 0; S.dayAir = 0; S.hurtDay = false; S.combo = 0; S.comboT = 0;
  S.pwr = { fan: 0, shield: 0, wind: 0, magnet: 0 };
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const c = map.get(x, y), px = x * TS, py = y * TS;
    if ('o$cKGPSB^CdrtpvhfuwmLn'.includes(c) && c !== 'C') map.set(x, y, '.');
    if (c === 'P') chk = { x: px, y: py };
    else if (c === 'o') { ents.push({ t: 'air', x: px + 3, y: py + 3, w: 10, h: 10 }); S.dayAir++; }
    else if (c === '$') { ents.push({ t: 'kr', x: px + 3, y: py + 3, w: 10, h: 10 }); S.dayKr++; }
    else if (FOE[c]) ents.push(makeSmoke(px, py, FOE[c]));
    else if (c === 'K') ents.push({ t: 'flag', x: px, y: py - 16, w: 12, h: 32, on: false });
    else if (c === 'G') ents.push({ t: 'goal', x: px, y: py - 32, w: 24, h: 48 });
    else if (c === 'S') ents.push({ t: 'bossT', kind: 'final', final: true, x: px - 160, y: 0, w: 16, h: 192, sx: px, sy: py - 80, tx: x - 10 });
    else if (c === 'B') ents.push({ t: 'bossT', kind: 'dusk', final: false, x: px - 160, y: 0, w: 16, h: 192, sx: px, sy: py - 80, tx: x - 10 });
    else if (c === 'L') ents.push({ t: 'bossT', kind: 'little', final: false, x: px - 160, y: 0, w: 16, h: 192, sx: px, sy: py - 80, tx: x - 10 });
    else if (c === '^') ents.push({ t: 'wind', x: px, y: 0, w: 16, h: py + 16 });
    else if (c === 'C') ents.push({ t: 'chim', x: px, y: py, w: 16, h: 16, k: Math.floor(x * 7) % 120 });
    else if (c === 'h') ents.push({ t: 'heart', x: px + 2, y: py + 2, w: 12, h: 12 });
    else if (c === 'f') ents.push({ t: 'pwr', k: 'fan', x: px + 2, y: py + 2, w: 12, h: 12 });
    else if (c === 'u') ents.push({ t: 'pwr', k: 'shield', x: px + 2, y: py + 2, w: 12, h: 12 });
    else if (c === 'w') ents.push({ t: 'pwr', k: 'wind', x: px + 2, y: py + 2, w: 12, h: 12 });
    else if (c === 'm') ents.push({ t: 'pwr', k: 'magnet', x: px + 2, y: py + 2, w: 12, h: 12 });
  }
  playBg = makePlayBg(d);
  tilesReady = false;
  spawn(true);
  S.kr = 0; S.air = 0; S.hp = maxHp();
}
function makeSmoke(x, y, kind, small) {
  kind = kind || 'drift';
  const spark = kind === 'spark';
  let w = (small || spark) ? 10 : 16, h = (small || spark) ? 9 : 15, oy = 0;
  if (!small && !spark) {
    if (kind === 'crawl') { w = 18; h = 12; oy = 4; }
    else if (kind === 'thick') { w = 20; h = 22; }
    else if (kind === 'dive') { w = 14; h = 18; }
    else if (kind === 'split') { w = 16; h = 16; }
    else if (kind === 'spin') { w = 18; h = 18; }
    else if (kind === 'mist') { w = 18; h = 16; }
    else { w = 16; h = 16; }
  }
  const e = { t: 'smoke', kind, x: x + (16 - w) / 2, y: y + oy, w, h, ox: x, oy: y, ph: Math.random() * 6, small: !!(small || spark), life: (small || spark) ? 520 : 0, hp: kind === 'thick' ? 2 : 1, dir: 1, state: 'idle', age: 0, links: null };
  if (kind === 'dive') e.state = 'hang';
  if (kind === 'mist' && !e.small) {
    e.links = [];
    for (let i = 1; i <= 2; i++) e.links.push({ x: e.x - i * 14, y: e.y + 4, w: 14, h: 10 });
  }
  return e;
}
function art(name) { return K.img[name]; }
function spawn(first) {
  pl = { x: chk.x, y: chk.y - 10, w: 12, h: 22, blowT: 0, vx: 0, vy: 0, dir: 1, onGround: false, inv: first ? 0 : 90, jumps: 0, breath: maxBreath(), rech: 0, anim: 0, coyote: 0, jBuf: 0, wasGround: true, trail: [], squash: 0, stretch: 0 };
  S.hp = maxHp();
}
const maxHp = () => S.assist ? 4 : 3;
const maxBreath = () => 3 + Math.min(S.day, 4) + (S.assist ? 2 : 0);
const dagSang = () => [SONG.park, SONG.roof, SONG.mount, SONG.roof, SONG.mount][S.day] || SONG.park;
const puffLife = () => ([26, 38, 46][S.day] || 46) * (S.pwr.fan ? 1.65 : 1);
function solid(tx, ty) { if (tx < 0 || tx >= map.w) return true; const c = map.get(tx, ty); return c === '#' || c === 'C'; }
function oneway(tx, ty) { return map.get(tx, ty) === '='; }

// ---------- Grafik ----------
function makePlayBg(d) {
  const src = K.img['bg_d' + (d + 1)];
  if (!src) return null;
  const c = K.canvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0, src.width, src.height * 0.70, 0, 0, src.width, src.height);
  const gr = g.createLinearGradient(0, src.height * 0.42, 0, src.height);
  gr.addColorStop(0, 'rgba(255,240,230,0)');
  gr.addColorStop(1, pal.haze);
  g.fillStyle = gr;
  g.fillRect(0, 0, src.width, src.height);
  c.hd = true;
  return c;
}
function pix(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); }
function buildTiles() {
  if (tilesReady || !pal) return;
  const gcol = pal.grass, rock = pal.rock, flowers = pal.flower;
  function cap(kind) {
    const c = K.canvas(16, 16), g = c.getContext('2d');
    pix(g, 0, 7, 16, 9, rock[1]);
    for (let i = 0; i < 10; i++) pix(g, (i * 5 + kind * 2) % 16, 8 + (i * 3) % 7, 2, 2, rock[i & 1 ? 0 : 2]);
    pix(g, 0, 6, 16, 2, rock[0]);
    pix(g, 0, 0, 16, 7, gcol[1]);
    pix(g, 0, 0, 16, 2, gcol[0]);
    pix(g, 0, 2, 16, 1, gcol[0]);
    for (let i = 0; i < 16; i += 2) pix(g, i, 1 + (i + kind) % 2, 1, 1, '#d8ffb0');
    pix(g, 0, 6, 16, 1, gcol[2]);
    for (let i = 0; i < 16; i += 4) pix(g, i + (kind & 1), 5, 2, 2, gcol[3]);
    if (kind === 1) { pix(g, 0, 3, 3, 13, rock[2]); pix(g, 0, 0, 5, 7, gcol[1]); pix(g, 0, 0, 4, 3, gcol[0]); pix(g, 1, 8, 1, 8, gcol[3]); }
    if (kind === 2) { pix(g, 13, 3, 3, 13, rock[2]); pix(g, 11, 0, 5, 7, gcol[1]); pix(g, 12, 0, 4, 3, gcol[0]); pix(g, 14, 8, 1, 8, gcol[3]); }
    const spots = kind === 1 ? [3] : kind === 2 ? [9] : [2, 8, 13];
    spots.forEach((x, i) => { pix(g, x, 0, 1, 4, gcol[3]); pix(g, x - 1, 0, 3, 2, flowers[(i + kind) % flowers.length]); pix(g, x, 1, 1, 1, '#ffe070'); });
    return c;
  }
  function fill(v) {
    const c = K.canvas(16, 16), g = c.getContext('2d');
    pix(g, 0, 0, 16, 16, rock[1]);
    for (let i = 0; i < 14; i++) pix(g, (i * 7 + v * 3) % 15, (i * 5 + v * 2) % 15, 2, 2, rock[(i + v) % 3 === 0 ? 0 : 2]);
    for (let y = 1; y < 16; y += 4) { pix(g, 3 + (v * 5 + y) % 8, y, 1, 3, rock[2]); pix(g, 10 + (v + y) % 5, y + 1, 1, 2, rock[0]); }
    if (v === 2) pix(g, 6, 4, 1, 6, rock[3]);
    return c;
  }
  function bot(v) {
    const c = K.canvas(16, 16), g = c.getContext('2d');
    pix(g, 0, 0, 16, 11, rock[1]);
    for (let i = 0; i < 8; i++) pix(g, (i * 6 + v) % 15, (i * 4) % 10, 2, 2, rock[2]);
    pix(g, 0, 10, 16, 2, rock[2]);
    const dips = [3, 4, 2, 3, 5, 3, 2, 4, 3, 5, 2, 4, 3, 2, 4, 3];
    for (let x = 0; x < 16; x++) pix(g, x, 12, 1, dips[(x + v) % 16], rock[2]);
    if (v === 1) { pix(g, 4, 11, 1, 5, gcol[2]); pix(g, 3, 14, 3, 2, gcol[1]); }
    if (v === 2) { pix(g, 11, 11, 1, 5, gcol[3]); pix(g, 10, 14, 3, 2, flowers[0]); }
    return c;
  }
  function vent() {
    const c = K.canvas(16, 16), g = c.getContext('2d');
    pix(g, 3, 6, 10, 10, rock[1]); pix(g, 2, 8, 12, 8, rock[2]);
    pix(g, 4, 4, 8, 6, rock[0]); pix(g, 5, 2, 6, 4, rock[3]);
    pix(g, 6, 1, 4, 4, '#2a2a32'); pix(g, 7, 2, 2, 2, '#1a1a22');
    pix(g, 3, 10, 10, 1, rock[2]);
    return c;
  }
  TILE.cap = [cap(0), cap(1), cap(2)];
  TILE.fill = [fill(0), fill(1), fill(2)];
  TILE.bot = [bot(0), bot(1), bot(2)];
  TILE.vent = vent();
  tilesReady = true;
}
function tileAt(kind, tx, ty) {
  const v = ((tx * 13 + ty * 7) >>> 0) % 3;
  return TILE[kind][v] || TILE[kind][0];
}

// ---------- Uppdatering ----------
function rumble(n) { shake = Math.max(shake, n); }
function hitstop(n) { hitHold = Math.max(hitHold, n); }
function pop(x, y, s, c) { pops.push({ x, y, s, c: c || '#fff', t: 50 }); }
function burst(x, y, c, n = 10, spd = 1.5) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + Math.random() * 0.3;
    parts.push({ x, y, vx: Math.cos(a) * spd * (0.6 + Math.random()), vy: Math.sin(a) * spd * (0.6 + Math.random()), t: 18 + (Math.random() * 10 | 0), c, s: 1 + (Math.random() * 2 | 0) });
  }
}
function landDust(x, y) {
  for (let i = 0; i < 12; i++) parts.push({ x: x + Math.random() * 16, y, vx: Math.random() * 2.6 - 1.3, vy: -0.5 - Math.random() * 1.1, t: 18, c: pal ? pal.grass[i & 1] : '#9adc8a', s: 1 + (i & 1) });
  K.sfx('land'); rumble(1.5);
}
function addCombo(x, y) {
  if (K.t - S.comboT < 100) S.combo++; else S.combo = 1;
  S.comboT = K.t;
  if (S.combo > S.comboBest) S.comboBest = S.combo;
  if (S.combo >= 2) {
    S.kr += S.combo;
    pop(x, y - 8, 'x' + S.combo, '#ffe070');
    K.sfx('combo');
    rumble(1 + Math.min(3, S.combo * 0.4));
  }
}
function hurt() {
  if (pl.inv) return;
  if (S.pwr.shield) {
    S.pwr.shield = 0; pl.inv = 50; rumble(3); K.sfx('pop');
    burst(pl.x + 6, pl.y + 10, '#ffe070', 14, 2); pop(pl.x, pl.y, 'SKOLD', '#ffe070');
    return;
  }
  S.hp--; S.hurtDay = true; pl.inv = 108;
  pl.vy = Math.min(pl.vy, -2); pl.vx = -pl.dir * (pl.onGround ? 2 : 0.6);
  K.sfx('hurt'); rumble(6); hitstop(5); burst(pl.x + 6, pl.y + 10, '#ff8aa0', 8, 1.6);
  S.combo = 0;
  if (S.hp <= 0) setback();
}
function setback() {
  S.deaths++;
  note(['Upp igen! Flaggan väntar.', 'En hjälte andas, och hoppar.', 'Sotkungen skrattar för tidigt.'][S.deaths % 3]);
  spawn(false);
  S.pwr = { fan: 0, shield: 0, wind: 0, magnet: 0 }; S.combo = 0;
  if (boss && boss.hp > 0) { boss.state = 'float'; boss.t = 0; }
}
function note(s, t = 150) { S.msg = s; S.msgT = t; }
function givePwr(k) {
  S.pwr[k] = PWR_TIME[k];
  K.sfx('power'); rumble(2);
  note(PWR_NAME[k] + '!', 90);
  pop(pl.x, pl.y - 6, PWR_NAME[k].toUpperCase(), '#a8f0ff');
}

function updatePlayer() {
  const spd = S.pwr.wind ? 2.15 : 1.7, accG = S.pwr.wind ? 0.38 : 0.3, accA = S.pwr.wind ? 0.26 : 0.2;
  const dirIn = (K.held.right ? 1 : 0) - (K.held.left ? 1 : 0);
  if (dirIn) { pl.vx = K.clamp(pl.vx + dirIn * (pl.onGround ? accG : accA), -spd, spd); pl.dir = dirIn; }
  else pl.vx *= pl.onGround ? 0.7 : 0.92;
  if (Math.abs(pl.vx) < 0.05) pl.vx = 0;
  if (pl.onGround) { pl.jumps = 0; pl.coyote = S.assist ? 18 : 10; } else if (pl.coyote) pl.coyote--;
  if (K.pressed.a) pl.jBuf = S.assist ? 16 : 10; else if (pl.jBuf) pl.jBuf--;
  const canDouble = S.day >= 2 && pl.jumps < 2;
  if (pl.jBuf && (pl.onGround || pl.coyote) && pl.jumps < 1) {
    pl.vy = S.pwr.wind ? -5.15 : -4.7; pl.jumps = 1; pl.coyote = 0; pl.jBuf = 0; pl.onGround = false; K.sfx('jump');
    pl.stretch = 8; burst(pl.x + 6, pl.y + pl.h, '#cfe8ff', 7, 1.1);
  } else if (pl.jBuf && !pl.onGround && canDouble) {
    pl.vy = S.pwr.wind ? -4.6 : -4.2; pl.jumps = 2; pl.jBuf = 0; K.sfx('hop2');
    for (let i = 0; i < 8; i++) parts.push({ x: pl.x + 6, y: pl.y + 16, vx: Math.random() * 2 - 1, vy: Math.random(), t: 20, c: '#fff', s: 2 });
  }
  if (!K.held.a && pl.vy < -1.5) pl.vy += 0.4;
  pl.vy += 0.22;
  const gliding = K.held.a && pl.vy > 0 && !pl.onGround;
  if (gliding) pl.vy = Math.min(pl.vy, S.pwr.wind ? 0.55 : 0.75);
  const inWind = ents.some(e => e.t === 'wind' && K.overlap(pl, e));
  if (inWind && !pl.onGround) { pl.vy = Math.max(pl.vy - (gliding ? 0.55 : 0.35), -2.6); if (K.t % 4 === 0) parts.push({ x: pl.x + Math.random() * 12, y: pl.y + 16, vx: 0, vy: -1.5, t: 18, c: '#e8f4ff', s: 2 }); }
  pl.vy = Math.min(pl.vy, 5.5);
  K.move(pl, solid, oneway);
  if (!pl.wasGround && pl.onGround) { landDust(pl.x, pl.y + pl.h); pl.squash = 8; hitstop(2); }
  pl.wasGround = pl.onGround;
  pl.gliding = gliding;
  pl.rech++; if (pl.rech >= 30 && pl.breath < maxBreath()) { pl.breath++; pl.rech = 0; }
  if (K.pressed.b && pl.breath > 0) {
    pl.breath--; pl.rech = 0; K.sfx('puff'); pl.blowT = 18;
    burst(pl.x + (pl.dir > 0 ? 14 : -2), pl.y + 6, '#d8f4ff', 10, 1.7);
    const upw = K.held.up, life = puffLife(), spread = S.pwr.fan ? 1 : 0;
    const shoot = (ang) => puffs.push({ x: pl.x + (pl.dir > 0 ? 14 : -8), y: pl.y + (upw ? 0 : 4), w: S.pwr.fan ? 11 : 8, h: S.pwr.fan ? 11 : 8, vx: Math.cos(ang) * (upw ? 2.4 : 3.3) * pl.dir, vy: Math.sin(ang) * (upw ? 2.4 : 3.3) + (upw ? -2.2 : 0), t: life });
    const base = 0;
    shoot(base);
    if (S.pwr.fan) { shoot(-0.35); shoot(0.35); }
  }
  if (pl.inv) pl.inv--; if (pl.blowT) pl.blowT--;
  pl.anim = pl.onGround && Math.abs(pl.vx) > 0.2 ? pl.anim + 0.25 : 0;
  if (pl.squash) pl.squash--; if (pl.stretch) pl.stretch--;
  if (S.unlockTrail || S.pwr.wind || Math.abs(pl.vx) > 1) {
    if (K.t % 2 === 0) pl.trail.push({ x: pl.x + 6, y: pl.y + 12, t: 12, c: S.unlockTrail ? '#ffe070' : '#bfe8ff' });
    if (pl.trail.length > 16) pl.trail.shift();
  }
  pl.trail = (pl.trail || []).filter(s => --s.t > 0);
  Object.keys(S.pwr).forEach(k => { if (S.pwr[k]) S.pwr[k]--; });
  if (pl.y > map.h * TS + 20) { S.hp = 0; K.sfx('hurt'); setback(); }
}

function crawlOnGround(e) {
  const next = e.x + e.dir * 0.7 + (e.dir > 0 ? e.w : 0);
  const footX = Math.floor(next / TS), footY = Math.floor((e.y + e.h + 1) / TS);
  if (solid(footX, Math.floor((e.y + 2) / TS)) || !solid(footX, footY)) e.dir *= -1;
  e.x += e.dir * 0.7;
  if (!solid(Math.floor((e.x + e.w / 2) / TS), Math.floor((e.y + e.h + 1) / TS))) {
    e.y += 0.6;
  } else {
    const ty = Math.floor((e.y + e.h) / TS);
    e.y = ty * TS - e.h;
  }
}
function updateSmoke(e) {
  e.ph += 0.04; e.age++;
  const kind = e.kind || 'drift';
  if (e.state === 'pop') {
    if (e.age > 10) e.dead = true;
    return;
  }
  if (e.small) {
    if (e.home) { e.x += Math.sign(pl.x - e.x) * 0.45; e.y += Math.sign(pl.y - e.y) * 0.3; }
    else { e.y -= 0.45; e.x += Math.sin(e.ph * 2) * 0.4; }
    if (--e.life <= 0) e.dead = true;
  } else if (kind === 'crawl') {
    crawlOnGround(e);
  } else if (kind === 'dive') {
    if (e.state === 'hang') {
      e.y = e.oy + Math.sin(e.ph) * 6;
      if (Math.abs(e.x - pl.x) < 70 && pl.y > e.y && e.age > 40) { e.state = 'warn'; e.age = 0; }
    } else if (e.state === 'warn') {
      e.x += Math.sin(e.age * 0.8) * 0.8;
      if (e.age > 36) { e.state = 'swoop'; e.age = 0; e.sx = e.x; e.sy = e.y; e.tx = pl.x; e.ty = Math.min(pl.y, 150); }
    } else if (e.state === 'swoop') {
      const u = Math.min(1, e.age / 28);
      e.x = e.sx + (e.tx - e.sx) * u; e.y = e.sy + (e.ty - e.sy) * (1 - (1 - u) * (1 - u));
      if (e.age > 36) { e.state = 'back'; e.age = 0; }
    } else {
      e.x += (e.ox - e.x) * 0.08; e.y += (e.oy - e.y) * 0.08;
      if (e.age > 50) { e.state = 'hang'; e.age = 0; }
    }
  } else if (kind === 'spin') {
    e.x = e.ox + Math.cos(e.ph * 1.2) * 28;
    e.y = e.oy + Math.sin(e.ph * 1.2) * 18;
  } else if (kind === 'mist') {
    e.x += e.dir * 0.55;
    if (e.x < e.ox - 40 || e.x > e.ox + 50) e.dir *= -1;
    e.y = e.oy + Math.sin(e.ph) * 5;
    if (e.links) e.links.forEach((l, i) => { l.x = e.x - (i + 1) * 12 * e.dir; l.y = e.y + Math.sin(e.ph + i) * 3; });
  } else {
    e.y = e.oy + Math.sin(e.ph) * 10;
    const near = Math.abs(e.x - pl.x) < 150;
    if (near) e.x += Math.sign(pl.x - e.x) * (0.2 + S.day * 0.12);
    if (Math.abs(e.x - e.ox) > 50) e.x = e.ox + Math.sign(e.x - e.ox) * 50;
  }
  if (e.state !== 'pop' && K.overlap(e, pl)) hurt();
  if (e.links) e.links.forEach(l => { if (K.overlap(l, pl)) hurt(); });
}
function puffHits(e, p) {
  if (e.t !== 'smoke' || e.dead || e.state === 'pop' || p.t <= 0) return false;
  if (K.overlap(p, e)) return true;
  if (e.links && e.links.some(l => K.overlap(p, l))) { e.links = null; return true; }
  return false;
}
function breakSmoke(e) {
  e.hp--;
  if (e.hp > 0) { K.sfx('hit'); burst(e.x + 7, e.y + 6, '#d0d0e0', 8, 1.2); rumble(2); hitstop(2); return; }
  e.dead = true; K.sfx('pop'); burst(e.x + 7, e.y + 6, '#ffffff', 12, 1.8); rumble(3); hitstop(3);
  addCombo(e.x, e.y);
  if (!e.small) ents.push({ t: 'flower', x: e.x + 4, y: e.y, w: 8, h: 8, vy: 0, life: 240 });
  if (e.kind === 'split' && !e.small) {
    e.state = 'pop'; e.age = 0; e.dead = false;
    const a = makeSmoke(e.x - 6, e.y, 'drift', true); a.life = 200; a.vx = -0.6;
    const b = makeSmoke(e.x + 8, e.y, 'drift', true); b.life = 200;
    ents.push(a, b);
  }
}
function updateEnts() {
  ents.forEach(e => {
    if (e.dead) return;
    if (e.t === 'smoke') updateSmoke(e);
    else if (e.t === 'chim') {
      e.k++;
      if (e.k % 150 === 0 && Math.abs(e.x - pl.x) < 260) {
        const s = makeSmoke(e.x + 2, e.y - 14, 'spark', true); s.life = 220; ents.push(s);
      }
    } else if (e.t === 'air') {
      if (S.pwr.magnet) pull(e, 80);
      if (K.overlap(e, pl)) { e.dead = true; S.air++; pl.breath = maxBreath(); K.sfx('pick'); burst(e.x + 5, e.y + 5, '#a8e8ff', 12, 1.6); pop(e.x, e.y, 'LUFT', '#a8e8ff'); rumble(1); }
    } else if (e.t === 'kr') {
      if (S.pwr.magnet) pull(e, 90);
      if (K.overlap(e, pl)) { e.dead = true; S.kr += 4; K.sfx('coin'); burst(e.x + 5, e.y + 5, '#ffe070', 10, 1.5); pop(e.x, e.y, '+4', '#ffe070'); }
    } else if (e.t === 'heart' && K.overlap(e, pl)) {
      e.dead = true; K.sfx('power'); rumble(2);
      if (S.hp < maxHp()) { S.hp++; pop(e.x, e.y, 'LIV', '#ff8aa0'); } else { S.kr += 8; pop(e.x, e.y, '+8', '#ffe070'); }
      burst(e.x + 6, e.y + 6, '#ff8aa0', 12, 1.7);
    } else if (e.t === 'pwr' && K.overlap(e, pl)) { e.dead = true; givePwr(e.k); burst(e.x + 6, e.y + 6, '#a8f0ff', 14, 1.8); }
    else if (e.t === 'flag' && !e.on && pl.x > e.x) {
      e.on = true; chk = { x: e.x, y: e.y + 16 }; S.hp = maxHp(); K.sfx('ok'); K.kod.save(); rumble(2);
      note(['Bra vila. Vinden är med oss!', 'Flaggan är vår! Vidare!', 'Snyggt! Skurken får vänta.'][Math.floor(Math.random() * 3)]);
    } else if (e.t === 'goal' && K.overlap(e, pl)) dayDone();
    else if (e.t === 'bossT' && !e.used && !boss && pl.x > e.x + 40) { e.used = true; startBoss(e); }
  });
  ents = ents.filter(e => !e.dead);
  puffs.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.t--;
    if (K.t % 2 === 0) parts.push({ x: p.x + 4, y: p.y + 4, vx: 0, vy: 0, t: 10, c: S.pwr.fan ? '#fff6c0' : '#d8f4ff', s: 2 });
    if (solid(Math.floor((p.x + 4) / TS), Math.floor((p.y + 4) / TS))) p.t = 0;
    ents.forEach(e => { if (puffHits(e, p)) { breakSmoke(e); p.t = 0; } });
    if (boss && boss.hp > 0 && p.t > 0) {
      const box = boss.final ? boss : { x: boss.x - 12, y: boss.y - 6, w: boss.w + 24, h: boss.h + 28 };
      if (K.overlap(p, box)) { p.t = 0; hitBoss(); }
    }
  });
  puffs = puffs.filter(p => p.t > 0);
  ents.forEach(e => {
    if (e.t === 'flower') {
      e.vy = Math.min(e.vy + 0.15, 2); e.y += e.vy;
      if (solid(Math.floor((e.x + 4) / TS), Math.floor((e.y + 8) / TS))) { e.y = Math.floor((e.y + 8) / TS) * TS - 8; e.vy = 0; }
      if (--e.life <= 0) e.dead = true;
    }
  });
}
function pull(e, r) {
  const dx = (pl.x + 6) - (e.x + 5), dy = (pl.y + 8) - (e.y + 5), d = Math.hypot(dx, dy) || 1;
  if (d < r) { e.x += dx / d * 2.2; e.y += dy / d * 2.2; }
}

// ---------- Sotkungen ----------
const SUG_LINES = ['Bara en liten puff...', 'En paus, lilla drake?', 'Jag blåses ALDRIG bort!', 'Alla andra tar en paus...', 'Oj. Du blåser hårt.'];
function startBoss(trig) {
  const kind = trig.kind || (trig.final ? 'final' : 'dusk');
  const final = kind === 'final', little = kind === 'little';
  const sc0 = 1;
  const bw = final ? 52 : little ? 28 : 38;
  const bh = final ? 70 : little ? 32 : 44;
  const hp = final ? 8 : little ? 2 : 3;
  boss = { x: trig.sx, y: trig.sy, w: bw, h: bh, hp, max: hp, t: 0, state: 'intro', ax0: trig.x, ax1: trig.x + 22 * 16, flash: 0, say: '', sayT: 0, dir: -1, ty: 70, final, little, kind, sc0, wave: 0, bw0: bw, bh0: bh };
  boss.gates = [];
  const xL = Math.floor(boss.ax0 / TS), xR = Math.floor(boss.ax1 / TS) - 1;
  for (let y = 0; y < 10; y++) {
    boss.gates.push({ x: xL, y, c: map.get(xL, y) }); map.set(xL, y, '#');
    if (!final) { boss.gates.push({ x: xR, y, c: map.get(xR, y) }); map.set(xR, y, '#'); }
  }
  chk = { x: boss.ax0 + 40, y: 144 };
  cam.lock = boss.ax0 + 16; K.music(SONG.boss); K.sfx('boss'); rumble(8);
  say(final ? 'Jag trodde du gav upp vid frukost.' : little ? 'Jag är liten. Men jobbig!' : 'En paus, lilla drake? Jag har en fåtölj av dimma.', 160);
  note('Blås på skurken med B. Håll upp för att blåsa snett uppåt!', 220);
}
function openGates() {
  if (!boss || !boss.gates) return;
  boss.gates.forEach(g => map.set(g.x, g.y, g.c));
  boss.gates = null;
}
function say(s, t = 110) { boss.say = s; boss.sayT = t; }
function hitBoss() {
  boss.hp--; boss.flash = 14; K.sfx('hit'); rumble(6); hitstop(6);
  burst(boss.x + boss.w * 0.4, boss.y + boss.h * 0.35, '#e8e0ff', 22, 2.4);
  addCombo(boss.x + boss.w / 2, boss.y);
  if (boss.hp === Math.ceil(boss.max * 0.7)) say(SUG_LINES[3]);
  else if (boss.hp === Math.ceil(boss.max * 0.4)) say(SUG_LINES[4]);
  else if (boss.hp === 2) say('Okej, okej... jag krymper!');
  if (boss.hp <= 0) {
    boss.state = 'shrink'; boss.t = 0;
    ents = ents.filter(e => e.t !== 'smoke');
    K.music(null); K.sfx('win'); rumble(8);
  }
}
function updateBoss() {
  const b = boss; b.t++; if (b.flash) b.flash--; if (b.sayT) b.sayT--;
  const sc = b.sc0 * (0.5 + 0.5 * (b.hp / b.max)), cx = b.x + b.w / 2; b.sc = sc;
  b.w = Math.round((b.bw0 || 52) * sc); b.h = Math.round((b.bh0 || 70) * sc); b.x = cx - b.w / 2;
  const fast = 1 + (b.max - b.hp) * 0.06;
  const hoverY = b.final ? 44 : 160 - b.h - 8;
  if (b.state === 'intro') { b.y += (hoverY - b.y) * 0.05; if (b.t > 120) { b.state = 'float'; b.t = 0; } }
  else if (b.state === 'float') {
    const pad = b.final ? 10 : 70;
    b.x += b.dir * (b.final ? 0.9 : 0.55) * fast;
    if (b.x < b.ax0 + pad) { b.x = b.ax0 + pad; b.dir = 1; }
    if (b.x + b.w > b.ax1 - pad) { b.x = b.ax1 - pad - b.w; b.dir = -1; }
    b.y = hoverY + Math.sin(b.t / 30) * (b.final ? 22 : 5);
    const puffEvery = b.final ? Math.round(130 / fast) : Math.round(150 / fast);
    if (puffEvery > 0 && b.t % puffEvery === 0) { const s = makeSmoke(cx - 6, b.y + b.h, 'drift', true); s.home = true; ents.push(s); }
    if (b.final && b.hp <= b.max * 0.5 && b.t % 240 === 180) { b.state = 'wave'; b.t = 0; say('Fram med kryparna!', 70); }
    else if (b.t % 300 === 0 && b.hp < b.max) say(SUG_LINES[(b.t / 300) % 3]);
    if (b.t > (b.final ? 360 : 400)) { if (b.final) { b.state = 'warn'; b.t = 0; } else { b.dir *= -1; b.t = 0; } }
  } else if (b.state === 'warn') {
    if (b.t === 1) { K.sfx('warn'); rumble(5); burst(b.x + b.w / 2, b.y + b.h * 0.8, '#ffe070', 16, 2.2); say('Se upp!', 50); }
    b.x += Math.sin(b.t) * 1.2;
    if (b.t > 80) { b.state = 'dive'; b.t = 0; b.dir = pl.x < cx ? -1 : 1; }
  } else if (b.state === 'dive') {
    const prevY = b.y, targetY = 160 - b.h;
    b.y += (targetY - b.y) * 0.1; b.x += b.dir * 1.55 * fast;
    if (prevY < targetY - 6 && b.y >= targetY - 6) { landDust(b.x + b.w * 0.25, 160); landDust(b.x + b.w * 0.7, 160); rumble(7); K.sfx('land'); }
    if (b.x < b.ax0 + 4 || b.x + b.w > b.ax1 - 4) { b.state = 'rise'; b.t = 0; }
  }
  else if (b.state === 'rise') { b.y += (44 - b.y) * 0.06; if (b.t > 60) { b.state = 'float'; b.t = 1; } }
  else if (b.state === 'wave') {
    if (b.t === 1) rumble(4);
    if (b.t === 20) {
      rumble(7);
      const y = 148, dir = pl.x < cx ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const s = makeSmoke(cx + dir * (20 + i * 18), y, 'crawl', false); s.life = 0; s.dir = dir; ents.push(s);
      }
    }
    if (b.t > 80) { b.state = 'float'; b.t = 1; }
  } else if (b.state === 'shrink') {
    b.y -= 0.4;
    if (b.t === 60) say(b.final ? 'Jag... kommer på te. Oinbjuden.' : 'Jag har... ett möte. Hejdå!', 140);
    if (b.t > 180) {
      if (b.final) { S.totalKr += S.kr; S.totalAir += S.air; awardStars(); S.scene = 'end'; S.endT = K.t; K.music(SONG.win); K.kod.save(); }
      else { openGates(); cam.lock = undefined; ents.push({ t: 'kr', x: b.x + 20, y: b.y + 20, w: 10, h: 10 }); S.dayKr++; note(b.little ? 'Sotnissen rymde mot klipporna!' : 'Greven flyr mot berget. Vidare!', 140); boss = null; K.music(dagSang()); }
    }
  }
  if (b.state !== 'shrink' && b.state !== 'intro' && K.overlap({ x: b.x + b.w * 0.22, y: b.y + b.h * 0.28, w: b.w * 0.56, h: b.h * 0.52 }, pl)) hurt();
}
function awardStars() {
  let n = 1;
  if (S.dayKr && S.kr >= Math.ceil(S.dayKr * 0.7) * 4) n++;
  if ((S.dayAir && S.air >= S.dayAir) || !S.hurtDay) n++;
  if (n > 3) n = 3;
  S.starsGot = n;
  if (n > (S.bestStars[S.day] || 0)) S.bestStars[S.day] = n;
  const sum = S.bestStars.reduce((a, b) => a + (b || 0), 0);
  if (sum >= 12 && !S.unlockTrail) { S.unlockTrail = true; note('Tolv stjärnor! Ett gnistspår tänds bakom Drakis.', 180); }
}
function dayStars() { return S.starsGot || 0; }
function dayDone() {
  awardStars();
  S.unlockedDay = Math.max(S.unlockedDay || 0, Math.min(DAYS.length - 1, S.day + 1));
  S.scene = 'card'; S.cardT = K.t; S.totalKr += S.kr; S.totalAir += S.air; K.music(SONG.win); K.sfx('win'); rumble(5); K.kod.save();
}
function startDay(d) { S.day = d; S.scene = 'intro'; S.cardT = K.t; buildDay(d); K.music(null); K.kod.save(); }

const game = {
  update() {
    if (S.msgT) S.msgT--;
    if (shake) { shake *= 0.82; if (shake < 0.25) shake = 0; }
    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.t--; p.vy += 0.02; }); parts = parts.filter(p => p.t > 0);
    pops.forEach(p => { p.y -= 0.4; p.t--; }); pops = pops.filter(p => p.t > 0);
    if (S.scene === 'help') {
      if (K.startTap || K.pressed.b) { S.help = false; S.scene = 'title'; K.sfx('select'); }
      return;
    }
    if (S.scene === 'title') {
      if (K.pressed.up) { S.scene = 'help'; S.help = true; K.sfx('select'); return; }
      if (K.pressed.down) { S.assist = !S.assist; K.sfx('ok'); return; }
      const maxd = Math.max(0, Math.min(DAYS.length - 1, S.unlockedDay || 0));
      if (K.pressed.left) { S.pickDay = Math.max(0, (S.pickDay || 0) - 1); K.sfx('select'); }
      if (K.pressed.right) { S.pickDay = Math.min(maxd, (S.pickDay || 0) + 1); K.sfx('select'); }
      if (K.pressed.b) { K.kod.open(); return; }
      if (K.startTap) {
        const saved = K.kod.saved();
        if ((S.pickDay || 0) === 0 && saved && saved.scene && saved.scene !== 'title' && saved.scene !== 'end' && saved.scene !== 'help') K.kod.apply(saved);
        else { S.t0 = K.t; startDay(S.pickDay || 0); }
      }
      return;
    }
    if (S.scene === 'intro') { if (K.t - S.cardT > 40 && K.startTap) { S.scene = 'play'; K.music(dagSang()); } return; }
    if (S.scene === 'card') {
      if (K.t - S.cardT > 60 && K.startTap) {
        if (S.day + 1 >= DAYS.length) { S.scene = 'end'; S.endT = K.t; }
        else startDay(S.day + 1);
      }
      return;
    }
    if (S.scene === 'end') { if (K.t - S.endT > 90 && K.startTap) { S.day = 0; S.totalKr = 0; S.totalAir = 0; S.deaths = 0; S.scene = 'title'; } return; }
    if (K.pressed.start) { S.paused = !S.paused; K.sfx('select'); }
    if (S.paused) return;
    if (hitHold) { hitHold--; return; }
    updatePlayer(); updateEnts(); if (boss) updateBoss();
  },
  draw(ctx) {
    if (S.scene === 'title') return drawTitle(ctx);
    if (S.scene === 'help') return drawHelp(ctx);
    if (S.scene === 'end') return drawEnd(ctx);
    buildTiles();
    const mw = map.w * TS, mh = map.h * TS;
    let tx = K.clamp(pl.x + 6 - K.W / 2 + pl.dir * 36 + pl.vx * 4, 0, Math.max(0, mw - K.W));
    if (cam.lock !== undefined && boss) tx = cam.lock;
    const wantY = K.H >= mh ? mh - K.H : K.clamp((pl.y + pl.h) - 130, 0, mh - K.H);
    cam.x += (tx - cam.x) * 0.08;
    cam.y += (wantY - cam.y) * 0.14;
    const jx = shake ? (Math.random() - 0.5) * shake : 0, jy = shake ? (Math.random() - 0.5) * shake : 0;
    const cx = Math.round(cam.x + jx), cy = Math.round(cam.y + jy);
    K.parallax(ctx, playBg || K.img['bg_d' + (S.day + 1)], cx * 0.16, 0);
    drawMap(ctx, cx, cy);
    ents.forEach(e => drawEnt(ctx, e, cx, cy));
    if (boss) drawBoss(ctx, cx, cy);
    puffs.forEach(p => {
      const x = p.x - cx, y = p.y - cy, s = p.w;
      ctx.fillStyle = 'rgba(210,245,255,0.85)'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2 + 1, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s / 2 - 1, y + s / 2 - 1, s / 3, 0, 7); ctx.fill();
    });
    parts.forEach(p => K.rect(ctx, p.x - cx, p.y - cy, p.s || 2, p.s || 2, p.c));
    pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.t / 18); K.text(ctx, p.s, p.x - cx, p.y - cy, p.c, { align: 'c', sh: '#203050' }); ctx.globalAlpha = 1; });
    drawDrakis(ctx, cx, cy);
    if (!softCloud) {
      softCloud = K.canvas(120, 50); const g = softCloud.getContext('2d');
      [[30, 30, 22], [60, 22, 26], [88, 30, 20], [60, 34, 24]].forEach(([x, y, r]) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,248,240,.35)'); gr.addColorStop(1, 'rgba(255,248,240,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 120, 50);
      });
    }
    for (let i = 0; i < 3; i++) { const x = ((i * 173 - cx * 0.5 + K.t * 0.12) % (K.W + 200) + (K.W + 200)) % (K.W + 200) - 120; const cy0 = 8 + i * Math.max(18, Math.round((K.H - 180) * 0.12) + 18); ctx.globalAlpha = 0.55; ctx.drawImage(softCloud, x, cy0); ctx.globalAlpha = 1; }
    drawHud(ctx);
    if (S.scene === 'intro') drawIntro(ctx);
    if (S.scene === 'card') drawCard(ctx);
    if (S.paused) { const py = Math.min(70, Math.round(K.H / 3)); K.panel(ctx, K.W / 2 - 70, py, 140, 36); K.text(ctx, 'PAUS', K.W / 2, py + 8, '#ffd860', { align: 'c' }); K.text(ctx, 'MENY: fortsätt', K.W / 2, py + 22, '#fff', { align: 'c' }); }
  }
};

function isGroundCol(tx) { return map.get(tx, 10) === '#' || map.get(tx, 11) === '#'; }
function topOfRun(tx, ty) { let t = ty; while (t > 0 && map.get(tx, t - 1) === '#') t--; return t; }
function botOfRun(tx, ty) { let t = ty; while (t + 1 < map.h && map.get(tx, t + 1) === '#') t++; return t; }
const GRASS_OFF = 4, ISLAND_OFF = 12, CLOUD_OFF = 6;

function drawMap(ctx, cx, cy) {
  const x0 = Math.floor(cx / TS) - 2, x1 = x0 + Math.ceil(K.W / TS) + 4;
  if (art('ground_mid_a') || art('ground_a')) {
    const seen = {};
    for (let tx = Math.max(0, x0); tx <= x1 && tx < map.w; tx++) {
      for (let ty = 0; ty < map.h; ty++) {
        if (map.get(tx, ty) !== '#' || map.get(tx, ty - 1) === '#') continue;
        if (seen[tx + ':' + ty]) continue;
        let L = tx, R = tx;
        while (L > 0 && map.get(L - 1, ty) === '#' && map.get(L - 1, ty - 1) !== '#') L--;
        while (R + 1 < map.w && map.get(R + 1, ty) === '#' && map.get(R + 1, ty - 1) !== '#') R++;
        for (let x = L; x <= R; x++) seen[x + ':' + ty] = 1;
        drawGroundRun(ctx, L, R, ty, botOfRun(tx, ty), cx, cy);
      }
    }
  } else {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= map.w) continue;
      for (let ty = 0; ty < map.h; ty++) {
        const c = map.get(tx, ty); if (c !== '#') continue;
        const sx = tx * TS - cx, sy = ty * TS - cy;
        const top = map.get(tx, ty - 1) !== '#', bot = map.get(tx, ty + 1) !== '#';
        const floating = botOfRun(tx, ty) < 10;
        if (top) {
          const kind = !isHashNeighbor(tx, ty, -1) ? 1 : !isHashNeighbor(tx, ty, 1) ? 2 : 0;
          ctx.drawImage(kind ? TILE.cap[kind] : tileAt('cap', tx, ty), sx, sy);
        } else {
          ctx.drawImage(tileAt('fill', tx, ty), sx, sy);
          if (!isHashNeighbor(tx, ty, -1)) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(sx, sy, 2, 16); }
          if (!isHashNeighbor(tx, ty, 1)) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(sx + 14, sy, 2, 16); }
        }
        if (bot && floating) ctx.drawImage(tileAt('bot', tx, ty), sx, sy);
      }
    }
  }
  for (let ty = 0; ty < map.h; ty++) {
    let tx = 0;
    while (tx < map.w) {
      if (map.get(tx, ty) === '=') {
        let x2 = tx; while (x2 + 1 < map.w && map.get(x2 + 1, ty) === '=') x2++;
        if (x2 >= x0 && tx <= x1) drawCloud(ctx, tx * TS - cx, ty * TS - cy, (x2 - tx + 1) * TS);
        tx = x2 + 1;
      } else tx++;
    }
  }
  if (!art('vent_idle')) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= map.w) continue;
      for (let ty = 0; ty < map.h; ty++) if (map.get(tx, ty) === 'C') ctx.drawImage(TILE.vent, tx * TS - cx, ty * TS - cy);
    }
  }
}
function isHashNeighbor(tx, ty, dir) { return map.get(tx + dir, ty) === '#' || map.get(tx + dir, ty) === 'C'; }
function drawGroundRun(ctx, L, R, top, bot, cx, cy) {
  const floating = bot < 10 && top > 1, x0 = L * TS, x1 = (R + 1) * TS, y = top * TS, runW = x1 - x0;
  if (floating && art('island_small') && runW <= 48) {
    const im = art('island_small');
    K.blit(ctx, im, (x0 + x1) / 2 - K.sw(im) / 2 - cx, y - ISLAND_OFF - cy);
    return;
  }
  const left = floating ? (art('island_left') || art('ground_left_a')) : art('ground_left_a');
  const right = floating ? (art('island_right') || art('ground_right_a')) : art('ground_right_a');
  const midA = floating ? (art('island_mid') || art('ground_mid_a')) : art('ground_mid_a');
  const midB = (!floating && art('ground_mid_b')) || midA;
  const goff = floating ? ISLAND_OFF : GRASS_OFF;
  const dy = y - goff - cy, sx0 = x0 - cx, sx1 = x1 - cx;
  const lw = left ? K.sw(left) : 16, rw = right ? K.sw(right) : 16;
  if (left) K.blit(ctx, left, sx0, dy);
  if (right) K.blit(ctx, right, sx1 - rw, dy);
  if (midA) {
    const inner0 = sx0 + lw * 0.7, inner1 = sx1 - rw * 0.7;
    let x = inner0, i = 0;
    while (x < inner1 - 0.5) {
      const mid = (i++ & 1) && midB ? midB : midA;
      K.blit(ctx, mid, x, dy);
      x += K.sw(mid) * 0.92;
    }
  }
  const sprH = left ? K.sh(left) : 32, visBottom = (top === 0 ? top * TS : y - goff + sprH), tileBottom = (bot + 1) * TS;
  if (top === 0) {
    // stenvägg (bossgrind) utan gräs på toppen
    for (let ty = top; ty <= bot; ty++) {
      for (let tx = L; tx <= R; tx++) if (map.get(tx, ty) === '#') blitRock(ctx, tx * TS - cx, ty * TS - cy, tx, ty);
    }
    return;
  }
  if (tileBottom > visBottom + 2) {
    for (let ty = Math.ceil(visBottom / TS); ty <= bot; ty++) {
      for (let tx = L; tx <= R; tx++) if (map.get(tx, ty) === '#') blitRock(ctx, tx * TS - cx, ty * TS - cy, tx, ty);
    }
  }
}
function blitRock(ctx, sx, sy, tx, ty) {
  const im = art('ground_mid_a') || art('ground_a');
  if (!im) { if (TILE.fill) ctx.drawImage(tileAt('fill', tx, ty), sx, sy); return; }
  const srcY = im.height * 0.48, srcH = im.height * 0.42;
  ctx.drawImage(im, 0, srcY, im.width, srcH, sx, sy, TS, TS);
}
function drawCloud(ctx, x, y, w) {
  const L = art('cloud_left_a') || art('cloud_a'), M = art('cloud_mid_a') || art('cloud_a');
  const R = art('cloud_right_a') || art('cloud_b') || L;
  const Mb = art('cloud_mid_b') || M;
  if (L) {
    const dy = y - CLOUD_OFF, lw = K.sw(L), rw = K.sw(R);
    K.blit(ctx, L, x - 2, dy);
    K.blit(ctx, R, x + w - rw + 2, dy);
    if (M && w > lw + rw - 8) {
      let i = 0, px = x + lw * 0.65;
      while (px < x + w - rw * 0.65) {
        const mid = (i++ & 1) && Mb ? Mb : M;
        K.blit(ctx, mid, px, dy);
        px += K.sw(mid) * 0.85;
      }
    }
    return;
  }
  const g = ctx;
  g.fillStyle = 'rgba(255, 210, 220, 0.95)';
  cloudPuff(g, x + 6, y + 8, 8); cloudPuff(g, x + w - 6, y + 8, 8);
  for (let i = 16; i < w - 8; i += 14) cloudPuff(g, x + i, y + 7 + ((i / 14) & 1), 9);
  g.fillStyle = '#fff8f2';
  g.fillRect(x + 4, y + 1, w - 8, 5);
  g.fillStyle = '#ffffff';
  g.fillRect(x + 6, y, w - 12, 3);
  g.fillStyle = 'rgba(240, 170, 190, 0.7)';
  g.fillRect(x + 5, y + 8, w - 10, 3);
}
function cloudPuff(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }

function drawEnt(ctx, e, cx, cy) {
  const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
  if (sx < -80 || sx > K.W + 80) return;
  if (e.t === 'smoke') drawSmoke(ctx, e, cx, cy);
  else if (e.t === 'air') K.blit(ctx, K.img.bubble, sx - 0.5, sy - 0.5 + Math.round(Math.sin(K.t / 10 + e.x) * 2));
  else if (e.t === 'kr') {
    const bob = Math.round(Math.sin(K.t / 10 + e.x) * 2);
    const squash = 0.65 + 0.35 * Math.abs(Math.cos(K.t / 12 + e.x));
    const img = K.img.star, sw = K.sw(img), sh = K.sh(img);
    ctx.save(); ctx.translate(sx + 5, sy + 5 + bob); ctx.scale(squash, 1);
    K.blit(ctx, img, -sw / 2, -sh / 2); ctx.restore();
  } else if (e.t === 'heart') {
    const im = art('pwr_heart') || K.img.heart;
    K.blit(ctx, im, sx + 6 - K.sw(im) / 2, sy - 1 + Math.round(Math.sin(K.t / 9 + e.x) * 2));
  } else if (e.t === 'pwr') drawPwr(ctx, e, sx, sy);
  else if (e.t === 'flag') {
    const im = art(e.on ? 'flag_on' : 'flag_off');
    if (im) K.foot(ctx, im, sx + 6, sy + 32);
    else {
      K.rect(ctx, sx + 3, sy, 2, 32, '#6a4a30');
      K.rect(ctx, sx + 2, sy + 30, 4, 2, '#4a3020');
      const on = e.on, fy = on ? 2 : 4;
      K.rect(ctx, sx + 5, sy + fy, 11, 8, on ? '#5ec46a' : '#d0d0d8');
      K.rect(ctx, sx + 5, sy + fy, 11, 1, on ? '#8eec9a' : '#f0f0f4');
    }
  } else if (e.t === 'goal') {
    const gl = art('goal_left'), gr = art('goal_right');
    if (gl && gr) {
      K.foot(ctx, gl, sx + 2, sy + 48);
      K.foot(ctx, gr, sx + 22, sy + 48);
    } else {
      K.rect(ctx, sx, sy + 8, 3, 40, '#6a5340'); K.rect(ctx, sx + 21, sy + 8, 3, 40, '#6a5340');
      K.rect(ctx, sx - 2, sy + 44, 7, 4, pal.rock[1]); K.rect(ctx, sx + 19, sy + 44, 7, 4, pal.rock[1]);
      K.rect(ctx, sx, sy + 6, 24, 3, '#c8a050');
      K.blit(ctx, K.img.star, sx + 6, sy - 6 + Math.round(Math.sin(K.t / 12) * 2), false, 0.9);
    }
    K.text(ctx, 'DAG ' + (S.day + 1), sx + 12, sy - 14, '#fff', { align: 'c', sh: '#3a3a6a' });
  } else if (e.t === 'wind') {
    for (let i = 0; i < 5; i++) {
      const yy = (sy + e.h - ((K.t * 2 + i * 23 + e.x) % e.h));
      ctx.strokeStyle = 'rgba(230,245,255,0.75)'; ctx.beginPath();
      ctx.moveTo(sx + 3 + i * 2.5, yy + 8); ctx.quadraticCurveTo(sx + 6 + i * 2.5, yy + 4, sx + 3 + i * 2.5, yy); ctx.stroke();
    }
  } else if (e.t === 'flower') {
    const fc = pal.flower[(e.x | 0) % pal.flower.length];
    K.rect(ctx, sx + 3, sy + 4, 2, 5, pal.grass[2]);
    K.rect(ctx, sx + 1, sy, 6, 4, fc); K.rect(ctx, sx + 3, sy + 1, 2, 2, '#ffe070');
  } else if (e.t === 'chim') {
    const ph = e.k % 150, puffing = ph > 125 || ph < 18;
    const im = puffing ? (art((e.k & 1) ? 'vent_puff2' : 'vent_puff1') || art('vent_idle')) : art('vent_idle');
    if (im) K.foot(ctx, im, e.x + 8 - cx, e.y + 16 - cy);
    else if (TILE.vent) ctx.drawImage(TILE.vent, sx, sy);
  }
}
function smokeFrame(e) {
  const k = e.kind || 'drift', a = (K.t >> 4) + (e.ox | 0);
  if (k === 'crawl') return art('crawl' + (1 + a % 3)) || K.img.smoke1;
  if (k === 'thick') return (e.hp < 2 ? art('thick_hurt') : art('thick_idle')) || K.img.smoke1;
  if (k === 'split') return (e.state === 'pop' ? art('split_pop') : art('split_idle')) || K.img.smoke1;
  if (k === 'spin') return art('swirl' + (1 + a % 2)) || K.img.smoke2;
  if (k === 'spark') return art('spark' + (1 + a % 2)) || K.img.smoke3;
  if (k === 'mist') return art('mist_head') || K.img.smoke1;
  if (k === 'dive') return art('split_idle') || K.img.smoke1;
  return K.img['smoke' + (1 + a % 3)] || art('split_idle');
}
function drawSmoke(ctx, e, cx, cy) {
  const k = e.kind || 'drift';
  const flip = k === 'crawl' ? e.dir < 0 : (k === 'mist' ? e.dir < 0 : e.x > pl.x);
  const fx = e.x + e.w / 2 - cx, fy = e.y + e.h - cy;
  if (e.state === 'warn' && (K.t >> 2) & 1) ctx.globalAlpha = 0.65;
  if (k === 'dive' && !e.small) {
    const img = smokeFrame(e);
    const stretch = e.state === 'swoop' ? 1.7 : e.state === 'warn' ? 1.3 : 1.15;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(0.85, stretch);
    K.foot(ctx, img, 0, 0, flip, 1);
    ctx.restore();
    if (e.state === 'swoop') {
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.4 * (1 - i / 4);
        K.foot(ctx, img, fx, fy - i * 7, flip, 0.55);
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  const img = smokeFrame(e);
  K.foot(ctx, img, fx, fy, flip, e.small ? 0.7 : 1);
  if (e.links) {
    const body = art('mist_body') || img;
    e.links.forEach((l, i) => K.foot(ctx, body, l.x + l.w / 2 - cx, l.y + l.h - cy, flip, 0.85 - i * 0.1));
  }
  ctx.globalAlpha = 1;
}
function drawPwr(ctx, e, sx, sy) {
  const bob = Math.round(Math.sin(K.t / 8 + e.x) * 2);
  ctx.beginPath(); ctx.fillStyle = 'rgba(180,240,255,0.35)'; ctx.arc(sx + 6, sy + 6 + bob, 9, 0, 7); ctx.fill();
  const names = { fan: 'pwr_fan', shield: 'pwr_shield', wind: 'pwr_wind', magnet: 'pwr_magnet' };
  const im = art(names[e.k]);
  if (im) K.blit(ctx, im, sx + 6 - K.sw(im) / 2, sy + 6 - K.sh(im) / 2 + bob);
  else if (e.k === 'fan') K.blit(ctx, K.img.bubble, sx - 1, sy - 1 + bob);
  else if (e.k === 'shield' || e.k === 'magnet') K.blit(ctx, K.img.star, sx - 1, sy - 1 + bob);
  else if (e.k === 'wind') {
    ctx.strokeStyle = '#d8ffff'; ctx.beginPath();
    ctx.arc(sx + 6, sy + 6 + bob, 5, 0, 4); ctx.stroke();
    K.rect(ctx, sx + 2, sy + 5 + bob, 8, 2, '#e8ffff');
  }
}

function drakisFrame() {
  const I = K.img;
  if (pl.blowT) return I.drakis_blow;
  if (!pl.onGround) return I.drakis_jump;
  if (pl.anim) return (Math.floor(pl.anim / 2) & 1) ? I.drakis_walk1 : I.drakis_walk2;
  return I.drakis_idle;
}
function drawDrakis(ctx, cx, cy) {
  (pl.trail || []).forEach(s => {
    ctx.globalAlpha = s.t / 16 * 0.45;
    K.rect(ctx, s.x - cx - 1, s.y - cy - 1, 3, 3, s.c);
  });
  ctx.globalAlpha = 1;
  if (pl.inv && (K.t >> 2) & 1) return;
  const sc = 1 + S.day * 0.06;
  if (S.day >= 2 || S.pwr.shield || S.pwr.fan) {
    ctx.globalAlpha = 0.22 + 0.1 * Math.sin(K.t / 10);
    ctx.fillStyle = S.pwr.shield ? '#ffe070' : S.pwr.fan ? '#a8f0ff' : '#bfe8ff';
    ctx.beginPath(); ctx.arc(pl.x + 6 - cx, pl.y + 11 - cy, 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (S.pwr.shield) {
    for (let i = 0; i < 3; i++) {
      const a = K.t / 10 + i * 2.1;
      const si = art('pwr_shield') || K.img.star; K.blit(ctx, si, pl.x + 6 - cx + Math.cos(a) * 14 - K.sw(si) * 0.22, pl.y + 10 - cy + Math.sin(a) * 10 - K.sh(si) * 0.22, false, 0.45);
    }
  }
  const f = drakisFrame(), bob = pl.anim && pl.onGround ? -Math.abs(Math.sin(pl.anim * 0.8)) : 0;
  const ox = pl.blowT ? 6 : 0;
  const sx = 1 + (pl.squash || 0) * 0.035 - (pl.stretch || 0) * 0.03;
  const sy = 1 - (pl.squash || 0) * 0.04 + (pl.stretch || 0) * 0.05;
  ctx.save();
  ctx.translate(pl.x + 6 - cx + ox * pl.dir, pl.y + pl.h + 1 - cy + bob + (pl.gliding ? 1 : 0));
  ctx.scale(sx * (pl.dir < 0 ? -1 : 1), sy);
  K.foot(ctx, f, 0, 0, false, sc);
  ctx.restore();
}

function bossFrame(b) {
  const a = K.t >> 4, slam = b.state === 'warn' || b.state === 'dive' || b.state === 'wave';
  if (b.kind === 'little' || b.little) {
    const f = slam ? [art('little_dive'), art('little_dive2')] : [art('little_idle'), art('little_idle2')];
    return f[a & 1] || art('little_idle') || K.img.suget;
  }
  if (b.kind === 'dusk' || !b.final) {
    if (slam) return ((a & 1) ? art('dusk_slam2') : art('dusk_slam')) || K.img.suget;
    return ((a & 1) ? art('dusk_idle2') : art('dusk_idle')) || K.img.suget;
  }
  if (b.hp <= b.max * 0.35) return art('suget_hurt') || K.img.suget;
  if (slam) return (b.hp <= b.max * 0.7 ? art('suget_slam_hurt') : art('suget_slam')) || K.img.suget;
  return art('suget_slam') || K.img.suget;
}
function drawBoss(ctx, cx, cy) {
  const b = boss, x = b.x - cx, y = b.y - cy;
  ctx.globalAlpha = b.state === 'shrink' ? Math.max(0, 1 - b.t / 200) : 1;
  const base = bossFrame(b);
  const img = b.flash && (b.flash >> 1) & 1 ? flashOf(base) : base;
  const wob = Math.sin(K.t / 8) * 1.5;
  K.foot(ctx, img, x + b.w / 2, y + b.h + wob, b.dir > 0, b.sc);
  ctx.globalAlpha = 1;
  if (b.sayT) {
    const lines = K.wrap(b.say, 26), bw = Math.max(...lines.map(l => K.textW(l))) + 8;
    const bx = K.clamp(x + b.w / 2 - bw / 2, 4, K.W - bw - 4);
    let by = y - 12 - lines.length * 9; if (by < 44) by = Math.min(y + b.h + 4, 150 - lines.length * 9);
    K.panel(ctx, bx, by, bw, lines.length * 9 + 6, '#f4f0ff', '#5a4e74', '#3a3050');
    lines.forEach((l, i) => K.text(ctx, l, bx + 4, by + 4 + i * 9, '#3a3050'));
  }
  if (b.state === 'warn') {
    const gx = b.x - cx, gy = 160 - cy;
    const flash = (K.t >> 2) & 1;
    K.rect(ctx, gx - 8, gy - 4, b.w + 16, 4, flash ? '#ffe070' : '#ff8060');
    ctx.globalAlpha = 0.25; K.rect(ctx, gx - 4, y, b.w + 8, gy - y, flash ? '#ffe070' : '#ffb070'); ctx.globalAlpha = 1;
  }
  if (b.state !== 'shrink') {
    const title = b.final ? 'SOTKUNGEN' : (b.little ? 'SOTNISSEN' : 'GREVE SKYMNING');
    const barY = (K.portrait || K.H > 220) ? 34 : 168;
    K.text(ctx, title, K.W / 2, barY, '#fff', { align: 'c', sh: '#3a3050' });
    K.rect(ctx, K.W / 2 - 50, barY + 9, 100, 2, '#3a3050'); K.rect(ctx, K.W / 2 - 50, barY + 9, 100 * b.hp / b.max, 2, '#c8b8ff');
  }
}
const flashCache = new Map();
function flashOf(img) {
  if (!img) return img;
  let t = flashCache.get(img);
  if (!t) { t = K.tint(img, '#ffffff', 0.7, 'source-atop'); flashCache.set(img, t); }
  return t;
}

function drawHud(ctx) {
  const tall = K.portrait || K.H > 220;
  const day = 'DAG ' + (S.day + 1);
  const kr = S.kr + ' KR SPARADE';
  if (tall) {
    K.chip(ctx, 4, 4, day);
    for (let i = 0; i < maxHp(); i++) { ctx.globalAlpha = i < S.hp ? 1 : 0.25; const hi = art('pwr_heart') || K.img.heart; K.blit(ctx, hi, 52 + i * 11, 4, false, hi === K.img.heart ? 0.9 : 0.7); ctx.globalAlpha = 1; }
    K.chip(ctx, 88, 4, 'ANDNING', { col: '#cfe8ff' });
    for (let i = 0; i < maxBreath(); i++) { ctx.globalAlpha = i < pl.breath ? 1 : 0.25; K.blit(ctx, K.img.bubble, 148 + i * 10, 3, false, 0.8); ctx.globalAlpha = 1; }
    const kW = K.textW(kr) + 8;
    K.chip(ctx, K.W - kW - 4, 4, kr, { col: '#ffe070' });
    let y2 = 18;
    if (S.combo >= 2) { K.chip(ctx, K.W / 2 - 16, y2, 'x' + S.combo, { col: '#ffe070' }); y2 += 14; }
    const active = Object.keys(S.pwr).filter(k => S.pwr[k] > 0);
    active.forEach((k, i) => { K.chip(ctx, 4 + i * 86, y2, PWR_NAME[k] + ' ' + Math.ceil(S.pwr[k] / 60) + 's', { col: '#a8f0ff' }); });
    if (active.length) y2 += 14;
    if (S.msgT) { const lines = K.wrap(S.msg, 50); const my = Math.max(y2 + 8, K.H - 168); lines.forEach((l, i) => K.text(ctx, l, K.W / 2, my + i * 9, '#fff', { align: 'c', sh: '#2a3a7a' })); }
    return;
  }
  // Liggande: HUD i hörnen, inte en list över mitten.
  K.chip(ctx, 4, 3, day);
  for (let i = 0; i < maxHp(); i++) { ctx.globalAlpha = i < S.hp ? 1 : 0.25; const hi = art('pwr_heart') || K.img.heart; K.blit(ctx, hi, 52 + i * 11, 3, false, hi === K.img.heart ? 0.9 : 0.7); ctx.globalAlpha = 1; }
  const kW = K.textW(kr) + 8;
  K.chip(ctx, K.W - kW - 4, 3, kr, { col: '#ffe070' });
  K.chip(ctx, 4, 16, 'ANDNING', { col: '#cfe8ff' });
  for (let i = 0; i < maxBreath(); i++) { ctx.globalAlpha = i < pl.breath ? 1 : 0.25; K.blit(ctx, K.img.bubble, 62 + i * 10, 15, false, 0.8); ctx.globalAlpha = 1; }
  if (S.combo >= 2) K.chip(ctx, K.W - 36, 16, 'x' + S.combo, { col: '#ffe070' });
  const active = Object.keys(S.pwr).filter(k => S.pwr[k] > 0);
  active.forEach((k, i) => {
    K.chip(ctx, 4 + i * 86, 29, PWR_NAME[k] + ' ' + Math.ceil(S.pwr[k] / 60) + 's', { col: '#a8f0ff' });
  });
  if (S.msgT) { const lines = K.wrap(S.msg, 50); lines.forEach((l, i) => K.text(ctx, l, K.W / 2, 42 + i * 9, '#fff', { align: 'c', sh: '#2a3a7a' })); }
}
function drawIntro(ctx) {
  K.rect(ctx, 0, 0, K.W, K.H, 'rgba(20,30,80,.7)');
  const y0 = K.H > 220 ? Math.round((K.H - 180) * 0.22) + 40 : 50;
  K.text(ctx, DAYS[S.day].name, K.W / 2, y0, '#fff', { sc: 2, align: 'c', sh: INDIGO_D });
  const tips = ['Sotkungen har stulit dalens vind. Först ut: Sotnissen. Liten. Jobbig. Och väldigt stolt.', 'Sotnissen stack mot klipporna. Där väntar Greve Skymning, med stora ord och en fåtölj av dimma.', 'Högst upp sitter Sotkungen själv. Han tror att du ger upp. Visa honom vad ett andetag kan.', 'Dimman ligger tät i dalen. Suget kommer i vågor. Vänta ut den, blås, gå vidare.', 'Sista dagen. Vinden vill hem. Du har redan klarat vågen förut.'];
  K.wrap(tips[S.day], 44).forEach((l, i) => K.text(ctx, l, K.W / 2, y0 + 30 + i * 10, '#d8e4ff', { align: 'c' }));
  K.text(ctx, '← → GÅ   A HOPPA (HÅLL: GLID)   B BLÅS FRISK LUFT', K.W / 2, y0 + 74, '#ffe070', { align: 'c' });
  if ((K.t >> 5) & 1) K.text(ctx, 'TRYCK', K.W / 2, y0 + 96, '#fff', { align: 'c' });
}
function drawStarsRow(ctx, n, x, y) {
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < n ? 1 : 0.25;
    K.blit(ctx, K.img.star, x + i * 16, y, false, 0.85);
  }
  ctx.globalAlpha = 1;
}
function drawCard(ctx) {
  const d = DAYS[S.day];
  K.rect(ctx, 0, 0, K.W, K.H, 'rgba(20,30,80,.82)');
  const y0 = K.H > 220 ? Math.round((K.H - 180) * 0.16) + 16 : 18;
  const foot = K.H > 220 ? K.H - 36 : 158;
  K.text(ctx, 'DAG ' + (S.day + 1) + ' KLAR!', K.W / 2, y0, '#ffe070', { sc: 2, align: 'c', sh: INDIGO_D });
  K.text(ctx, S.kr + ' kr sparade   ' + S.air + ' andetag', K.W / 2, y0 + 22, '#fff', { align: 'c' });
  drawStarsRow(ctx, S.starsGot, K.W / 2 - 22, y0 + 32);
  K.wrap(d.fact, 46).forEach((l, i) => K.text(ctx, l, K.W / 2, y0 + 54 + i * 10, '#d8e4ff', { align: 'c' }));
  if (d.up) { K.panel(ctx, 30, y0 + 86, K.W - 60, 28, '#1e2c6e', '#ffe070', '#8a7020'); K.wrap(d.up, 42).forEach((l, i) => K.text(ctx, l, K.W / 2, y0 + 92 + i * 10, '#fff', { align: 'c' })); }
  K.foot(ctx, K.img.drakis_idle, K.W / 2, foot, false, 0.8 + S.day * 0.06);
  if (K.t - S.cardT > 60 && (K.t >> 5) & 1) K.text(ctx, 'TRYCK FÖR NÄSTA DAG', K.W / 2, foot + 8, '#fff', { align: 'c' });
}

function drawHelp(ctx) {
  K.rect(ctx, 0, 0, K.W, K.H, 'rgba(16, 22, 48, 0.92)');
  const y0 = 16;
  K.text(ctx, 'ETT ANDETAG I TAGET', K.W / 2, y0, '#ffe070', { align: 'c', sh: INDIGO_D });
  const lines = [
    'Kr sparade är en leksiffra: pengar du inte lagt på cigaretter.',
    'Andning är andetagen du samlar och använder när du blåser.',
    'Assist är ett lugnare tempo. Samma resa, ingen skam.',
    'Behöver du stöd på riktigt i Sverige?',
    '1177.se  ·  Sluta-röka-linjen 020-84 00 00',
    'Spelet ersätter inte vård eller rådgivning.'
  ];
  let y = y0 + 22;
  lines.forEach((l) => {
    K.wrap(l, 46).forEach((w) => { K.text(ctx, w, K.W / 2, y, '#fff', { align: 'c', sh: INDIGO_D }); y += 10; });
    y += 4;
  });
  if ((K.t >> 5) & 1) K.text(ctx, 'TRYCK FÖR ATT GÅ TILLBAKA', K.W / 2, K.H - 18, '#fff', { align: 'c' });
}
function drawTitle(ctx) {
  K.parallax(ctx, K.img.bg_d2, K.t * 0.2);
  K.rect(ctx, 0, 0, K.W, K.H, 'rgba(20,30,90,.25)');
  for (let i = 0; i < 8; i++) {
    const px = ((K.t * 0.4 + i * 47) % (K.W + 20)) - 10;
    const py = 40 + (i * 17 + Math.sin((K.t + i * 13) / 18) * 8) % (K.H - 50);
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin((K.t + i * 9) / 14);
    ctx.fillStyle = '#d0d8e8';
    ctx.beginPath(); ctx.arc(px, py, 3 + (i & 1), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tall = K.H > 220;
  K.panel(ctx, 10, 8, 126, 166, '#000', '#ffffff', INDIGO_D); K.blit(ctx, K.img.cover, 13, 11, false, 120 / 135);
  const cx = tall ? Math.round(K.W * 0.70) : 230;
  const ty = tall ? Math.round((K.H - 180) * 0.12) + 16 : 0;
  const foot = tall ? K.H - 52 : 124;
  K.text(ctx, 'DRAKIS', cx, ty + 22, '#fff', { sc: 3, align: 'c', sh: INDIGO_D });
  K.text(ctx, 'RESA', cx, ty + 48, '#ffd860', { sc: 3, align: 'c', sh: '#8a5a10' });
  K.text(ctx, 'ETT ANDETAG I TAGET', cx, ty + 74, '#fff', { align: 'c', sh: INDIGO_D });
  const sum = (S.bestStars || []).reduce((a, b) => a + (b || 0), 0);
  if (sum) drawStarsRow(ctx, Math.min(3, Math.ceil(sum / 3)), cx - 22, ty + 86);
  const y = foot + Math.sin(K.t / 20) * 4; K.foot(ctx, K.img.drakis_jump, cx, y);
  const has = K.kod.saved() && K.kod.saved().scene && K.kod.saved().scene !== 'title' && K.kod.saved().scene !== 'end';
  if ((K.t >> 5) & 1) K.text(ctx, has ? 'TRYCK FÖR ATT FORTSÄTTA · B SPARKOD' : 'TRYCK FÖR ATT BÖRJA', cx, foot + 16, '#fff', { align: 'c', sh: INDIGO_D });
  K.text(ctx, DAYS[S.pickDay || 0].name, cx, foot + 28, '#ffe070', { align: 'c', sh: INDIGO_D });
  K.text(ctx, '← → DAG   NER ASSIST' + (S.assist ? ' PÅ' : '') + '   UPP HJÄLP', cx, foot + 40, '#d8e4ff', { align: 'c', sh: INDIGO_D });
}
function drawEnd(ctx) {
  K.parallax(ctx, makeEndBg(), 0);
  const y0 = K.H > 220 ? Math.round((K.H - 180) * 0.12) + 16 : 16;
  const foot = K.H > 220 ? K.H - 40 : 152;
  K.text(ctx, 'VINDEN ÄR FRI!', K.W / 2, y0, '#fff', { sc: 2, align: 'c', sh: INDIGO_D });
  const lines = ['Sotkungen blev mindre och mindre, tills han bara var ett litet moln som drev iväg.', 'Han kommer kanske på te ibland. Oinbjuden. Men nu vet du: ett andetag räcker.', 'Totalt: ' + S.totalKr + ' kr sparade och ' + S.totalAir + ' andetag.', 'Stjärnor: ' + (S.bestStars || []).reduce((a, b) => a + (b || 0), 0) + ' av 15.' + (S.unlockTrail ? ' Gnistspåret är ditt!' : ''), 'Behöver du stöd på riktigt? 1177.se och Sluta-röka-linjen 020-84 00 00.'];
  let y = y0 + 24; lines.forEach(s => K.wrap(s, 48).forEach(l => { K.text(ctx, l, K.W / 2, y, '#fff', { align: 'c', sh: INDIGO_D }); y += 9; }));
  const ky = foot + Math.sin(K.t / 15) * 4; K.foot(ctx, K.img.drakis_jump, K.W / 2, ky, false, 1.2);
  if (K.t - S.endT > 90 && (K.t >> 5) & 1) K.text(ctx, 'TRYCK FÖR ATT SPELA IGEN', K.W / 2, foot + 14, '#fff', { align: 'c', sh: INDIGO_D });
}
let endBg = null; function makeEndBg() { if (!endBg) { endBg = K.canvas(640, 360); const g = endBg.getContext('2d'); g.drawImage(K.img.bg_d2, 0, 0); g.fillStyle = 'rgba(30,40,110,.35)'; g.fillRect(0, 0, 640, 360); endBg.hd = true; } return endBg; }

// ---------- Musik (ljus, i dur) ----------
game.S = S; game.get = () => ({ pl, map, ents, boss, puffs, cam });
game.botHint = () => ({ scene: S.scene, day: S.day, boss: !!(boss && boss.hp > 0 && !boss.final) });
function snapDrakis() {
  const scene = (S.scene === 'title' || S.scene === 'end') ? S.scene : (S.scene === 'card' ? 'card' : (S.scene === 'intro' ? 'intro' : 'play'));
  return { v: 1, scene, day: S.day, hp: S.hp, kr: S.kr, air: S.air, totalKr: S.totalKr, totalAir: S.totalAir, deaths: S.deaths,
    chk: chk ? { x: chk.x, y: chk.y } : null, bestStars: S.bestStars, unlockTrail: !!S.unlockTrail, comboBest: S.comboBest || 0, assist: !!S.assist, unlockedDay: S.unlockedDay || 0, pickDay: S.pickDay || 0 };
}
function restoreDrakis(o) {
  if (!o || o.v !== 1) return false;
  S.totalKr = o.totalKr || 0; S.totalAir = o.totalAir || 0; S.deaths = o.deaths || 0; S.t0 = K.t;
  S.bestStars = Array.isArray(o.bestStars) ? [0, 1, 2, 3, 4].map((i) => o.bestStars[i] || 0) : [0, 0, 0, 0, 0];
  S.assist = !!o.assist; S.unlockedDay = o.unlockedDay || 0; S.pickDay = o.pickDay || o.day || 0;
  S.unlockTrail = !!o.unlockTrail; S.comboBest = o.comboBest || 0;
  if (o.scene === 'end') { S.scene = 'end'; S.endT = K.t; return true; }
  if (o.scene === 'card') { startDay(o.day || 0); S.scene = 'card'; S.cardT = K.t; S.kr = o.kr || 0; S.air = o.air || 0; return true; }
  startDay(o.day || 0);
  if (o.scene === 'intro') return true;
  S.scene = 'play';
  K.music(dagSang());
  if (o.chk) { chk = { x: o.chk.x, y: o.chk.y }; spawn(true); }
  S.hp = o.hp || 3; S.kr = o.kr || 0; S.air = o.air || 0;
  return true;
}
function freshDrakis() {
  S.totalKr = 0; S.totalAir = 0; S.deaths = 0; S.t0 = K.t; S.comboBest = 0;
  startDay(0);
}
K.kod.configure({ prefix: 'DRAK', key: 'ak.drakis-resa.referens', snapshot: snapDrakis, restore: restoreDrakis, fresh: freshDrakis });

function splittraTillgångar(alla, forsta) {
  const tidigt = {}, resten = {};
  Object.keys(alla).forEach((k) => { (forsta.includes(k) ? tidigt : resten)[k] = alla[k]; });
  return { tidigt, resten };
}

async function startaSpel() {
  await spar.init();
  try { ljud._initGraph(); await ljud.loadManifest('./ljud/bank.json'); } catch (e) { console.warn('ljudbank', e); }
  const { tidigt, resten } = splittraTillgångar(ASSETS, FORSTA_KONST);
  await K.load(tidigt);
  if (game.init) game.init();
  K.start(game);
  if (S.scene === 'title') K.music(SONG.title);
  const startaMusik = () => { K.audio(); if (S.scene === 'title' && !K.songName()) K.music(SONG.title); };
  document.addEventListener('pointerdown', startaMusik, { capture: true, once: false });

  K.load(resten).catch((e) => console.warn('sen konst', e));
  spar.watch(() => snapDrakis());
  const lagrat = await spar.load();
  if (lagrat && lagrat.v === 1) {
    try { restoreDrakis(lagrat); } catch (e) { console.warn('kunde inte återställa', e); }
  }
  const status = document.getElementById('spar-status');
  const visa = () => { if (status) status.textContent = spar.formatSparat() || ''; };
  spar.onChange(visa); visa();
  const sparaBtn = document.getElementById('knapp-spara');
  if (sparaBtn) sparaBtn.addEventListener('click', async () => { await spar.sparaManuellt(); });
  const nyttBtn = document.getElementById('knapp-nytt');
  if (nyttBtn) nyttBtn.addEventListener('click', async () => {
    const bekrafta = monteraBekraftelse({ titel: 'Börja om?', text: 'Det raderar det sparade läget i referensspelet.', okEtikett: 'Nytt', avbrytEtikett: 'Avbryt' });
    const r = await spar.nytt({ bekrafta });
    if (!r.avbrott) { freshDrakis(); }
  });
  const fortsBtn = document.getElementById('knapp-fortsatt');
  if (fortsBtn) fortsBtn.addEventListener('click', async () => {
    const o = await spar.load();
    if (o && o.v === 1) restoreDrakis(o);
  });
  const volMusik = document.getElementById('vol-musik');
  const volSfx = document.getElementById('vol-sfx');
  const volAllt = document.getElementById('vol-allt');
  if (volMusik) { volMusik.value = ljud.getVolume('music'); volMusik.addEventListener('input', () => ljud.setVolume('music', Number(volMusik.value))); }
  if (volSfx) { volSfx.value = ljud.getVolume('sfx'); volSfx.addEventListener('input', () => { ljud.setVolume('sfx', Number(volSfx.value)); ljud.setVolume('ui', Number(volSfx.value)); }); }
  if (volAllt) { volAllt.value = ljud.getVolume('master'); volAllt.addEventListener('input', () => ljud.setVolume('master', Number(volAllt.value))); }

  const hel = document.getElementById('knapp-helskarm');
  if (hel) {
    const visa = () => { hel.textContent = document.fullscreenElement ? 'Avsluta helskärm' : 'Helskärm'; };
    hel.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (e) { console.warn('helskärm', e); }
    });
    document.addEventListener('fullscreenchange', visa);
    visa();
  }
}

const hoppaStudio = new URLSearchParams(location.search).get('studiointro') === '0' || window.__SKIP_STUDIOINTRO;
if (window.StudioIntro && !hoppaStudio) {
  StudioIntro.play({
    brand: 'spel',
    partners: [],
    copyright: '© 2026 SkaparKvarnen (Skaparkvarnen, enskild firma). Alla rättigheter förbehållna.',
    onDone: function () { startaSpel(); }
  });
} else {
  startaSpel();
}

window.ReferensSpel = {
  K, ljud, spar, S, startaDag: startDay, snap: snapDrakis, restore: restoreDrakis, mataLjud: (...a) => K.mataLjud(...a)
};

