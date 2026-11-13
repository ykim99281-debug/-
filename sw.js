// 전설의 검 강화하기 — 서비스워커 (항상 최신 화면을 받고, 인터넷이 끊기면 마지막 화면을 보여 줌)
const CACHE = "legend-sword-v14";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || r.mode !== "navigate" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || new Response(
        "<meta name=viewport content='width=device-width'><body style='background:#121216;color:#eee;font-family:sans-serif;text-align:center;padding-top:40vh'>⚔️ 인터넷 연결을 확인해 주세요</body>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } })))
  );
});
