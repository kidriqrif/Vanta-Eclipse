/*
 * Service worker for the installable WEB build only (src/main.tsx never registers it inside
 * the Android app, and unregisters any leftover registration there).
 *
 * Network first, cache as the offline fallback: an online player always gets the newest build,
 * and an offline player gets the last one they loaded. Hashed /assets/ files are immutable, so
 * they are served from cache when present.
 */
const CACHE_NAME = 'vanta-eclipse-v2';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheCopy(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (new URL(request.url).pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => cacheCopy(request, res))),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => cacheCopy(request, res))
      .catch(() =>
        caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match('/index.html') : undefined)).then(
          (res) => res || new Response('Offline', { status: 503, statusText: 'Offline' }),
        ),
      ),
  );
});
