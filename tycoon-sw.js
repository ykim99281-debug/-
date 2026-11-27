// 라떼 하우스 타이쿤 — 서비스워커: 항상 최신을 받고, 오프라인이면 마지막으로 받은 버전을 보여 줌
const CACHE = "latte-house-v1";
const FILES = ["tycoon-main.html", "tycoon3d.html", "tycoon-updates.json", "tycoon-cover.jpg"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))); });
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith("latte-house")).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin || !u.pathname.includes("tycoon")) return;
  e.respondWith(
    fetch(r, { cache: "no-store" }).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }))
  );
});
