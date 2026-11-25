const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message+' @'+(e.stack||'').split('\n')[1])); p.on('dialog', d=>d.accept());
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(2000);
  const snap = ()=>p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('bus_company_v1')); return {money:Math.round(s.money),pax:Math.round(s.pax),dayNo:s.dayNo,conds:s.buses.map(b=>Math.round(b.cond)),rep:Math.round(s.rep),reports:s.reports.length}; });
  // ---- A. prepare a company that has measured rates
  await p.evaluate(()=>{ localStorage.clear(); startCompany('off'); G.money=3e6; for(let i=0;i<2;i++) addBus('city',G.routes[0].id,true); G.routes[0].rate=40000; G.speed=1; saveCompany(); UI.showTitle(); });
  const base = await snap(); console.log('base', JSON.stringify(base));
  // ---- B. app closed for 2 hours
  await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('bus_company_v1')); s.ts=Date.now()-2*3600*1000; localStorage.setItem('bus_company_v1',JSON.stringify(s)); });
  await p.evaluate(()=>{ document.getElementById('bCont').click(); }); await p.waitForTimeout(1200);
  const after2h = await p.evaluate(()=>({modal:!document.getElementById('modal').classList.contains('hide'),text:document.getElementById('modalBox').innerText.replace(/\s+/g,' ').slice(0,230),money:Math.round(G.money),days:G.dayNo,conds:G.buses.map(b=>Math.round(b.cond)),reports:G.reports.length}));
  console.log('2h offline', JSON.stringify(after2h));
  // ---- C. 20 hours offline -> capped at 6h
  await p.evaluate(()=>{ localStorage.clear(); startCompany('cap'); G.money=3e6; addBus('city',G.routes[0].id,true); G.routes[0].rate=40000; saveCompany(); const s=JSON.parse(localStorage.getItem('bus_company_v1')); s.ts=Date.now()-20*3600*1000; localStorage.setItem('bus_company_v1',JSON.stringify(s)); });
  const cap = await p.evaluate(()=>{ const s=loadSaved(); const c=JSON.parse(JSON.stringify(s)); c.day=Object.assign({rev:0,fuel:0,wage:0,maint:0},c.day); const r=offlineSim(c,20*3600,0.6); return {simSec:r.simSec,days:r.days,net:r.net,moneyAfter:Math.round(c.money)}; });
  console.log('cap 20h ->', JSON.stringify(cap));
  // ---- D. no measured rate -> estimate
  const est = await p.evaluate(()=>{ localStorage.clear(); startCompany('est'); const s=makeSave(); s.routes.forEach(r=>{r.rate=0;r.rateN=0}); const r=offlineSim(s,3600,0.6); return {net:r.net,rev:r.rev,pax:r.pax,days:r.days}; });
  console.log('estimate (no rate) 1h', JSON.stringify(est));
  // ---- E. live catch-up after hidden tab
  const live = await p.evaluate(()=>{ localStorage.clear(); startCompany('live'); G.money=2e6; addBus('city',G.routes[0].id,true); G.routes[0].rate=30000; const m0=G.money, d0=G.dayNo; const rep=liveCatchUp(3600,0.6); return {rep:rep&&{net:rep.net,days:rep.days},money:Math.round(G.money-m0),dayNo:G.dayNo-d0,hour:+G.hour.toFixed(1)}; });
  console.log('live catch-up 1h', JSON.stringify(live));
  // ---- F. background company during free drive started from title
  await p.evaluate(()=>{ localStorage.clear(); startCompany('bg'); G.money=2e6; addBus('city',G.routes[0].id,true); G.routes[0].rate=40000; saveCompany(); UI.showTitle(); });
  const b0 = await snap();
  await p.evaluate(()=>{ document.getElementById('bFree').click(); }); await p.waitForTimeout(300);
  await p.evaluate(()=>document.getElementById('fdGo').click()); await p.waitForTimeout(1500);
  console.log('BG active', await p.evaluate(()=>!!BG && BG.rate), 'hud has company line', await p.evaluate(()=>{ for(let i=0;i<5;i++){updateWorld(.05);updatePlayer(.05);} UI.updateHUD(); return /운영 중/.test(document.getElementById('hudL').innerText); }));
  await p.evaluate(()=>{ for(let i=0;i<1600;i++){ bgUpdate(0.05); } });   // 80 s of driving
  const mid = await snap(); console.log('after 80s drive (flushed at 30s steps)', JSON.stringify({d:mid.money-b0.money,days:mid.dayNo-b0.dayNo}));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.evaluate(()=>document.getElementById('pEnd').click()); await p.waitForTimeout(800);
  const b1 = await snap(); console.log('exit', JSON.stringify({gain:b1.money-b0.money,modal:await p.evaluate(()=>document.getElementById('modalBox').innerText.replace(/\s+/g,' ').slice(0,120))}));
  console.log(errs); await b.close();
})();
