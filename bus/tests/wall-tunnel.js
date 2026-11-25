const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'), contentType: 'text/javascript' }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(1500);
  const res = await p.evaluate(()=>{
    const out=[];
    for(const dt of [0.016,0.05,0.1,0.2]){
      for(const dir of [[1,0],[0,1],[-1,0],[0,-1],[0.7,0.7]]){
        startSchoolWorld(); for(const c of cars) c.dispose(); cars=[];
        startCar({id:99,model:'huracan',color:0,cfg:{trim:1,eng:'gas',opts:['sport'],color:0},km:0,age:0},{x:0,z:0});
        P.x=0; P.z=0; P.h=Math.atan2(dir[0],dir[1]); P.v=0; P.cam=0; keys.KeyW=true;
        let esc=false, maxA=0, crossedBlock=0;
        for(let i=0;i<Math.ceil(60/dt);i++){ updatePlayer(dt); maxA=Math.max(maxA,Math.abs(P.x),Math.abs(P.z));
          // inside any solid block (not outer) means tunnelled
          for(const bl of world.blocks){ if(P.x>bl.minx+2&&P.x<bl.maxx-2&&P.z>bl.minz+2&&P.z<bl.maxz-2){ crossedBlock++; break; } } }
        keys.KeyW=false;
        out.push({dt,dir:dir.join(','),maxA:Math.round(maxA),inBlock:crossedBlock,kmh:Math.round(P.v*3.6),esc:maxA>EXT+12});
        stopManual(true);
      }
    }
    return out;
  });
  const bad=res.filter(r=>r.inBlock>0||r.esc);
    console.log(res.map(r=>JSON.stringify(r)).join('\n')); console.log('BAD', JSON.stringify(bad)); console.log(errs);
  await b.close();
})();
