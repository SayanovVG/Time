const CACHE='mt-v32';
const ASSETS=['./index.html','./index-v2.html','./styles-v2.css','./program-v2.js','./app-v2.js','./nutrition-v2.js','./fixes-v2.js','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const isCode=u.origin===location.origin && /\.(js|css|html)$/.test(u.pathname);
  if(isCode){
    e.respondWith(fetch(e.request).then(resp=>{if(resp&&resp.status===200){const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return resp;}).catch(()=>caches.match(e.request).then(x=>x||caches.match('./index-v2.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{if(resp&&resp.status===200&&u.origin===location.origin){const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return resp;}).catch(()=>caches.match('./index-v2.html'))));
});