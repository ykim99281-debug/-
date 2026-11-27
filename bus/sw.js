'use strict';
// 서비스 워커: 오프라인 실행 + 빠른 업데이트 (코드는 네트워크 우선, 라이브러리·아이콘은 캐시 우선)
const VERSION = '1.0.0';
const CACHE = 'bus-tycoon-' + VERSION;
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'version.json', 'vendor/three.min.js',
  'js/version.js', 'js/core.js', 'js/world.js', 'js/vehicles.js', 'js/game.js', 'js/player.js', 'js/ui.js', 'js/updater.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bus-tycoon-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

async function networkFirst(req, timeoutMs) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(new Request(req, { cache: 'no-cache' })), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true }); if (hit) return hit;
    if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
    throw err;
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE), hit = await cache.match(req, { ignoreSearch: true }); if (hit) return hit;
  const res = await fetch(req); if (res && res.ok) cache.put(req, res.clone()); return res;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.endsWith('/version.json')) e.respondWith(networkFirst(new Request(req.url.split('?')[0]), 2500));
  else if (p.includes('/vendor/') || p.includes('/icons/')) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req, 3500));
});
