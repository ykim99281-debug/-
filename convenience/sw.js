// 편의점 사장 키우기 — 서비스워커: 게임 화면을 캐시해 오프라인에서도 실행돼요.
const CACHE = "cvs-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "cvs-icon-192.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("cvs-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  if (!(new URL(r.url).pathname.endsWith("/") || FILES.some(f => r.url.includes(f)))) return;
  e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); return res; }).catch(() => caches.match(r)));
});
