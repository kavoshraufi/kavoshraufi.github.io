/** Sekvenserad chiptune för Drakis resa. 24 takter (A–B–A), inte slumptoner. */
const rest = (n) => Array(n).fill('-').join(' ');
const dots = (n) => Array(n).fill('.').join(' ');

function takter(...bars) {
  return bars.join(' ');
}

// Varje taktsvärde är 16 sextondelar.
const PARK_A = [
  'C5 . E5 . G5 . E5 . F5 . A5 . G5 .',
  'E5 . G5 . C6 . B5 . A5 . G5 . F5 .',
  'E5 . D5 . C5 . E5 . G5 . A5 . G5 .',
  'E5 . D5 . E5 . C5 . - - - - . . . .',
  'C5 . E5 . G5 . E5 . F5 . A5 . G5 .',
  'A5 . B5 . C6 . G5 . A5 . F5 . E5 .',
  'D5 . F5 . A5 . G5 . E5 . C5 . D5 .',
  'E5 . . . C5 . . . - - . . . . . .',
];
const PARK_B = [
  'A5 . . C6 . . E6 . D6 . C6 . B5 .',
  'A5 . G5 . F5 . A5 . G5 . . . E5 .',
  'F5 . A5 . C6 . A5 . Bb5 . A5 . G5 .',
  'F5 . . . E5 . D5 . C5 . . . . .',
  'G5 . B5 . D6 . B5 . C6 . B5 . A5 .',
  'G5 . F5 . E5 . G5 . D5 . . . G5 .',
  'C6 . B5 . A5 . G5 . F5 . E5 . D5 .',
  'C5 . E5 . G5 . . . C5 . . . . . .',
];

const ROOF_A = [
  'F5 . . A5 . . C6 . A#5 . A5 . G5 .',
  'F5 . G5 . . A#5 . . D6 . C6 . A#5 .',
  'A5 . G5 . A5 . . C6 . . F6 . E6 .',
  'D6 . C6 . A#5 . A5 . G5 . F5 . . .',
  'F5 . A5 . C6 . F6 . E6 . D6 . C6 .',
  'A#5 . D6 . F6 . D6 . C6 . A#5 . A5 .',
  'G5 . A#5 . D6 . C6 . A5 . F5 . G5 .',
  'A5 . . . F5 . . . - - . . . . . .',
];
const ROOF_B = [
  'D6 . . F6 . . A6 . G6 . F6 . E6 .',
  'D6 . C6 . A#5 . D6 . C6 . . . A5 .',
  'Bb5 . D6 . F6 . D6 . Eb6 . D6 . C6 .',
  'Bb5 . . . A5 . G5 . F5 . . . . .',
  'C6 . E6 . G6 . E6 . F6 . E6 . D6 .',
  'C6 . Bb5 . A5 . C6 . G5 . . . C6 .',
  'F6 . E6 . D6 . C6 . Bb5 . A5 . G5 .',
  'F5 . A5 . C6 . . . F5 . . . . . .',
];

const MOUNT_A = [
  'G4 . B4 . D5 . G5 . . . F#5 . E5 .',
  'D5 . . . B4 . C5 . D5 . E5 . . .',
  'D5 . C5 . B4 . A4 . . . B4 . G4 .',
  'A4 . F#4 . G4 . . . . . . . . .',
  'G4 . B4 . D5 . G5 . A5 . G5 . F#5 .',
  'E5 . D5 . C5 . B4 . A4 . G4 . A4 .',
  'B4 . D5 . G5 . F#5 . E5 . D5 . C5 .',
  'B4 . . . G4 . . . - - . . . . . .',
];
const MOUNT_B = [
  'E5 . G5 . B5 . E6 . D6 . C6 . B5 .',
  'A5 . G5 . F#5 . A5 . G5 . . . D5 .',
  'C5 . E5 . G5 . E5 . F#5 . E5 . D5 .',
  'C5 . . . B4 . A4 . G4 . . . . .',
  'D5 . F#5 . A5 . F#5 . G5 . F#5 . E5 .',
  'D5 . C5 . B4 . D5 . A4 . . . D5 .',
  'G5 . F#5 . E5 . D5 . C5 . B4 . A4 .',
  'G4 . B4 . D5 . . . G4 . . . . . .',
];

const BOSS_A = [
  'D5 . D5 . A5 . . . G5 . F#5 . E5 .',
  'D5 . E5 . E5 . B5 . . . A5 . G5 .',
  'F#5 . E5 . F#5 . A5 . D6 . . . C#6 .',
  'B5 . A5 . G5 . F#5 . E5 . D5 . . .',
  'D5 . F#5 . A5 . D6 . C#6 . B5 . A5 .',
  'G5 . B5 . D6 . B5 . A5 . F#5 . E5 .',
  'F#5 . A5 . D6 . C#6 . B5 . A5 . G5 .',
  'F#5 . . . D5 . . . - - D5 . . . .',
];
const BOSS_B = [
  'F5 . F5 . C6 . . . A#5 . A5 . G5 .',
  'F5 . G5 . G5 . D6 . . . C6 . A#5 .',
  'A5 . G5 . A5 . C6 . F6 . . . E6 .',
  'D6 . C6 . A#5 . A5 . G5 . F5 . . .',
  'E5 . G#5 . B5 . E6 . D6 . C6 . B5 .',
  'A5 . C6 . E6 . C6 . B5 . G#5 . E5 .',
  'A5 . G5 . F#5 . E5 . D5 . C#5 . B4 .',
  'A4 . . . D5 . . . A4 . D5 . . . .',
];

const WIN = [
  'C5 . E5 . G5 . C6 . . . . . G5 . C6 . E6 .',
  'D6 . C6 . . . G5 . E5 . C5 . . . . . . .',
  'F5 . A5 . C6 . F6 . . . E6 . D6 . C6 . A5 .',
  'G5 . C6 . E6 . G6 . . . E6 . C6 . G5 . . .',
  'C5 . E5 . G5 . C6 . . . . . G5 . C6 . E6 .',
  'D6 . C6 . . . . . . . . . . . . . .',
];

function basPark() {
  return takter(
    'C3 . G2 . C3 . G2 . F2 . C3 . F2 . C3 .',
    'A2 . E3 . F2 . C3 . G2 . D3 . G2 . B2 .',
    'C3 . G2 . C3 . G2 . F2 . C3 . F2 . C3 .',
    'A2 . E3 . G2 . D3 . C3 . G2 . C3 . . .',
    'F2 . C3 . F2 . C3 . G2 . D3 . C3 . G2 .',
    'A2 . E3 . F2 . C3 . D3 . A2 . G2 . D3 .',
    'C3 . G2 . A2 . E3 . F2 . C3 . G2 . D3 .',
    'C3 . . . G2 . . . C3 . . . . . . .',
  );
}
function basRoof() {
  return takter(
    'F2 . C3 . F2 . C3 . G2 . D3 . C3 . G2 .',
    'D2 . A2 . A#2 . F2 . C3 . G2 . C3 . E2 .',
    'F2 . C3 . F2 . C3 . G2 . D3 . C3 . G2 .',
    'Bb2 . F3 . C3 . G2 . F2 . C3 . F2 . . .',
    'Bb2 . F3 . Bb2 . F3 . C3 . G3 . F3 . C3 .',
    'G2 . D3 . C3 . G2 . D2 . A2 . C3 . G2 .',
    'F2 . C3 . D3 . A2 . Bb2 . F3 . C3 . G2 .',
    'F2 . . . C3 . . . F2 . . . . . . .',
  );
}
function basMount() {
  return takter(
    'G2 . . . D3 . . . C3 . . . G2 . . .',
    'E2 . . . C3 . . . D3 . . . D2 . . .',
    'G2 . . . D3 . . . C3 . . . G2 . . .',
    'E2 . . . C3 . . . D3 . . . G2 . . .',
    'C3 . . . G3 . . . D3 . . . A2 . . .',
    'E2 . . . B2 . . . D3 . . . A2 . . .',
    'G2 . . . D3 . . . C3 . . . D3 . . .',
    'G2 . . . D3 . . . G2 . . . . . . .',
  );
}
function basBoss() {
  return takter(
    'D2 D3 D2 D3 D2 D3 D2 D3 E2 E3 E2 E3 E2 E3 E2 E3',
    'F#2 F#3 F#2 F#3 F#2 F#3 F#2 F#3 A2 A3 A2 A3 A2 A3 A2 A3',
    'D2 D3 D2 D3 D2 D3 D2 D3 E2 E3 E2 E3 E2 E3 E2 E3',
    'F#2 F#3 F#2 F#3 A2 A3 A2 A3 D2 D3 D2 D3 D2 . D2 .',
    'F2 F3 F2 F3 F2 F3 F2 F3 G2 G3 G2 G3 G2 G3 G2 G3',
    'A2 A3 A2 A3 A2 A3 A2 A3 E2 E3 E2 E3 E2 E3 E2 E3',
    'D2 D3 D2 D3 C2 C3 C2 C3 B1 B2 B1 B2 A1 A2 A1 A2',
    'D2 D3 D2 D3 A1 A2 A1 A2 D2 . D3 . D2 . . .',
  );
}

function ackPark() {
  return 'E4 G4 E4 G4 F4 A4 F4 A4 E4 G4 E4 G4 D4 G4 D4 G4 '.repeat(4)
    + 'A4 C5 A4 C5 G4 B4 G4 B4 F4 A4 F4 A4 E4 G4 E4 G4 '.repeat(2)
    + 'E4 G4 E4 G4 F4 A4 F4 A4 E4 G4 E4 G4 D4 G4 C4 E4 '.repeat(2);
}
function ackRoof() {
  return 'A4 C5 A4 C5 Bb4 D5 Bb4 D5 A4 C5 A4 C5 G4 C5 G4 C5 '.repeat(4)
    + 'D5 F5 D5 F5 C5 E5 C5 E5 Bb4 D5 Bb4 D5 A4 C5 A4 C5 '.repeat(2)
    + 'A4 C5 A4 C5 Bb4 D5 Bb4 D5 A4 C5 A4 C5 G4 C5 F4 A4 '.repeat(2);
}
function ackMount() {
  return 'D5 - B4 - D5 - B4 - E5 - C5 - E5 - C5 - D5 - B4 - D5 - B4 - D5 - A4 - D5 - F#4 - '.repeat(2)
    + 'E5 - C5 - E5 - C5 - F#5 - D5 - F#5 - D5 - E5 - C5 - E5 - C5 - D5 - B4 - D5 - A4 - '.repeat(2);
}

function form(a, b) {
  return takter(...a, ...b, ...a);
}

export const SONG = {
  park: {
    name: 'park', bpm: 132,
    tracks: [
      { w: 'p25', v: 0.055, n: form(PARK_A, PARK_B), vib: true },
      { w: 'p12', v: 0.028, n: ackPark() },
      { w: 'triangle', v: 0.14, n: basPark() + ' ' + basPark() + ' ' + basPark() },
    ],
    drums: ('k - h - s - h - k - h k s - h - ').repeat(24).trim(),
  },
  roof: {
    name: 'roof', bpm: 140,
    tracks: [
      { w: 'p25', v: 0.055, n: form(ROOF_A, ROOF_B), vib: true },
      { w: 'p12', v: 0.028, n: ackRoof() },
      { w: 'triangle', v: 0.14, n: basRoof() + ' ' + basRoof() + ' ' + basRoof() },
    ],
    drums: ('k - h h s - h - k h - h s - h h ').repeat(24).trim(),
  },
  mount: {
    name: 'mount', bpm: 120,
    tracks: [
      { w: 'p25', v: 0.055, n: form(MOUNT_A, MOUNT_B), vib: true },
      { w: 'p12', v: 0.028, n: ackMount() },
      { w: 'triangle', v: 0.14, n: basMount() + ' ' + basMount() + ' ' + basMount() },
    ],
    drums: ('k - - - s - - - k - k - s - h h ').repeat(24).trim(),
  },
  boss: {
    name: 'boss', bpm: 156,
    tracks: [
      { w: 'p25', v: 0.058, n: form(BOSS_A, BOSS_B), vib: true },
      { w: 'p12', v: 0.032, n: 'D4 F#4 A4 F#4 D4 F#4 A4 F#4 E4 G4 B4 G4 E4 G4 B4 G4 F#4 A4 D5 A4 F#4 A4 D5 A4 E4 A4 C#5 A4 E4 A4 C#5 A4 '.repeat(6) },
      { w: 'triangle', v: 0.15, n: basBoss() + ' ' + basBoss() + ' ' + basBoss().split(' ').slice(0, 128).join(' ') },
    ],
    drums: ('k - h - s - h k k - h - s - h s ').repeat(24).trim(),
  },
  win: {
    name: 'win', bpm: 112,
    tracks: [
      { w: 'p25', v: 0.06, n: takter(...WIN, ...WIN), vib: true },
      { w: 'triangle', v: 0.14, n: 'C3 . . . G2 . . . C3 . . . . . . . F2 . . . G2 . . . C3 . . . . . . . '.repeat(6) },
    ],
    drums: ('k - - h s - - h ').repeat(12).trim(),
  },
  title: {
    name: 'title', bpm: 118,
    tracks: [
      { w: 'p25', v: 0.05, n: form(PARK_A, PARK_B), vib: true },
      { w: 'triangle', v: 0.12, n: basPark() + ' ' + basPark() + ' ' + basPark() },
    ],
    drums: ('k - - h - - s - ').repeat(24).trim(),
  },
};

// Räkna takter (16 sextondelar) för loggen.
export function songBars(s) {
  const n = Math.max(...s.tracks.map((t) => t.n.trim().split(/\s+/).length), s.drums ? s.drums.trim().split(/\s+/).length : 0);
  return n / 16;
}
