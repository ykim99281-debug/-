const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' @' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(1500);
  await p.evaluate(()=>localStorage.clear());
  const r = await p.evaluate(()=>{
    const out={}; const t0=performance.now();
    startCompany('sim'); G.money=50e6; G.pax=5000;
    for(let k=0;k<3;k++){ const ids=[]; while(ids.length<5){ const i=Math.floor(Math.random()*STOPS.length); if(!ids.includes(i)) ids.push(i);} const rt=addRoute('r'+k,ROUTE_COLORS[k],ids,true); for(let q=0;q<3;q++) addBus(['city','mini','dd'][q],rt.id,true); }
    out.buses=G.buses.length; out.agents0=agents.length;
    const stuck=new Map(), maxStuck={bus:0,car:0}; let nan=0, steps=0, stuckBus=null, stuckCar=null;
    const STEPS=20000, DT=0.1;
    for(let i=0;i<STEPS;i++){
      updateWorld(DT); steps++;
      if(i%10===0) for(const a of agents){
        if(!isFinite(a.x)||!isFinite(a.z)||!isFinite(a.v)||!isFinite(a.s)){ nan++; continue; }
        const ownerBus=G.buses.find(x=>x.agent===a);
        const dwell= ownerBus && (ownerBus.phase!=='run'||ownerBus.hold2);
        const k=a; if(a.v<0.05 && !dwell){ stuck.set(k,(stuck.get(k)||0)+1.0); } else stuck.set(k,0);
        const sv=stuck.get(k); const kind=a.kind; if(sv>maxStuck[kind]){ maxStuck[kind]=sv; if(kind==='bus') stuckBus={x:a.x|0,z:a.z|0,s:a.s|0}; else stuckCar={x:a.x|0,z:a.z|0}; }
      }
    }
    out.simSeconds=STEPS*DT; out.nan=nan; out.maxStuckSec={bus:maxStuck.bus,car:maxStuck.car}; out.stuckBus=stuckBus; out.stuckCar=stuckCar;
    out.income=G.buses.map(b=>Math.round(b.income)); out.pax=G.pax; out.money=Math.round(G.money); out.agents1=agents.length;
    out.carsMoving=cars.filter(c=>c.v>0.5).length+'/'+cars.length;
    out.busS=G.buses.map(b=>Math.round(b.agent.s)); out.phases=G.buses.map(b=>b.phase);
    out.cond=G.buses.map(b=>Math.round(b.cond));
    out.ms=Math.round(performance.now()-t0);
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  console.log(errs);
  await b.close();
})();
