// PWA 점검: 정적 서버로 서비스 워커 설치 → 오프라인 재실행 → 업데이트 알림
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), types = { html: 'text/html', js: 'text/javascript', json: 'application/json', png: 'image/png', webmanifest: 'application/manifest+json' };
let remoteVer = null;
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/version.json' && remoteVer) { const j = JSON.parse(fs.readFileSync(path.join(root, 'version.json'))); j.version = remoteVer; s.setHeader('content-type', 'application/json'); return s.end(JSON.stringify(j)); }
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { s.statusCode = 404; return s.end(); }
  s.setHeader('content-type', types[f.split('.').pop()] || 'application/octet-stream'); s.end(fs.readFileSync(f));
});
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(), ctx = await b.newContext(), pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url); await pg.waitForFunction(() => typeof THREE !== 'undefined' && typeof Updater !== 'undefined');
  ok(await pg.evaluate(() => THREE.REVISION) === '128', 'local three.js r128 loaded');
  ok(await pg.evaluate(() => $('verTxt').textContent) === 'v' + require('../version.json').version, 'version shown on title');
  await pg.evaluate(() => navigator.serviceWorker.ready); await pg.waitForTimeout(800);
  ok(await pg.evaluate(async () => (await caches.keys()).some(k => k.startsWith('bus-tycoon-'))), 'service worker cache created');
  await pg.reload(); await pg.waitForTimeout(500);
  await ctx.setOffline(true); await pg.reload(); await pg.waitForFunction(() => typeof THREE !== 'undefined' && typeof Updater !== 'undefined', null, { timeout: 8000 }).catch(() => { });
  ok(await pg.evaluate(() => typeof THREE !== 'undefined' && !!document.getElementById('bNew')), 'offline reload works from cache');
  await ctx.setOffline(false);
  remoteVer = '99.0.0'; await pg.evaluate(() => Updater.check(false)); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => { const e = document.getElementById('updBar'); return !!e && !e.classList.contains('hide') && e.textContent.includes('99.0.0'); }), 'update banner shows for newer version');
  remoteVer = null;
  ok(errs.length === 0, 'no page errors ' + errs.join('|')); await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
