const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = [], log=[];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' @' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(1500);
  const ev = (f)=>p.evaluate(f);
  const click = async (sel)=>{ await p.evaluate(s=>{const e=document.querySelector(s); if(!e) throw new Error('no '+s); e.click();}, sel); await p.waitForTimeout(250); };
  const step = async (name, fn)=>{ const n=errs.length; try{ await fn(); }catch(e){ errs.push('STEP '+name+': '+e.message); } log.push((errs.length===n?'ok   ':'FAIL ')+name); };
  await ev(()=>{ localStorage.clear(); SCHOOL.wallet=400e6; SCHOOL.cars.length=0; });
  // ---- title
  await step('title help', async()=>{ await click('#bHelp'); });
  await step('free modal open/options', async()=>{ await click('#bFree'); await click('[data-fd="hour"][data-v="23"]'); await click('[data-fdw="fog"]'); await click('[data-fd="traffic"][data-v="0"]'); await click('#fdFreeze'); });
  await step('free start (loaner)', async()=>{ await click('#fdGo'); await p.waitForTimeout(1500); if(!(await ev(()=>P.active&&P.free))) throw new Error('not driving'); });
  await step('free drive W', async()=>{ await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await p.keyboard.up('KeyW'); if((await ev(()=>P.v))<0.5) throw new Error('no speed'); });
  await step('free keys K V L C T H', async()=>{ for(const k of ['KeyK','KeyV','KeyL','KeyC','KeyC','KeyC','KeyH','BracketRight','BracketLeft']) { await p.keyboard.press(k); } await p.keyboard.press('KeyT'); await p.waitForTimeout(500); await p.keyboard.press('KeyT'); });
  await step('free pause menu', async()=>{ await click('#exitBtn'); if(!(await ev(()=>!document.getElementById('modal').classList.contains('hide')))) throw new Error('no modal'); await click('[data-fh="12"]'); await click('[data-ft="14"]'); await click('[data-fl="1"]'); await click('[data-wx="rain"]'); await click('[data-wx="clear"]'); });
  await step('free teleport', async()=>{ await p.evaluate(()=>{ const c=document.getElementById('fpMap'); const r=c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('click',{clientX:r.left+r.width*0.7,clientY:r.top+r.height*0.3,bubbles:true})); }); await p.waitForTimeout(300); if(!(await ev(()=>!P.paused))) throw new Error('still paused'); });
  await step('taxi mode', async()=>{ await click('#exitBtn'); await click('[data-tx]'); await p.waitForTimeout(300); if(!(await ev(()=>!!P.taxi))) throw new Error('no taxi'); await p.waitForTimeout(500); await p.evaluate(()=>{ P.paused=false; document.getElementById('modal').classList.add('hide'); }); await p.waitForTimeout(500); await ev(()=>{ const h=P.taxi.hail[0]; P.x=h.x+3; P.z=h.z+3; P.v=0; }); await p.waitForTimeout(5000); await ev(()=>{ if(P.taxi.ride){ const s=P.taxi.ride.dest; P.x=s.curb.x; P.z=s.curb.z; P.v=0; } }); await p.waitForTimeout(5000); });
  await step('free exit', async()=>{ await p.keyboard.press('Escape'); await p.waitForTimeout(300); await click('#pEnd'); await p.waitForTimeout(400); if(await ev(()=>P.active)) throw new Error('still active'); if(!(await ev(()=>!document.getElementById('title').classList.contains('hide')))) throw new Error('title hidden'); });
  // ---- wallet/dealer
  await step('wallet tabs', async()=>{ await click('#bCar'); await click('[data-wt="dealer"]'); await click('[data-brand="BMW"]'); await click('[data-brand="테슬라"]'); await click('[data-brand="현대"]'); await click('[data-wt="garage"]'); await click('[data-wt="wallet"]'); });
  await step('config+buy cash', async()=>{ await click('[data-wt="dealer"]'); await click('[data-brand="기아"]'); await click('[data-cfg="morning"]'); await click('[data-cl="1"]'); await click('#cBuy'); if((await ev(()=>SCHOOL.cars.length))!==1) throw new Error('not bought'); });
  await step('config+buy loan', async()=>{ await click('[data-wt="dealer"]'); await click('[data-brand="제네시스"]'); await click('[data-cfg="g80"]'); await click('[data-ct="1"]'); await click('[data-ce="diesel"]'); await click('[data-co="sunroof"]'); await click('[data-pm="loan"]'); await click('[data-mo="36"]'); await click('[data-dp="0.5"]'); await click('#cBuy'); if((await ev(()=>SCHOOL.cars.length))!==2) throw new Error('not bought'); });
  await step('owned car free-drive', async()=>{ await click('#wClose'); await click('#bFree'); await click('[data-fd="car"][data-v="2"]'); await click('#fdGo'); await p.waitForTimeout(1200); if(!(await ev(()=>P.active&&P.free&&P.bus.spec.name.includes('G80')))) throw new Error('wrong car'); await p.keyboard.press('KeyT'); await p.keyboard.press('KeyT'); await p.keyboard.press('KeyC'); await p.keyboard.press('KeyC'); await p.keyboard.press('KeyC'); await p.keyboard.press('KeyC'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await click('#pEnd'); });
  await step('garage sell', async()=>{ await click('#bCar'); await click('[data-wt="garage"]'); await click('[data-csell]'); });
  await step('wallet drive from garage', async()=>{ await click('[data-cdrive]'); await p.waitForTimeout(1000); if(!(await ev(()=>P.active))) throw new Error('no drive'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await click('#pEnd'); });
  // ---- school
  await step('school modal + L1', async()=>{ await click('#bSchool'); await click('[data-l="0"]'); await p.waitForTimeout(1200); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await click('#pGo'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await click('#pEnd'); });
  // ---- company
  await step('company start', async()=>{ await click('#bNew'); await p.waitForTimeout(800); });
  for (const t of ['routes','fleet','stops','company','goals']) await step('tab '+t, async()=>{ await click('[data-t="'+t+'"]'); await p.waitForTimeout(300); });
  await step('editor', async()=>{ await click('[data-t="routes"]'); await click('#newRoute'); await ev(()=>{ const E=UI.edState; [2,5,9].forEach(i=>E.stops.push(i)); UI.edUpdate(); UI.edZoom(2); UI.edReset(); }); await click('#edSave'); await p.waitForTimeout(400); });
  await step('buy bus modal', async()=>{ await ev(()=>{ G.money=9e6; }); await click('#mBuy'); });
  await step('bus drive + auto + pause', async()=>{ await ev(()=>UI.driveBus(G.buses[0])); await p.waitForTimeout(800); await p.keyboard.press('KeyT'); await p.waitForTimeout(500); await p.keyboard.press('KeyT'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await click('#pEnd'); });
  await step('withdraw + car from company', async()=>{ await ev(()=>{ G.money=50e6; }); await click('[data-t="company"]'); await click('[data-wd="1000000"]'); await click('#tbWallet'); await click('[data-wt="garage"]'); await click('#wClose'); });
  await step('speed 10x + settle', async()=>{ await click('[data-sp="10"]'); await ev(()=>{ G.hour=23.99; }); await p.waitForTimeout(1500); });
  await step('save+menu', async()=>{ await click('#tbSave'); await click('#tbMenu'); await click('#bCont'); await p.waitForTimeout(800); });
  console.log(log.join('\n')); console.log('ERRORS:', errs.length? errs : 'none');
  await b.close();
})();
