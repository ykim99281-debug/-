// 성좌 크로니클 — 서비스워커: 항상 최신 화면을 받고, 인터넷이 끊기면 안내 화면을 보여 줘요.
const CACHE = "seongjwa-v1";
const OFFLINE = "rpg-offline.html";
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.add(OFFLINE)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("seongjwa-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || r.mode !== "navigate" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).catch(() => caches.match(OFFLINE)));
});
