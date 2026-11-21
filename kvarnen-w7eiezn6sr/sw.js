/* Kvarnen (test) — versionerad cache under GitHub Pages-undermappen. */
importScripts('./version.js');
const VERSION = KVARNEN_CACHE;
const KVARNEN_SW_STAMP = '1.6'; // spegling av KVARNEN_APP_VERSION; ändra i version.js
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./stil.css",
  "./hylla.css",
  "./hem-overlay.css",
  "./favicon.svg",
  "./sw-register.js",
  "./version.js",
  "./titlar/drakis-resa/",
  "./titlar/drakis-resa/spel/",
  "./titlar/rostam-och-sohrab/",
  "./titlar/rostam-och-sohrab/bok/",
  "./titlar/det-gyllene-manuskriptet/",
  "./titlar/nila-norin/",
  "./titlar/nila-norin/spel/",
  "./titlar/bokvarianter/",
  "./titlar/bokvarianter/variant-a/",
  "./titlar/bokvarianter/variant-b/",
  "./titlar/bokvarianter/variant-c/",
  "./sw.js",
  "./titlar/bokvarianter/LAS-MIG.md",
  "./titlar/bokvarianter/delat/boksidor.js",
  "./titlar/bokvarianter/delat/ljudmotor.js",
  "./titlar/bokvarianter/delat/palett.css",
  "./titlar/bokvarianter/delat/partiklar.js",
  "./titlar/bokvarianter/delat/sidvandning.js",
  "./titlar/bokvarianter/delat/skarmovergangar.js",
  "./titlar/bokvarianter/delat/spar.js",
  "./titlar/bokvarianter/delat/stil.css",
  "./titlar/bokvarianter/delat/typsnitt/OFL-CormorantGaramond.txt",
  "./titlar/bokvarianter/delat/typsnitt/OFL-NotoNastaliqUrdu.txt",
  "./titlar/bokvarianter/delat/typsnitt/TYPSNITT.md",
  "./titlar/bokvarianter/index.html",
  "./titlar/bokvarianter/innehall/natt1.js",
  "./titlar/bokvarianter/lasare.js",
  "./titlar/bokvarianter/typografi.css",
  "./titlar/bokvarianter/variant-a/index.html",
  "./titlar/bokvarianter/variant-a/stil.css",
  "./titlar/bokvarianter/variant-b/index.html",
  "./titlar/bokvarianter/variant-b/stil.css",
  "./titlar/bokvarianter/variant-c/index.html",
  "./titlar/bokvarianter/variant-c/stil.css",
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
  "./titlar/nila-norin/index.html",
  "./titlar/nila-norin/spel/FIGURER.md",
  "./titlar/nila-norin/spel/css/spel.css",
  "./titlar/nila-norin/spel/delat/ljudmotor.js",
  "./titlar/nila-norin/spel/delat/partiklar.js",
  "./titlar/nila-norin/spel/delat/skarmovergangar.js",
  "./titlar/nila-norin/spel/delat/spar.js",
  "./titlar/nila-norin/spel/delat/stil.css",
  "./titlar/nila-norin/spel/favicon.svg",
  "./titlar/nila-norin/spel/index.html",
  "./titlar/nila-norin/spel/js/spel.js",
  "./titlar/nila-norin/spel/ljud/bank.json",
  "./titlar/nila-norin/spel/studio/studiointro.js",
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

function berättaVersion(klienter) {
  klienter.forEach((c) => c.postMessage({ typ: 'NY_VERSION', nummer: KVARNEN_APP_VERSION }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE))
      .then(() => self.clients.matchAll({ includeUncontrolled: true }))
      .then((klienter) => { berättaVersion(klienter); })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
    berättaVersion(await self.clients.matchAll());
  })());
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.typ === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.typ === 'VERSION?') {
    const svar = { typ: 'VERSION', nummer: KVARNEN_APP_VERSION };
    if (event.ports && event.ports[0]) event.ports[0].postMessage(svar);
    else if (event.source) event.source.postMessage(svar);
  }
});

function arHtml(request, url) {
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  const path = url.pathname;
  return path.endsWith('.html') || path.endsWith('/');
}

async function natverkForst(request, cache) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request, { ignoreSearch: true });
  const natverk = fetch(request).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => undefined);
  if (cached) {
    return cached;
  }
  const response = await natverk;
  if (response) return response;
  throw new Error('Nätverk och cache misslyckades');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (arHtml(event.request, url)) {
      return natverkForst(event.request, cache);
    }
    return staleWhileRevalidate(event.request, cache);
  })());
});
