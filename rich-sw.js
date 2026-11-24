// 꼬마 투자왕 RPG — 서비스워커: 한 번 열면 오프라인에서도 실행, 온라인이면 조용히 최신본으로 갱신
const CACHE = "richrpg-v1";
const FILES = ["rich-rpg.html", "rich-manifest.webmanifest", "rich-icon-192.png", "rich-icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("richrpg-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  const mine = FILES.some(f => u.pathname.endsWith("/" + f));
  if (!mine) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
