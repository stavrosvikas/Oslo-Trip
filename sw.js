/* Service worker — η εφαρμογή και ο χάρτης δουλεύουν χωρίς σήμα */
const V = 'oslo-v3';
const TILES = 'oslo-tiles';        // σταθερό όνομα: οι ενημερώσεις δεν σβήνουν τα πλακίδια
const CORE = [
  './', './index.html',
  './assets/css/style.css',
  './assets/js/data.js', './assets/js/store.js',
  './assets/js/map.js',  './assets/js/app.js',
  './manifest.webmanifest',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V)
    .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== V && x !== TILES).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const tile = /basemaps\.cartocdn\.com/.test(url.host);
  const cdn  = /unpkg\.com/.test(url.host);

  if (tile || cdn) {
    e.respondWith(caches.open(tile ? TILES : V).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  e.respondWith(fetch(req)
    .then(res => {
      const copy = res.clone();
      caches.open(V).then(c => c.put(req, copy)).catch(() => {});
      return res;
    })
    .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
