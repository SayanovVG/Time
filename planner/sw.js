/* День: this cache contains public application files only. */
const PREFIX = 'den-planner-offline-';
const CACHE = PREFIX + '9195f577004969';
const BASE = new URL('./', self.location.href);
const FILES = ["assets/index-CmPEItEd.js","assets/index-Cn-jT6_w.css","favicon.svg","fonts/OFL.txt","fonts/manrope-cyrillic-wght-normal.woff2","fonts/manrope-latin-wght-normal.woff2","index.html","manifest.webmanifest","sync-config.json"].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (url.href === new URL('sync-config.json', BASE).href || request.mode === 'navigate') {
    const fallback = request.mode === 'navigate' ? new URL('index.html', BASE).href : request.url;
    event.respondWith(caches.open(CACHE).then(async cache => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
        return await cache.match(fallback) || response;
      } catch {
        return await cache.match(fallback) || Response.error();
      }
    }));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(cached => cached || fetch(request)));
});
