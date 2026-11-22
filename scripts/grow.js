/* ===================== 대규모 업데이트: 성장(레벨), 출석 보상, 업적, 몬스터 패턴 ===================== */
const CUR2='{{COIN}}';
const LV_MAX=30,LV_BONUS=.03;
const xpNeed=l=>60+l*40;                         // 다음 레벨까지 필요한 경험치
function lvInfo(name){
  if(!save)return {l:1,x:0};
  save.lv=save.lv||{};const o=save.lv[name]=save.lv[name]||{l:1,x:0};
  o.l=Math.max(1,Math.min(LV_MAX,Math.floor(o.l||1)));o.x=Math.max(0,Math.floor(o.x||0));return o;
}
function lvMult(name){return 1+(lvInfo(name).l-1)*LV_BONUS}
function maxLv(s){return Math.max(1,...Object.values((s&&s.lv)||{}).map(o=>o&&o.l||1))}
function gainXp(name,amount){
  const o=lvInfo(name);if(o.l>=LV_MAX)return false;
  o.x+=Math.max(0,Math.floor(amount));let up=false;
  while(o.l<LV_MAX&&o.x>=xpNeed(o.l)){o.x-=xpNeed(o.l);o.l++;up=true}
  if(o.l>=LV_MAX)o.x=0;
  if(up){try{msg('⬆️ 레벨 업! '+name+' Lv.'+o.l);sfx('win');shake(6)}catch(e){}}
  return up;
}
// 전투에 들어갈 때 레벨 보너스(체력·공격)를 한 번만 적용 (대인전 제외)
function applyLvBuff(){
  try{
    if(typeof player==='undefined'||!player||player._lb||typeof pvpMode!=='undefined'&&pvpMode)return;
    player._lb=1;const k=lvMult(player.name);if(k<=1)return;
    player.hp=Math.round(player.hp*k);player.max=Math.round(player.max*k);player.atk=Math.round(player.atk*k);
    const t=$('lvTag');if(t)t.textContent='Lv.'+lvInfo(player.name).l;
  }catch(e){}
}
['setup','setupDungeonBattle','startOnlineRoomLocal'].forEach(f=>{
  const o=window[f];if(typeof o!=='function')return;
  window[f]=function(){const r=o.apply(this,arguments);applyLvBuff();showLvTag();return r};
});
function showLvTag(){
  try{
    let t=$('lvTag');
    if(!t){t=document.createElement('div');t.id='lvTag';t.style.cssText='position:fixed;top:96px;left:12px;z-index:50;padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.55);border:1px solid rgba(253,224,71,.6);color:#fde047;font-weight:900;font-size:14px;pointer-events:none';document.body.appendChild(t)}
    const g=$('game'),on=g&&g.classList.contains('active')&&player&&!(typeof pvpMode!=='undefined'&&pvpMode);
    t.style.display=on?'block':'none';if(on)t.textContent='Lv.'+lvInfo(player.name).l;
  }catch(e){}
}
setInterval(showLvTag,1500);
// 캐릭터 정보 창에 레벨 줄 추가
{const _show=show;show=function(){_show.apply(this,arguments);try{const c=chars[sel],o=lvInfo(c.name),e=$('info');if(e)e.insertAdjacentHTML('beforeend',`<p>⭐ <b>Lv.${o.l}</b>${o.l>=LV_MAX?' (최고 레벨)':` · 경험치 ${o.x}/${xpNeed(o.l)}`} · 전투 능력치 +${Math.round((lvMult(c.name)-1)*100)}%</p>`)}catch(e){}}}

/* ----- 출석 보상 (7일 연속, 하루 한 번) ----- */
const ATT=[{c:100},{c:150},{d:1},{c:250},{c:300},{d:2},{c:500,d:3}];
function ymdAdd(ymd,days){const d=new Date(Date.UTC(+ymd.slice(0,4),+ymd.slice(4,6)-1,+ymd.slice(6,8)));d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10).replace(/-/g,'')}
function attState(){
  if(!save)return null;
  const a=save.att=save.att||{last:'',streak:0,claimed:''},today=KST();
  if(a.last!==today){a.streak=(a.last&&ymdAdd(a.last,1)===today)?a.streak+1:1;a.last=today}
  return a;
}
function attReward(){const a=attState();return ATT[(Math.max(1,a.streak)-1)%7]}
function claimAtt(){
  const a=attState();if(!a)return;
  if(typeof SERVER==='function'&&SERVER())return alert('서버 모드에서는 출석 보상이 잠시 쉬어요.');
  if(a.claimed===KST())return;
  const r=attReward();a.claimed=KST();
  if(r.c){coins+=r.c;save.coins=coins}if(r.d){dia+=r.d;save.dia=dia}
  store();sfx('coin');renderGrow();
}
const rwText=r=>(r.c?r.c+' '+CUR2:'')+(r.c&&r.d?' + ':'')+(r.d?'다이아 '+r.d:'');

/* ----- 업적 ----- */
const ACH=[
  {id:'win1',t:'첫 승리',f:s=>s.wins||0,n:1,r:{c:200}},{id:'win10',t:'10번 승리',f:s=>s.wins||0,n:10,r:{c:500}},
  {id:'win50',t:'50번 승리',f:s=>s.wins||0,n:50,r:{d:3}},{id:'win200',t:'200번 승리',f:s=>s.wins||0,n:200,r:{d:10}},
  {id:'st5',t:'5스테이지 도달',f:s=>s.best||1,n:5,r:{c:300}},{id:'st10',t:'10스테이지 도달',f:s=>s.best||1,n:10,r:{d:2}},
  {id:'st20',t:'20스테이지 도달',f:s=>s.best||1,n:20,r:{d:5}},{id:'st40',t:'40스테이지 도달',f:s=>s.best||1,n:40,r:{d:10}},
  {id:'cb10',t:'10콤보 달성',f:s=>(s.ach&&s.ach.maxCombo)||0,n:10,r:{c:400}},{id:'cr30',t:'치명타 30번',f:s=>(s.ach&&s.ach.crits)||0,n:30,r:{c:400}},
  {id:'cr200',t:'치명타 200번',f:s=>(s.ach&&s.ach.crits)||0,n:200,r:{d:3}},{id:'dg10',t:'돌진 피하기 10번',f:s=>(s.ach&&s.ach.dodges)||0,n:10,r:{c:400}},
  {id:'lv5',t:'캐릭터 Lv.5',f:maxLv,n:5,r:{c:500}},{id:'lv15',t:'캐릭터 Lv.15',f:maxLv,n:15,r:{d:5}},{id:'lv30',t:'캐릭터 Lv.30 (최고)',f:maxLv,n:30,r:{d:20}},
  {id:'own5',t:'캐릭터 5명 모으기',f:s=>(s.owned||[]).length,n:5,r:{c:500}},{id:'own15',t:'캐릭터 15명 모으기',f:s=>(s.owned||[]).length,n:15,r:{d:5}}
];
function achAdd(k,v){if(!save)return;save.ach=save.ach||{};save.ach[k]=(save.ach[k]||0)+v}
function achMax(k,v){if(!save)return;save.ach=save.ach||{};save.ach[k]=Math.max(save.ach[k]||0,v)}
function claimAch(id){
  const a=ACH.find(x=>x.id===id);if(!a||!save)return;
  if(typeof SERVER==='function'&&SERVER())return alert('서버 모드에서는 업적 보상이 잠시 쉬어요.');
  save.ach=save.ach||{};save.ach.done=save.ach.done||{};
  if(save.ach.done[id]||a.f(save)<a.n)return;
  save.ach.done[id]=1;if(a.r.c){coins+=a.r.c;save.coins=coins}if(a.r.d){dia+=a.r.d;save.dia=dia}
  store();sfx('coin');renderGrow();
}
function renderGrow(){
  const box=$('growList');if(!box||!save)return;
  const a=attState(),got=a.claimed===KST(),r=attReward(),o=lvInfo(chars[sel]?chars[sel].name:''),c=chars[sel];
  const days=ATT.map((x,i)=>{const cur=((a.streak-1)%7)===i;return `<span style="display:inline-block;margin:2px;padding:3px 7px;border-radius:8px;background:${cur?'#f59e0b':'rgba(255,255,255,.1)'};color:${cur?'#111':'#cbd5e1'};font-size:12px">${i+1}일</span>`}).join('');
  save.ach=save.ach||{};save.ach.done=save.ach.done||{};
  const doneN=ACH.filter(x=>save.ach.done[x.id]).length;
  box.innerHTML=`<div style="padding:8px 10px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.07)"><b>📅 출석 ${a.streak}일째</b> <small style="color:#9ca3af">(7일마다 더 큰 선물)</small><div>${days}</div><div style="margin-top:6px">${got?'✅ 오늘 보상을 받았어요':`<button class="green" onclick="claimAtt()">오늘의 보상 받기: ${rwText(r)}</button>`}</div></div>
  <div style="padding:8px 10px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.07)"><b>⭐ ${c?c.name:''} Lv.${o.l}</b> ${o.l>=LV_MAX?'(최고 레벨)':`<small>경험치 ${o.x}/${xpNeed(o.l)}</small>`}<div style="height:6px;margin-top:6px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden"><div style="height:100%;width:${o.l>=LV_MAX?100:o.x/xpNeed(o.l)*100}%;background:linear-gradient(90deg,#34d399,#fde047)"></div></div><div class="small">몬스터를 쓰러뜨리면 경험치를 얻어요. 레벨이 오르면 전투 능력치가 올라요 (+${Math.round((lvMult(c?c.name:'')-1)*100)}%).</div></div>
  <details style="padding:8px 10px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.07)"><summary><b>🏆 업적</b> <small style="color:#9ca3af">(${doneN}/${ACH.length})</small></summary>${ACH.map(x=>{const v=Math.min(x.n,x.f(save)||0),ok=v>=x.n,d=!!save.ach.done[x.id];return `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:6px 0"><span>${d?'✅':ok?'🎁':'⬜'} ${x.t} <small style="color:#9ca3af">(${v}/${x.n})</small></span>${d?'<small>받았어요</small>':ok?`<button class="green" onclick="claimAch('${x.id}')">${rwText(x.r)} 받기</button>`:`<small style="color:#9ca3af">${rwText(x.r)}</small>`}</div>`}).join('')}</details>`;
}
{const _st=showTab;showTab=function(id){_st(id);if(id==='home')renderGrow()}}
{const _sc=onStageClear;onStageClear=function(rw,dr,bl){
  _sc.apply(this,arguments);
  try{if(player&&!(typeof pvpMode!=='undefined'&&pvpMode)){
    const boss=stage%10===1?3:(stage%5===1?2:1),amt=(20+Math.max(1,stage-1)*6)*boss*((save.wins||0)<3?2:1); // 첫 3승은 경험치 2배
    const up=gainXp(player.name,amt);if(!up)setTimeout(()=>{try{msg('✨ 경험치 +'+amt)}catch(e){}},1700);
    renderGrow();
  }}catch(e){}
}}
setTimeout(renderGrow,700);

/* ----- 몬스터 패턴: 돌진 경고 + 보스 탄막 (혼자 하기·던전만, 처음 3승 전에는 없음) ----- */
function patOn(){return typeof run!=='undefined'&&run&&enemy&&player&&!(typeof pvpMode!=='undefined'&&pvpMode)&&!(typeof coopMode!=='undefined'&&coopMode)&&(save.wins||0)>=3&&enemy.hp>0}
let eBullets=[];
function hurtPlayer(dmg,label){
  if(player.inv>0)return false;
  player.hp-=dmg;player.inv=.45;effects.push([player.x,player.y,.3,'#ef4444',label||'피격']);shake(7);sfx('hit');return true;
}
{const _u2=upd;upd=function(dt){
  _u2(dt);
  try{
    if(!patOn()){if(typeof run!=='undefined'&&!run)eBullets=[];return}
    const sc=Math.max(.6,Math.min(1.25,w/900)),P=enemy._pat=enemy._pat||{t:3+Math.random()*2,s:'idle',bt:6+Math.random()*3};
    // 돌진: 경고 → 방향 고정 → 돌진
    if(P.s==='idle'){P.t-=dt;if(P.t<=0){P.s='warn';P.t=.9;const dx=player.x-enemy.x,dy=player.y-enemy.y,l=Math.hypot(dx,dy)||1;P.dx=dx/l;P.dy=dy/l;sfx('skill')}}
    else if(P.s==='warn'){P.t-=dt;if(P.t<=0){P.s='dash';P.t=.38;P.hit=false}}
    else if(P.s==='dash'){
      P.t-=dt;enemy.x+=P.dx*820*sc*dt;enemy.y+=P.dy*820*sc*dt;
      if(!P.hit&&Math.hypot(enemy.x-player.x,enemy.y-player.y)<enemy.r+player.r){
        if(hurtPlayer(enemy.atk*.9,'돌진!'))P.hit=true;
      }
      if(P.t<=0){if(!P.hit&&typeof player!=='undefined'){achAdd('dodges',1);effects.push([player.x,player.y-40,.6,'#34d399','회피 성공!'])}P.s='idle';P.t=4+Math.random()*3}
    }
    // 보스 탄막: 5스테이지마다 나오는 보스가 사방으로 탄환을 쏘아요
    const boss=(typeof stage!=='undefined')&&(stage%5===0||stage%10===0);
    if(boss){P.bt-=dt;if(P.bt<=0){P.bt=7+Math.random()*3;const n=8,ph=Math.random()*6.28;for(let i=0;i<n;i++){const a=ph+i*6.2832/n;eBullets.push({x:enemy.x,y:enemy.y,vx:Math.cos(a)*230*sc,vy:Math.sin(a)*230*sc,r:11,life:3.4})}effects.push([enemy.x,enemy.y-40,.6,'#fca5a5','탄막!'])}}
    eBullets.forEach(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life>0&&Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r-6){if(hurtPlayer(enemy.atk*.45,'탄막'))b.life=0}});
    eBullets=eBullets.filter(b=>b.life>0);
  }catch(e){}
}}
{const _d2=draw;draw=function(){
  _d2();
  try{
    if(!ctx)return;
    const P=enemy&&enemy._pat;
    if(P&&P.s==='warn'&&patOn()){
      ctx.save();const a=.25+.35*Math.sin(Date.now()/70);ctx.strokeStyle='rgba(239,68,68,'+a.toFixed(2)+')';ctx.lineWidth=Math.max(18,enemy.r*1.4);ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);ctx.lineTo(enemy.x+P.dx*620,enemy.y+P.dy*620);ctx.stroke();
      ctx.fillStyle='#fecaca';ctx.font='900 34px Arial';ctx.textAlign='center';ctx.fillText('⚠️',enemy.x,enemy.y-enemy.r-12);ctx.restore();
    }
    eBullets.forEach(b=>{ctx.beginPath();ctx.fillStyle='#fb7185';ctx.shadowColor='#ef4444';ctx.shadowBlur=14;ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();ctx.shadowBlur=0});
  }catch(e){}
}}
{const _su3=setup;setup=function(){eBullets=[];return _su3.apply(this,arguments)}}
