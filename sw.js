/* Service worker — να δουλεύει ο οδηγός και χωρίς σήμα */
const V = 'oslo-2026-v2';
/* Σταθερό όνομα, ΑΝΕΞΑΡΤΗΤΟ από την έκδοση: αλλιώς κάθε ενημέρωση του site
   θα έσβηνε τα πλακίδια χάρτη που κατέβασε ο χρήστης για offline χρήση. */
const TILES = 'oslo-tiles';
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
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== V && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Πλακίδια χάρτη + βιβλιοθήκες CDN: cache-first, με όριο
  const isTile = /basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(url.host);
  const isCdn  = /unpkg\.com/.test(url.host);

  if (isTile || isCdn) {
    e.respondWith(
      caches.open(isTile ? TILES : V).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Δικά μας αρχεία: network-first ώστε οι ενημερώσεις να φαίνονται αμέσως
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(V).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
