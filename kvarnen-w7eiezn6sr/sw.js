/* Kvarnen (test) — versionerad cache under GitHub Pages-undermappen. */
const VERSION = 'kvarnen-test-pages-v1';
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./stil.css",
  "./hylla.css",
  "./hem-overlay.css",
  "./favicon.svg",
  "./titlar/drakis-resa/",
  "./titlar/drakis-resa/index.html",
  "./titlar/drakis-resa/drakis-resa.html",
  "./titlar/rostam-och-sohrab/",
  "./titlar/rostam-och-sohrab/index.html",
  "./titlar/rostam-och-sohrab/rostam-och-sohrab-bok2.html",
  "./titlar/det-gyllene-manuskriptet/",
  "./titlar/det-gyllene-manuskriptet/index.html",
  "./titlar/det-gyllene-manuskriptet/det-gyllene-manuskriptet-bok2.html"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
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
