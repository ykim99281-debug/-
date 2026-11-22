/* ===================== 재미·첫 5분·통계: 타격감, 오늘의 목표, 튜토리얼, 이용 기록 ===================== */
const CUR='{{COIN}}';
const KST=()=>new Date(Date.now()+9*36e5).toISOString().slice(0,10).replace(/-/g,'');
let sfxOn=true;try{sfxOn=localStorage.getItem('sfxOff')!=='1'}catch(e){}
let _ac=null;
function sfx(kind){
  if(!sfxOn)return;
  try{
    _ac=_ac||new (window.AudioContext||window.webkitAudioContext)();
    if(_ac.state==='suspended')_ac.resume();
    const t=_ac.currentTime,tone=(f,d,type,v,at)=>{const o=_ac.createOscillator(),g=_ac.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t+(at||0));g.gain.setValueAtTime(v||.05,t+(at||0));g.gain.exponentialRampToValueAtTime(.0001,t+(at||0)+d);o.connect(g);g.connect(_ac.destination);o.start(t+(at||0));o.stop(t+(at||0)+d+.02)};
    if(kind==='hit')tone(180,.07,'square',.05);
    else if(kind==='crit'){tone(520,.08,'square',.06);tone(780,.1,'triangle',.06,.06)}
    else if(kind==='skill'){tone(300,.18,'sawtooth',.05);tone(450,.15,'triangle',.05,.07)}
    else if(kind==='win'){[523,659,784,1046].forEach((f,i)=>tone(f,.14,'triangle',.06,i*.09))}
    else if(kind==='coin')tone(880,.08,'triangle',.05);
  }catch(e){}
}
function toggleSfx(){sfxOn=!sfxOn;try{localStorage.setItem('sfxOff',sfxOn?'0':'1')}catch(e){}renderQuests();if(sfxOn)sfx('coin')}

/* ----- 타격감: 연속 공격 콤보, 치명타, 화면 흔들림 ----- */
let comboN=0,lastHitAt=0,comboHide=null;
function shake(px){
  try{if(typeof GS!=='undefined'&&!GS.shake)return;const c=$('cv');if(!c)return;let i=0;const it=setInterval(()=>{i++;c.style.transform=i>=5?'':`translate(${(Math.random()-.5)*px}px,${(Math.random()-.5)*px}px)`;if(i>=5)clearInterval(it)},24)}catch(e){}
}
function showCombo(n,crit){
  let e=$('comboTxt');
  if(!e){e=document.createElement('div');e.id='comboTxt';e.style.cssText='position:fixed;top:17%;left:50%;transform:translateX(-50%);z-index:60;font-weight:900;font-size:30px;color:#fde047;text-shadow:0 3px 14px #000,0 0 18px #f59e0b;pointer-events:none;transition:opacity .25s';document.body.appendChild(e)}
  e.textContent=(crit?'💥 치명타! ':'')+(n>=2?'🔥 '+n+'콤보':'');e.style.opacity=(crit||n>=2)?'1':'0';
  clearTimeout(comboHide);comboHide=setTimeout(()=>{e.style.opacity='0'},1500);
}
function featHit(dmg){
  if(typeof pvpMode!=='undefined'&&pvpMode||typeof coopMode!=='undefined'&&coopMode||!enemy||!(dmg>0))return;
  const now=Date.now();
  comboN=(now-lastHitAt<1800)?comboN+1:1;lastHitAt=now;
  let extra=0;const crit=Math.random()<.15;
  if(crit)extra+=dmg*.5;
  if(comboN>=3)extra+=dmg*Math.min(.2,(comboN-2)*.02);
  if(extra>0)enemy.hp-=extra;
  if(crit)effects.push([enemy.x,enemy.y-34,.6,'#facc15','치명타! '+Math.floor(dmg+extra)]);
  if(crit&&typeof achAdd==='function')achAdd('crits',1);if(crit&&typeof wqAdd==='function')wqAdd('crit',1);if(crit&&typeof vib==='function')vib(30);if(typeof achMax==='function')achMax('maxCombo',comboN);
  showCombo(comboN,crit);
  if(crit||dmg>(player?player.atk*2:1e9)||comboN%5===0)shake(crit?9:5);
  sfx(crit?'crit':'hit');
  dqAdd('combo',comboN,true);
}
function featDelta(before){if(enemy&&before>enemy.hp)featHit(before-enemy.hp)}
{const _atk=attack;attack=function(){const b=enemy?enemy.hp:0;const r=_atk.apply(this,arguments);try{featDelta(b)}catch(e){}return r}}
{const _skl=skill;skill=function(n){const b=enemy?enemy.hp:0,b1=c1,b2=c2;const r=_skl.apply(this,arguments);
  try{if((n===1&&c1>b1)||(n===2&&c2>b2)){dqAdd('skills',1);sfx('skill');if(typeof pvpMode==='undefined'||!pvpMode)shake(4)}featDelta(b)}catch(e){}return r}}
{const _u=upd;upd=function(dt){
  if(typeof pvpMode!=='undefined'&&pvpMode||typeof coopMode!=='undefined'&&coopMode||!enemy){_u(dt);return}
  const b=enemy.hp,e0=enemy;_u(dt);try{if(enemy===e0)featDelta(b)}catch(e){}}}

/* ----- 오늘의 목표 (매일 새로) ----- */
const DQ=[{id:'kills',t:'몬스터 5마리 쓰러뜨리기',n:5,r:{coins:300}},{id:'skills',t:'기술 20번 쓰기',n:20,r:{dia:1}},{id:'combo',t:'3콤보 달성하기',n:3,r:{coins:200}}];
function dqState(){
  if(!save)return null;
  const d=KST();
  if(!save.dq||save.dq.d!==d)save.dq={d,p:{},c:{}};
  save.dq.p=save.dq.p||{};save.dq.c=save.dq.c||{};
  return save.dq;
}
let _dqT=null;
function dqAdd(id,v,max){
  const s=dqState();if(!s)return;
  const def=DQ.find(x=>x.id===id);if(!def)return;
  const cur=s.p[id]||0;s.p[id]=Math.min(def.n,max?Math.max(cur,v):cur+v);
  if(s.p[id]>=def.n&&cur<def.n)msg('🎯 목표 달성! 홈 탭에서 보상을 받아요');
  clearTimeout(_dqT);_dqT=setTimeout(()=>{try{store()}catch(e){}},8000);
  renderQuests();
}
function claimDQ(id){
  const s=dqState(),def=DQ.find(x=>x.id===id);if(!s||!def)return;
  if(typeof SERVER==='function'&&SERVER())return alert('서버 모드에서는 목표 보상이 잠시 쉬어요.');
  if(s.c[id]||(s.p[id]||0)<def.n)return;
  s.c[id]=1;
  if(def.r.coins){coins+=def.r.coins;save.coins=coins}
  if(def.r.dia){dia+=def.r.dia;save.dia=dia}
  store();sfx('coin');renderQuests();
}
function renderQuests(){
  const box=$('questList');if(!box)return;
  const s=dqState();if(!s){box.textContent='';return}
  box.innerHTML=DQ.map(q=>{
    const p=Math.min(q.n,s.p[q.id]||0),done=p>=q.n,got=!!s.c[q.id],rw=(q.r.coins?q.r.coins+' '+CUR:'')+(q.r.dia?'다이아 '+q.r.dia:'');
    return `<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.07)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span>${got?'✅':done?'🎁':'⬜'} <b>${q.t}</b> <small style="color:#9ca3af">(${p}/${q.n})</small></span>${got?'<small>받았어요</small>':done?`<button class="green" onclick="claimDQ('${q.id}')">${rw} 받기</button>`:`<small style="color:#9ca3af">보상: ${rw}</small>`}</div><div style="height:6px;margin-top:6px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden"><div style="height:100%;width:${p/q.n*100}%;background:linear-gradient(90deg,#f59e0b,#fde047)"></div></div></div>`;
  }).join('')+'<div class="small">목표는 매일 새로 바뀌어요 (한국시간 자정).</div>';
  const b=$('sfxBtn');if(b)b.textContent=sfxOn?'🔊 효과음 켜짐':'🔇 효과음 꺼짐';
}
{const _st=showTab;showTab=function(id){_st(id);if(id==='home')renderQuests()}}

/* ----- 첫 5분: 튜토리얼 + 쉬운 첫 승리 ----- */
function tutSeen(){try{return localStorage.getItem('tutDone')==='1'}catch(e){return false}}
function showTutorial(force,done){
  if(typeof storyOverlay!=='function'){if(done)done();return}
  const old=$('tutOv');if(old)old.remove();
  const quiz=typeof openQuiz==='function';
  const pages=[
    ['① 전투 시작','캐릭터를 고르고 <b>🔥 전투 시작</b>을 눌러요.<br>처음에는 몬스터가 약해서 쉽게 이길 수 있어요!'],
    ['② 움직이기','왼쪽 아래 <b>조이스틱</b>(컴퓨터는 <b>W A S D</b>)으로 움직여요.<br>몬스터에게 가까이 다가가 보세요.'],
    ['③ 공격과 기술','<b>공격</b> 버튼은 몬스터에 <b>가까이</b> 가서 눌러요.<br><b>기술1·기술2</b>는 멀리서도 맞고 더 강해요.<br>연속으로 맞히면 <b>🔥 콤보</b>와 <b>💥 치명타</b>가 터져요!<br>몬스터에 <b>⚠️ 붉은 경고</b>가 뜨면 옆으로 피하거나 <b>회피</b> 버튼을 눌러요. (세 번 이긴 뒤부터 나와요)'],
    ['④ 보상','몬스터를 쓰러뜨리면 <b>'+CUR+'</b>와 <b>다이아</b>를 받아요.'+(quiz?'<br>가끔 보너스 <b>퀴즈</b>가 나와요. 맞히면 상자를 열어요!':'')+'<br><b>🛒 상점</b>에서 새 캐릭터를 살 수 있어요.'],
    ['⑤ 성장과 목표','<b>🏠 홈</b> 탭에서 <b>🌱 내 성장</b>(레벨·출석·업적)과 <b>🎯 오늘의 목표</b>를 확인하고 선물을 받아요.<br>이상한 점은 <b>👤 계정 → 💬 의견 보내기</b>로 알려 주세요!']
  ];
  let i=0;
  const ov=storyOverlay('<div id="tutNo" style="font-size:13px;letter-spacing:3px;color:#c4b5fd"></div><h2 id="tutHead" style="margin:8px 0 12px;color:#fff;text-shadow:0 2px 12px #000"></h2><div id="tutText" style="font-size:18px;line-height:1.9;min-height:130px;color:#f5f3ff;text-shadow:0 2px 10px #000;word-break:keep-all"></div><div style="display:flex;gap:8px;justify-content:center;margin:14px 0 8px"><button id="tutPrev" class="blue">◀ 이전</button><button id="tutNext" class="purple">다음 ▶</button><button id="tutSkip" class="red">건너뛰기</button></div>',100003);
  ov.id='tutOv';
  const finish=()=>{try{localStorage.setItem('tutDone','1')}catch(e){}ov.remove();if(!force)msChk('tutDone');if(done)done()};
  const draw=()=>{ov.querySelector('#tutNo').textContent=(i+1)+' / '+pages.length;ov.querySelector('#tutHead').textContent=pages[i][0];ov.querySelector('#tutText').innerHTML=pages[i][1];
    ov.querySelector('#tutPrev').style.visibility=i>0?'visible':'hidden';ov.querySelector('#tutNext').textContent=i<pages.length-1?'다음 ▶':(force?'닫기':'시작하기!')};
  ov.querySelector('#tutPrev').onclick=()=>{if(i>0){i--;draw()}};
  ov.querySelector('#tutNext').onclick=()=>{if(i<pages.length-1){i++;draw()}else finish()};
  ov.querySelector('#tutSkip').onclick=finish;
  draw();
}
{const _sg=startGame;startGame=function(){
  if(!tutSeen()&&!$('tutOv')){showTutorial(false,()=>startGame());return}
  _sg.apply(this,arguments);msChk('firstBattle');
}}
let _hint=null;
{const _su=setup;setup=function(){
  const r=_su.apply(this,arguments);
  try{
    if(typeof pvpMode!=='undefined'&&pvpMode||typeof coopMode!=='undefined'&&coopMode||!save||typeof dungeonPlace!=='undefined'&&dungeonPlace)return r;
    comboN=0;
    if((save.wins||0)<3&&stage<=2&&enemy){enemy.hp*=.5;enemy.max*=.5;enemy.atk*=.5}    // 쉬운 첫 승리
    clearTimeout(_hint);
    if((save.wins||0)<2)_hint=setTimeout(()=>{if(typeof run!=='undefined'&&run&&enemy&&enemy.hp>=enemy.max*.99)msg('👉 몬스터에게 가까이 가서 [공격]을 눌러요!')},9000);
  }catch(e){}
  return r;
}}
{const _sc=onStageClear;onStageClear=function(rw,dr,bl){
  _sc.apply(this,arguments);
  try{
    sfx('win');
    const first=!(save.wins>0);save.wins=(save.wins||0)+1;
    dqAdd('kills',1);
    if(first&&!(typeof SERVER==='function'&&SERVER())){coins+=300;dia+=1;save.coins=coins;save.dia=dia;store();setTimeout(()=>msg('🎉 첫 승리 선물! '+CUR+' 300 + 다이아 1'),900)}
    msChk('firstWin');if(best>=5)msChk('stage5');if(best>=10)msChk('stage10');
  }catch(e){}
}}

/* ----- 이용 기록(통계): 날짜별 접속 + 진행 단계 (개인정보 없이, 닉네임과 시각만) ----- */
const MS_KEYS=['tutDone','firstBattle','firstWin','stage5','stage10','quiz','feedback'];
function msChk(key){
  try{
    if(user==='guest'||!online||!db||!auth||!auth.currentUser||!save)return;
    save.ms=save.ms||{};if(save.ms[key])return;
    save.ms[key]=Date.now();
    dbRef('stats/milestones/'+safeKey(user)+'/'+key).set(save.ms[key]).catch(()=>{});
  }catch(e){}
}
let _loggedDay='';
function logDaily(){
  try{
    if(user==='guest'||!online||!db||!auth||!auth.currentUser)return;
    const d=KST();if(_loggedDay===d)return;_loggedDay=d;
    dbRef('stats/daily/'+d+'/'+safeKey(user)).set(true).catch(()=>{});
  }catch(e){}
}
{const _fl=finishLogin;finishLogin=async function(n,uid){const r=await _fl(n,uid);try{logDaily();renderQuests()}catch(e){}return r}}
setInterval(()=>{try{logDaily()}catch(e){}},300000);
if(typeof sendFeedback==='function'){const _sf=sendFeedback;sendFeedback=async function(){const b=typeof lastFeedAt!=='undefined'?lastFeedAt:0;const r=await _sf.apply(this,arguments);try{if(typeof lastFeedAt!=='undefined'&&lastFeedAt!==b)msChk('feedback')}catch(e){}return r}}
if(typeof openQuiz==='function'){const _oq=openQuiz;openQuiz=function(){msChk('quiz');return _oq.apply(this,arguments)}}
setTimeout(renderQuests,600);

/* ----- 관리자: 통계 보기 ----- */
async function adminStats(){
  if(!isAdmin())return alert('권한이 없어요.');
  const box=$('statsInfo');if(!box)return;box.textContent='불러오는 중...';
  try{
    const [dailyS,msS,namesS,fbS]=await Promise.all([dbRef('stats/daily').limitToLast(30).get(),dbRef('stats/milestones').get(),dbRef('names').get(),dbRef('feedback').get()]);
    const daily=dailyS.val()||{},ms=msS.val()||{},names=Object.keys(namesS.val()||{}).length,fb=Object.keys(fbS.val()||{}).length;
    const days=Object.keys(daily).sort().slice(-7).reverse();
    const cnt={};MS_KEYS.forEach(k=>{cnt[k]=0});Object.values(ms).forEach(u=>{MS_KEYS.forEach(k=>{if(u&&u[k])cnt[k]++})});
    const L={tutDone:'튜토리얼 끝냄',firstBattle:'첫 전투',firstWin:'첫 승리',stage5:'5스테이지 도달',stage10:'10스테이지 도달',quiz:'퀴즈 만남',feedback:'의견 보냄'};
    const pct=n=>names?Math.round(n/names*100)+'%':'-';
    box.innerHTML=`<div style="margin:6px 0"><b>가입자 ${names}명</b> · 받은 의견 ${fb}개</div><div><b>최근 접속자 (날짜별)</b></div>${days.length?days.map(d=>`<div>${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)} : <b>${Object.keys(daily[d]||{}).length}명</b></div>`).join(''):'<div>아직 기록이 없어요</div>'}<div style="margin-top:8px"><b>어디까지 왔는지</b> (가입자 대비)</div>${MS_KEYS.map(k=>`<div>${L[k]} : ${cnt[k]}명 (${pct(cnt[k])})</div>`).join('')}<div class="small" style="margin-top:6px">기록이 시작된 뒤에 접속한 유저만 집계돼요.</div>`;
  }catch(e){box.textContent='불러오지 못했어요. ('+(e.code||e.message)+')'}
}
