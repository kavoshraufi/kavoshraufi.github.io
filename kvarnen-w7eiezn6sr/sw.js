/* Kvarnen (test) — versionerad cache under GitHub Pages-undermappen. */
const VERSION = 'kvarnen-test-pages-v3';
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./stil.css",
  "./hylla.css",
  "./hem-overlay.css",
  "./favicon.svg",
  "./titlar/drakis-resa/",
  "./titlar/drakis-resa/spel/",
  "./titlar/rostam-och-sohrab/",
  "./titlar/rostam-och-sohrab/bok/",
  "./titlar/det-gyllene-manuskriptet/",
  "./sw.js",
  "./titlar/det-gyllene-manuskriptet/det-gyllene-manuskriptet-bok2.html",
  "./titlar/det-gyllene-manuskriptet/index.html",
  "./titlar/drakis-resa/index.html",
  "./titlar/drakis-resa/spel/css/spel.css",
  "./titlar/drakis-resa/spel/delat/ljudmotor.js",
  "./titlar/drakis-resa/spel/delat/palett-endesga.css",
  "./titlar/drakis-resa/spel/delat/palett.css",
  "./titlar/drakis-resa/spel/delat/spar.js",
  "./titlar/drakis-resa/spel/delat/stil.css",
  "./titlar/drakis-resa/spel/delat/typsnitt/OFL-CormorantGaramond.txt",
  "./titlar/drakis-resa/spel/favicon.svg",
  "./titlar/drakis-resa/spel/index.html",
  "./titlar/drakis-resa/spel/js/assets.js",
  "./titlar/drakis-resa/spel/js/motor.js",
  "./titlar/drakis-resa/spel/js/musik.js",
  "./titlar/drakis-resa/spel/js/spel.js",
  "./titlar/drakis-resa/spel/ljud/bank.json",
  "./titlar/drakis-resa/spel/studio/studiointro.js",
  "./titlar/rostam-och-sohrab/bok/bok.bundle.js",
  "./titlar/rostam-och-sohrab/bok/css/bok.css",
  "./titlar/rostam-och-sohrab/bok/delat/ljud/bank.json",
  "./titlar/rostam-och-sohrab/bok/delat/palett.css",
  "./titlar/rostam-och-sohrab/bok/delat/stil.css",
  "./titlar/rostam-och-sohrab/bok/delat/typsnitt/OFL-CormorantGaramond.txt",
  "./titlar/rostam-och-sohrab/bok/delat/typsnitt/OFL-NotoNastaliqUrdu.txt",
  "./titlar/rostam-och-sohrab/bok/delat/typsnitt/TYPSNITT.md",
  "./titlar/rostam-och-sohrab/bok/favicon.svg",
  "./titlar/rostam-och-sohrab/bok/index.html",
  "./titlar/rostam-och-sohrab/bok/konst-data.js",
  "./titlar/rostam-och-sohrab/bok/studio/studiointro.js",
  "./titlar/rostam-och-sohrab/index.html"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.typ === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (err) {
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
