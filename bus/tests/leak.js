const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 700, height: 500 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(1500);
  const mem = async (l)=> console.log(l.padEnd(26), await p.evaluate(()=>JSON.stringify({geo:renderer.info.memory.geometries,tex:renderer.info.memory.textures,prog:renderer.info.programs.length,scene:scene.children.length,agents:agents.length})));
  await p.evaluate(()=>{ startCompany('m'); G.money=9e8; G.pax=9999; });
  await p.waitForTimeout(500); await mem('baseline');
  for(let r=0;r<3;r++){
    await p.evaluate(()=>{ for(let i=0;i<5;i++) addBus(['city','mini','dd'][i%3],G.routes[0].id,true); });
    await p.waitForTimeout(400);
    await p.evaluate(()=>{ for(const b of G.buses.slice(1)) sellBus(b); });
    await p.waitForTimeout(400); await mem('after add/sell x5 #'+(r+1));
  }
  for(let r=0;r<3;r++){
    await p.evaluate(()=>{ UI.showTitle(); startSchoolWorld(); startCar({id:99,model:'avante',color:0xffffff,km:0},{x:0,z:0}); setTaxi(true); });
    await p.waitForTimeout(500);
    await p.evaluate(()=>{ stopManual(true); });
    await p.waitForTimeout(300); await mem('free+taxi cycle #'+(r+1));
  }
  for(let r=0;r<3;r++){
    await p.evaluate(()=>{ startLesson(LESSONS[1]); }); await p.waitForTimeout(300); await p.evaluate(()=>{ stopManual(true); }); await p.waitForTimeout(300); await mem('lesson cycle #'+(r+1));
  }
  for(let r=0;r<3;r++){ await p.evaluate(()=>{ startCompany('m'); }); await p.waitForTimeout(300); await mem('restart company #'+(r+1)); }
  console.log(errs);
  await b.close();
})();
