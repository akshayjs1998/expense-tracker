/* Daybook service worker — offline support
   Bump VERSION whenever you want to force a fresh cache after deploying. */
const VERSION = 'daybook-v1';
const SHELL   = 'shell-'   + VERSION;
const RUNTIME = 'runtime-' + VERSION;

// Files that make up the app itself. These are precached at install so the
// app can open with no network at all.
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first: serve from cache if present, otherwise fetch and cache it.
function cacheFirst(request) {
  return caches.match(request).then((hit) => {
    if (hit) return hit;
    return fetch(request).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(RUNTIME).then((c) => c.put(request, copy));
      }
      return res;
    });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isFirebaseSDK =
    url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/');

  // Anything that isn't our own origin or the Firebase SDK — e.g. Firestore
  // and Auth network calls — is left to go straight to the network. Firestore's
  // own offline cache (already enabled in the app) handles those when offline.
  if (!isFirebaseSDK && url.origin !== self.location.origin) return;

  // Page loads/refreshes: try the network first so a redeploy is picked up when
  // online, and fall back to the cached page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // App shell files + the Firebase SDK modules: cache-first.
  event.respondWith(cacheFirst(req));
});
