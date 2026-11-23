/* ===================== 🎲 랜덤 대전 · 🤖 AI 대전 · 🤖 AI 동료 (협동) ===================== */
const AI_LV=[{k:1,label:'쉬움',hp:2.2,atk:.055,spd:2.4},{k:2,label:'보통',hp:3,atk:.075,spd:2.9},{k:3,label:'어려움',hp:3.8,atk:.095,spd:3.4},{k:4,label:'도전',hp:4.8,atk:.115,spd:3.9}];
let aiDuel=null,qm=null;
function aiBots(){
  // 오늘은 이 친구들이 AI로 나와요 (날짜마다 바뀌어요)
  const day=Number(KST().slice(2)),n=chars.length;
  return AI_LV.map((L,i)=>{const c=chars[(day*7+i*11)%n];return {L,c,name:'🤖 '+c.name+' 봇'}});
}
function aiRosterHtml(){
  return '<div style="margin:10px 0 4px"><b>🤖 AI 상대</b> <small style="color:#9ca3af">(순위·승점에는 영향이 없어요)</small></div>'+aiBots().map((b,i)=>`<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;margin:4px 0;border-radius:10px;background:rgba(99,102,241,.14)"><span style="flex:1;min-width:0">${escH(b.c.emoji)} <b>${escH(b.name)}</b><br><small style="color:#a5b4fc">${b.L.label}</small></span><button class="purple" onclick="startAiDuel(${i})">대전</button></div>`).join('');
}
function showAiRoster(){const box=$('pvpRoomList');if(box)box.innerHTML=aiRosterHtml()}
{const _lr=loadPvpRooms;loadPvpRooms=async function(){await _lr.apply(this,arguments);try{const box=$('pvpRoomList');if(box&&!box.querySelector('.aiRoster')){const d=document.createElement('div');d.className='aiRoster';d.innerHTML=aiRosterHtml();box.appendChild(d)}}catch(e){}}}

/* ----- AI 대전: 내 능력치를 본뜬 상대와 1대1 (혼자 하는 전투 엔진을 써요) ----- */
function startAiDuel(i){
  if(typeof isBanned==='function'&&isBanned())return alert('이용이 정지된 계정은 시작할 수 없어요.');
  const c=chars[sel];if(!owned(c))return alert('구매하지 않은 캐릭터입니다.');
  const b=aiBots()[Math.max(0,Math.min(AI_LV.length-1,i|0))];
  try{leavePvpRoom(false)}catch(e){}
  cancelQm();
  pvpMode=false;coopMode=false;dungeonPlace=null;
  $('select').classList.remove('active');$('game').classList.add('active');
  cv=$('cv');ctx=cv.getContext('2d');resize();addEventListener('resize',resize);
  stage=Math.max(1,save.best||1);coins=save.coins||0;dia=save.dia||0;
  setup();
  const L=b.L,ex=enemy;
  enemy.name=b.name;enemy.emoji=b.c.emoji;enemy.color=b.c.color;enemy.r=40;
  enemy.max=enemy.hp=Math.round(player.max*L.hp);enemy.atk=Math.round(player.max*L.atk);enemy.spd=L.spd;
  aiDuel={bot:b,L,done:false,startedAt:Date.now()};
  run=true;last=performance.now();startAt=Date.now();requestAnimationFrame(loop);
  try{msg('🤖 AI 대전 시작! '+b.name+' ('+L.label+')')}catch(e){}
}
function finishAiDuel(won){
  if(!aiDuel||aiDuel.done)return;aiDuel.done=true;
  const L=aiDuel.L;
  if(won){
    sfx('win');
    let txt='🏆 AI 대전 승리!';
    // 보상은 하루 5번까지 (서버 모드에서는 쉬어요)
    const d=KST();save.aiw=(save.aiw&&save.aiw.d===d)?save.aiw:{d,n:0};
    if(save.aiw.n<5&&!(typeof SERVER==='function'&&SERVER())){
      save.aiw.n++;const c=60*L.k;coins+=c;save.coins=coins;txt+=' '+CUR+' +'+c+' ('+save.aiw.n+'/5)';
    }else txt+=' (오늘 보상은 모두 받았어요)';
    try{gainXp(player.name,15+L.k*12)}catch(e){}
    try{dqAdd('kills',1)}catch(e){}
    try{store()}catch(e){}
    msg(txt);
  }else msg('🤖 AI에게 졌어요… 다음엔 이길 수 있어요!');
  run=false;setTimeout(()=>{try{back()}catch(e){}},1400);
}
{const _o=onStageClear;onStageClear=function(){if(aiDuel){finishAiDuel(true);return}return _o.apply(this,arguments)}}
{const _b=back;back=function(){aiDuel=null;return _b.apply(this,arguments)}}
{const _u=upd;upd=function(dt){const r=_u.apply(this,arguments);try{if(aiDuel&&!aiDuel.done&&player&&player.hp<=0)finishAiDuel(false)}catch(e){}return r}}
{const _h=hud;hud=function(){_h.apply(this,arguments);try{if(aiDuel){const s=$('stage');if(s)s.textContent='🤖 AI 대전 · '+aiDuel.L.label;const t=$('bossType');if(t)t.textContent=enemy.name}}catch(e){}}}

/* ----- 🎲 랜덤 대전: 기다리는 사람이 있으면 바로 들어가고, 없으면 방을 만들어 기다려요. 못 찾으면 AI와 ----- */
let QM_WAIT_MS=10000;
function aiLevelFor(){const p=save.pvp||0;return p>=300?3:p>=150?2:p>=50?1:0}
function qmStatus(t){const e=$('qmStatus');if(e)e.textContent=t||''}
function cancelQm(){if(qm){clearInterval(qm.timer);qm=null}qmStatus('')}
async function quickMatch(){
  if(user==='guest')return alert('로그인 후 쓸 수 있어요. 로그인 없이도 🤖 AI 대전은 할 수 있어요!');
  if(!online||!db)return alert('온라인 연결이 필요해요.');
  if(typeof isBanned==='function'&&isBanned())return alert('이용이 정지된 계정은 시작할 수 없어요.');
  const c=chars[sel];if(!owned(c))return alert('구매하지 않은 캐릭터입니다.');
  cancelQm();qmStatus('🎲 상대를 찾는 중...');
  let rooms={};try{rooms=(await dbRef('pvpRooms').limitToLast(50).get()).val()||{}}catch(e){}
  const now=Date.now(),cand=Object.keys(rooms).filter(k=>{
    if(!String(k).startsWith('qm_'))return false;const d=rooms[k]||{},ps=d.players||{},ids=Object.keys(ps);
    return ids.length===1&&!ps[myId]&&now-(Number(ps[ids[0]]&&ps[ids[0]].ts)||0)<120000&&!(d.gameStart&&d.gameStart.status==='start');
  });
  const name=cand.length?cand[Math.floor(Math.random()*cand.length)]:'qm_'+Math.random().toString(36).slice(2,8);
  const mine={name,t0:Date.now(),timer:null,joinedExisting:cand.length>0};
  $('pvpRoomName').value=name;joinPvpRoom(false);
  qm=mine;
  mine.timer=setInterval(async()=>{
    if(qm!==mine)return clearInterval(mine.timer);
    if(typeof pvpMode!=='undefined'&&pvpMode){return cancelQm()}                    // 이미 전투 중
    if(pvpRoom!==mine.name){return cancelQm()}                                      // 방을 나갔어요
    const ps=(pvpData&&pvpData.players)||{},ids=Object.keys(ps);
    if(ids.length>=2){
      qmStatus('🎲 상대를 찾았어요! 곧 시작해요');
      if(!(ps[myId]&&ps[myId].ready))pvpReadyToggle();
      if(pvpIsHost()&&ids.every(id=>ps[id].ready)){clearInterval(mine.timer);qm=null;qmStatus('');startPvpGame()}
      return;
    }
    // 혼자 기다리는 중: 다른 대기 방이 더 앞 이름이면 그쪽으로 합쳐요 (서로 다른 방을 만들어 놓고 못 만나는 일을 막아요)
    if(Date.now()-mine.t0>2500&&Date.now()-mine.t0<mine.t0+QM_WAIT_MS){
      try{
        const rs=(await dbRef('pvpRooms').limitToLast(50).get()).val()||{},t=Date.now();
        const other=Object.keys(rs).filter(k=>k!==mine.name&&String(k).startsWith('qm_')&&k<mine.name&&Object.keys((rs[k]&&rs[k].players)||{}).length===1&&t-(Number(Object.values(rs[k].players)[0].ts)||0)<120000).sort()[0];
        if(other&&qm===mine){mine.name=other;mine.t0=Date.now();$('pvpRoomName').value=other;joinPvpRoom(false);return}
      }catch(e){}
    }
    const left=Math.max(0,Math.ceil((QM_WAIT_MS-(Date.now()-mine.t0))/1000));
    qmStatus('🎲 상대를 찾는 중... '+left+'초');
    if(Date.now()-mine.t0>=QM_WAIT_MS){
      clearInterval(mine.timer);qm=null;qmStatus('');
      try{leavePvpRoom(true)}catch(e){}
      try{msg('🤖 상대가 없어서 AI와 매칭됐어요!')}catch(e){}startAiDuel(aiLevelFor());
    }
  },1000);
}
setTimeout(()=>{
  try{
    const lb=document.querySelector('button[onclick="loadPvpRooms()"]');if(!lb||$('qmBtn'))return;
    const q=document.createElement('button');q.id='qmBtn';q.className='purple';q.textContent='🎲 랜덤 대전';q.onclick=quickMatch;
    const a=document.createElement('button');a.className='gold';a.textContent='🤖 AI 대전';a.onclick=showAiRoster;
    const st=document.createElement('div');st.id='qmStatus';st.className='small';st.style.margin='4px 0';
    lb.insertAdjacentElement('afterend',q);q.insertAdjacentElement('afterend',a);a.insertAdjacentElement('afterend',st);
  }catch(e){}
},400);

/* ----- 🤖 AI 동료 (협동): 방에 사람이 나뿐이면 AI 동료 2명이 함께 싸워요. 사람이 들어오면 떠나요 ----- */
let aiAllies=[],_allyMsg=false;
function coopAloneNow(){return typeof coopMode!=='undefined'&&coopMode&&run&&online&&db&&room&&player&&enemy&&Object.keys(peerPlayers||{}).length===0}
{const _uc=upd;upd=function(dt){
  const r=_uc.apply(this,arguments);
  try{
    if(!coopAloneNow()){if(aiAllies.length){aiAllies=[];_allyMsg=false}return r}
    if(!aiAllies.length){
      const day=Number(KST().slice(2));
      aiAllies=[0,1].map(i=>{const c=chars[(day*5+i*13+3)%chars.length];return {c,name:'🤖 '+c.name,a:i*Math.PI,t:1+i*.7}});
      if(!_allyMsg){_allyMsg=true;msg('🤖 AI 동료 2명이 함께해요! (친구가 들어오면 떠나요)')}
    }
    aiAllies.forEach((al,i)=>{
      al.a+=dt*1.1;al.x=player.x+Math.cos(al.a)*70;al.y=player.y+Math.sin(al.a)*48-10;
      al.t-=dt;
      if(al.t<=0&&enemy.hp>0){
        al.t=1.2+Math.random()*.5;
        const d=Math.max(1,player.atk*.28*(.8+Math.random()*.4));
        try{const p=sendCoopDamage(d,'#a5b4fc','','🤖');if(p&&p.catch)p.catch(()=>{})}catch(e){}
        effects.push([enemy.x+(i?18:-18),enemy.y-22,.4,'#a5b4fc',Math.floor(d)]);
      }
    });
  }catch(e){}
  return r;
}}
{const _dd=draw;draw=function(){
  _dd();
  try{if(!ctx||!aiAllies.length||!coopAloneNow())return;aiAllies.forEach(al=>{ctx.save();ctx.globalAlpha=.85;ctx.beginPath();ctx.fillStyle=al.c.color;ctx.arc(al.x,al.y,22,0,7);ctx.fill();ctx.font='22px Arial';ctx.textAlign='center';ctx.fillText(al.c.emoji,al.x,al.y+8);ctx.fillStyle='#c7d2fe';ctx.font='11px Arial';ctx.fillText('AI',al.x,al.y-26);ctx.restore()})}catch(e){}
}}
