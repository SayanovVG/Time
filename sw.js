const CACHE = "max-time-v3-20260909-1";
const ASSETS = [
  "./",
  "./index.html",
  "./index-v2.html",
  "./app/main.mjs",
  "./app/model.mjs",
  "./app/store.mjs",
  "./app/program.mjs",
  "./app/nutrition.mjs",
  "./app/timer.mjs",
  "./app/audio.mjs",
  "./app/audio/original-gong.mp3",
  "./app/view.mjs",
  "./app/app.css",
  "./app/refinement.css",
  "./app/fonts/manrope-latin-wght-normal.woff2",
  "./app/fonts/manrope-cyrillic-wght-normal.woff2",
  "./manifest.json",
  "./icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
const OWN_CACHE = (name) =>
  name.startsWith("max-time-") || /^mt-v\d+$/.test(name);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && OWN_CACHE(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url),
    scope = new URL(self.registration.scope);
  if (
    event.request.method !== "GET" ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname) ||
    url.pathname.startsWith(scope.pathname + "dva-kota/")
  )
    return;
  // One installed version per cache: HTML and native modules update together.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch (error) {
        if (
          event.request.mode === "navigate" &&
          [
            scope.pathname,
            scope.pathname + "index.html",
            scope.pathname + "index-v2.html",
          ].includes(url.pathname)
        )
          return cache.match("./index.html");
        throw error;
      }
    }),
  );
});
