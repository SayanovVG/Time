import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const output = resolve('planner-dist');
async function list(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + item.name;
    result.push(...(item.isDirectory() ? await list(join(directory, item.name), name + '/') : [name]));
  }
  return result;
}
await writeFile(join(output, '.nojekyll'), '');
await writeFile(join(output, 'manifest.webmanifest'), JSON.stringify({
  id: './', name: 'День — ежедневник', short_name: 'День', lang: 'ru', start_url: './', scope: './',
  display: 'standalone', background_color: '#13151c', theme_color: '#13151c',
  icons: [{ src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
}, null, 2));
const files = (await list(output)).filter(file => !['sw.js', '.nojekyll'].includes(file));
const digest = createHash('sha256');
for (const file of files) { digest.update(file); digest.update(await readFile(join(output, file))); }
const version = digest.digest('hex').slice(0, 14);
await writeFile(join(output, 'sw.js'), `/* День: this cache contains public application files only. */
const PREFIX = 'den-planner-offline-';
const CACHE = PREFIX + '${version}';
const BASE = new URL('./', self.location.href);
const FILES = ${JSON.stringify(files)}.map(path => new URL(path, BASE).href);
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
`);
const html = await readFile(join(output, 'index.html'), 'utf8');
const config = JSON.parse(await readFile(join(output, 'sync-config.json'), 'utf8'));
if (!html.includes('День') || html.includes('chatgpt.site')) throw new Error('Unexpected planner document');
if (!config.enabled || !config.publishableKey?.startsWith('sb_publishable_')) throw new Error('Planner requires its public cloud configuration');
console.log(`Planner bundle ready: ${files.length + 2} files, offline version ${version}`);
