const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message+' @'+(e.stack||'').split('\n')[1])); p.on('dialog', d=>d.accept());
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(2000);
  const r = await p.evaluate(()=>{ localStorage.clear(); const out={};
    startCompany('mgr'); G.money=9e6; for(let i=0;i<2;i++) addBus('city',G.routes[0].id,true); G.routes[0].rate=40000; G.speed=1;
    const run=(lvl)=>{ const S=JSON.parse(JSON.stringify(makeSave())); S.up.manager=lvl; S.day=Object.assign({rev:0,fuel:0,wage:0,maint:0},S.day); const rep=offlineSim(S,24*3600,offEff(S)); return {eff:rep.eff,capH:rep.capH,simH:+(rep.simSec/3600).toFixed(1),days:rep.days,net:rep.net,logN:rep.log.length}; };
    out.m0=run(0); out.m1=run(1); out.m3=run(3);
    // log variety
    const S=JSON.parse(JSON.stringify(makeSave())); S.day=Object.assign({rev:0,fuel:0,wage:0,maint:0},S.day); S.up.manager=3; const rep=offlineSim(S,12*3600,offEff(S)); out.sampleLog=rep.log.slice(0,4); out.kinds={ev:rep.log.filter(l=>/덕분에/.test(l)).length,rain:rep.log.filter(l=>/비가/.test(l)).length,acc:rep.log.filter(l=>/사고/.test(l)).length,praise:rep.log.filter(l=>/칭찬/.test(l)).length};
    // buy manager upgrade
    G.money=9e7; out.buy=[buyUpgrade('manager'),buyUpgrade('manager')]; out.lvl=G.up.manager; out.effNow=offEff(G); 
    // notes
    note('테스트 알림','good'); out.notes=G.notes.length; out.unread=G.unread;
    // live catch-up creates notes + modal text includes log
    const n0=G.notes.length; const lr=liveCatchUp(4*3600); out.liveNotes=G.notes.length-n0; out.liveCapH=lr&&lr.capH;
    UI.showMgmt(); UI.refreshTop(); out.bell=document.getElementById('tBellN').textContent; UI.notesModal(); out.notesModalText=document.getElementById('modalBox').innerText.replace(/\s+/g,' ').slice(0,150); out.unreadAfter=G.unread;
    UI.offlineModal(lr,'t'); out.offText=document.getElementById('modalBox').innerText.replace(/\s+/g,' ').slice(0,260);
    saveCompany(); const sv=loadSaved(); out.savedNotes=sv.notes.length; out.savedManager=sv.up.manager;
    return out; });
  console.log(JSON.stringify(r,null,1)); console.log(errs); await b.close();
})();
