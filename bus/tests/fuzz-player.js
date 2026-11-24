const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' @' + (e.stack||'').split('\n').slice(0,3).join('|')));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(1500);
  await p.evaluate(()=>localStorage.clear());
  const res = await p.evaluate(()=>{
    const report=[]; const KEYS=['KeyW','KeyS','KeyA','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
    const PK=['KeyF','KeyH','KeyC','KeyT','KeyR','KeyK','KeyV','KeyL','BracketLeft','BracketRight'];
    function run(name, steps){
      const bad=[]; let maxV=0, maxAbs=0, minScore=100, tel=0;
      for(let i=0;i<steps;i++){
        if(i%12===0){ for(const k of KEYS) keys[k]=Math.random()<0.35; if(Math.random()<0.5) keys.KeyW=true; }
        if(i%40===0){ const k=PK[Math.floor(Math.random()*PK.length)]; try{ playerKey(k);}catch(e){ bad.push('key '+k+': '+e.message); } }
        if(P.wheelOn=Math.random()<0.1) P.wheelIn=Math.random()*2-1;
        try{ updateWorld(0.05); updatePlayer(0.05); if(P.active) driveCamera(0.05); }catch(e){ bad.push(e.message+' @'+(e.stack||'').split('\n')[1]); break; }
        const f=[P.x,P.z,P.v,P.h,P.steer,P.score,P.comfort].every(isFinite); if(!f){ bad.push('nonfinite at '+i+' '+JSON.stringify({x:P.x,z:P.z,v:P.v,h:P.h,s:P.steer})); break; }
        maxV=Math.max(maxV,Math.abs(P.v)); maxAbs=Math.max(maxAbs,Math.abs(P.x),Math.abs(P.z)); minScore=Math.min(minScore,P.score);
        if(!isFinite(SCHOOL.wallet)||SCHOOL.wallet<0){ bad.push('wallet '+SCHOOL.wallet); break; }
        if(G && !isFinite(G.money)){ bad.push('money nan'); break; }
        if(!P.active){ bad.push('driving ended unexpectedly at '+i); break; }
        if(Math.abs(P.x)>EXT+40||Math.abs(P.z)>EXT+40){ bad.push('escaped world '+(P.x|0)+','+(P.z|0)); break; }
      }
      for(const k of KEYS) keys[k]=false; P.wheelOn=false;
      report.push({name,bad:bad.slice(0,3),maxKmh:Math.round(maxV*3.6),maxAbs:Math.round(maxAbs),minScore:Math.round(minScore)});
      if(P.active) stopManual(true);
    }
    // bus manual in company
    startCompany('fz'); G.money=9e8; SCHOOL.wallet=1e9; G.speed=1;
    for(let k=0;k<2;k++) addBus('city',G.routes[0].id,true);
    G.state='drive'; startManual(G.buses[0]); run('bus manual',4000);
    // lessons
    for(const L of LESSONS){ try{ startLesson(L); run('lesson '+L.id,3000); }catch(e){ report.push({name:'lesson '+L.id,bad:[e.message]}); } }
    // free cars: each model, random cfg
    for(const key of Object.keys(CAR_SPECS)){
      startSchoolWorld(); const tr=TRIM_SETS[CAR_SPECS[key].brand]; const cfg={trim:Math.floor(Math.random()*tr.length),eng:ENG_OK[key][Math.floor(Math.random()*ENG_OK[key].length)],opts:OPTS.filter(()=>Math.random()<0.5).map(o=>o.k),color:0};
      const car={id:99,model:key,color:CAR_SPECS[key].colors[0],cfg,km:0,age:0,price:CAR_SPECS[key].price};
      try{ startCar(car,{x:rand(-300,300),z:rand(-300,300)}); if(Math.random()<0.5) setTaxi(true); run('car '+key,2500); }catch(e){ report.push({name:'car '+key,bad:[e.message+' @'+(e.stack||'').split('\n')[1]]}); if(P.active) stopManual(true); }
    }
    return report;
  });
  for(const r of res) console.log((r.bad.length?'FAIL ':'ok   ')+r.name, JSON.stringify(r.bad), 'maxKmh',r.maxKmh,'maxAbs',r.maxAbs,'minScore',r.minScore);
  console.log(errs);
  await b.close();
})();
