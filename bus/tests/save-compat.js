const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' @' + (e.stack||'').split('\n')[1]));
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(1500);
  const cont = async (saveObj, label) => {
    await p.evaluate(([o])=>{ localStorage.setItem('bus_company_v1', typeof o==='string'?o:JSON.stringify(o)); UI.showTitle(); },[saveObj]);
    await p.evaluate(()=>document.getElementById('bCont').click()); await p.waitForTimeout(800);
    console.log(label, await p.evaluate(()=>JSON.stringify({state:G.state,routes:G.routes.length,buses:G.buses.length,money:Math.round(G.money),modal:!document.getElementById('modal').classList.contains('hide'),mig:G.migrated,name:G.name})));
    await p.evaluate(()=>{ document.getElementById('modal').classList.add('hide'); });
  };
  // 1. old save (GN=11 era): no gn field, routes with ids
  await cont({name:'옛회사',money:3000000,rep:60,pax:500,gt:100,hour:10,nextRoute:3,nextBus:3,routes:[{id:1,num:101,name:'a',color:3447003,stopIds:[3,7,12,15,9]},{id:2,num:102,name:'b',color:3447003,stopIds:[1,2]}],buses:[{id:1,type:'city',routeId:1},{id:2,type:'dd',routeId:2}],waiting:[1,2,3]},'old');
  // 2. garbage json
  await cont('{not json','garbage');
  // 3. valid gn but invalid stop ids & bad numbers
  await cont({gn:17,ver:4,name:'x',money:'abc',rep:999,pax:null,hour:99,routes:[{id:1,num:101,name:'bad',color:1,stopIds:[9999,1]},{id:2,num:102,name:'ok',color:2,stopIds:[4,8,20]}],buses:[{id:1,type:'nope',routeId:2},{id:2,type:'mini',routeId:2,cond:'x'},{id:3,type:'mini',routeId:1}],fare:99999},'invalid');
  // 4. roundtrip
  await p.evaluate(()=>{ localStorage.clear(); startCompany('rt'); G.money=7777777; G.rep=77; G.up.garage=2; const ids=[3,9,15]; const r=addRoute('rt',ROUTE_COLORS[2],ids,true); addBus('mini',r.id,true); G.fare=2000; saveCompany(); });
  const before = await p.evaluate(()=>JSON.stringify({m:Math.round(G.money/1000),rep:G.rep,up:G.up,routes:G.routes.map(r=>r.stopIds.join()),buses:G.buses.map(b=>b.type+b.routeId),fare:G.fare}));
  await p.evaluate(()=>{ UI.showTitle(); document.getElementById('bCont').click(); }); await p.waitForTimeout(500);
  const after = await p.evaluate(()=>JSON.stringify({m:Math.round(G.money/1000),rep:G.rep,up:G.up,routes:G.routes.map(r=>r.stopIds.join()),buses:G.buses.map(b=>b.type+b.routeId),fare:G.fare}));
  console.log('roundtrip equal:', before===after); if(before!==after) console.log(before,'\n',after);
  // school corrupted
  await p.evaluate(()=>{ localStorage.setItem('bus_school_v1', JSON.stringify({wallet:'NaN',cars:[{id:1,model:'zzz',km:1},{id:2,model:'avante',km:5,color:1}],done:null})); });
  await p.reload(); await p.waitForTimeout(1500);
  console.log('school', await p.evaluate(()=>JSON.stringify({w:SCHOOL.wallet,cars:SCHOOL.cars.map(c=>c.model),done:SCHOOL.done,next:SCHOOL.nextCar})));
  console.log(errs);
  await b.close();
})();
