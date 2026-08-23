const CACHE='mt-v21';
const ASSETS=['./index.html','./index-v2.html','./styles-v2.css','./program-v2.js','./app-v2.js','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{if(resp&&resp.status===200&&new URL(e.request.url).origin===location.origin){const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return resp;}).catch(()=>caches.match('./index-v2.html'))));});
