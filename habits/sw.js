/* Ритм: only this application's cache is managed. */
const PREFIX = 'ritm-habits-offline-';
const CACHE = PREFIX + '9705d6c69e8857';
const BASE = new URL('./', self.location.href);
const FILES = ["assets/index-CS9v2raz.js","assets/index-DJidHkdc.css","favicon.svg","fonts/OFL.txt","fonts/manrope-cyrillic-wght-normal.woff2","fonts/manrope-latin-wght-normal.woff2","index.html","manifest.webmanifest"].map(path => new URL(path, BASE).href);
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
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => response.ok ? response : caches.match(new URL('index.html', BASE).href).then(cached => cached || response)).catch(() => caches.match(new URL('index.html', BASE).href)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(cached => cached || fetch(request)));
});
