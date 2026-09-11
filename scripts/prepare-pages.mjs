import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const output = resolve('github-pages');
async function list(directory, prefix = '') {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + item.name;
    if (item.isDirectory()) files.push(...await list(join(directory, item.name), name + '/'));
    else files.push(name);
  }
  return files;
}
await writeFile(join(output, '.nojekyll'), '');
await writeFile(join(output, 'manifest.webmanifest'), JSON.stringify({
  id: './', name: 'Ритм — трекер привычек', short_name: 'Ритм', lang: 'ru', start_url: './', scope: './',
  display: 'standalone', background_color: '#111416', theme_color: '#111416',
  icons: [{ src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
}, null, 2));
const files = (await list(output)).filter(file => !['sw.js', '.nojekyll'].includes(file));
const digest = createHash('sha256');
for (const file of files) { digest.update(file); digest.update(await readFile(join(output, file))); }
const version = digest.digest('hex').slice(0, 14);
await writeFile(join(output, 'sw.js'), `/* Ритм: only this application's cache is managed. */
const PREFIX = 'ritm-habits-offline-';
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
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => response.ok ? response : caches.match(new URL('index.html', BASE).href).then(cached => cached || response)).catch(() => caches.match(new URL('index.html', BASE).href)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(cached => cached || fetch(request)));
});
`);
const html = await readFile(join(output, 'index.html'), 'utf8');
if (!html.includes('Ритм') || html.includes('chatgpt.site')) throw new Error('Unexpected Pages document');
console.log(`GitHub Pages bundle ready: ${files.length + 2} files, offline version ${version}`);
