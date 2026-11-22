/* ===================== 프리미엄 (1단계: 결제 없이 관리자 지급) ===================== */
// 데이터: anime/premium/<닉네임> = {until(0=영구 또는 만료 시각), titles:{id:true}, deco:{title,nameColor,frame,bio}}
// until·titles는 관리자만, deco는 프리미엄 본인만 규칙으로 쓸 수 있어요. 능력치·보상에는 영향이 없어요.
let premiumMap={};
const PREM_TITLES={pioneer:'🌱 개척자',patron:'💎 후원자',guardian:'✨ 별빛 수호자',veteran:'🏅 베테랑'};
const PREM_COLORS=['#ffffff','#ff9ecb','#ffd86b','#8be9fd','#b8ff9f','#c4a1ff','#ff8a8a'];
const PREM_AURAS={none:'없음',gold:'✨ 황금',blue:'🌊 푸른 물결',pink:'🌸 분홍',rainbow:'🌈 무지개'};
const PREM_FRAMES={none:['',''],laurel:['🌿','🌿'],star:['⭐','⭐'],flame:['🔥','🔥'],crown:['👑','']};
function premActive(n){const m=premiumMap[n];return !!(m&&typeof m.until==='number'&&(m.until===0||m.until>Date.now()))}
function premDaysLeft(m){return m.until===0?'영구':Math.max(0,Math.ceil((m.until-Date.now())/864e5))+'일 남음'}
function premLabel(name){
  const n=String(name||'');
  if(!premActive(n))return `<span class="chatName">${n}</span>`;
  const d=(premiumMap[n].deco)||{},col=/^#[0-9a-f]{6}$/.test(d.nameColor||'')?d.nameColor:'#fde68a';
  const f=PREM_FRAMES[d.frame]||PREM_FRAMES.none,t=PREM_TITLES[d.title]||'';
  return `${f[0]}<b style="color:${col}">${n}</b>${f[1]}${t?`<span class="premTitle">${t}</span>`:''}`;
}
function premPreview(){
  const e=$('premPreviewBox');if(!e||!$('premTitle'))return;
  const sw=document.querySelector('#premSwatches .swatch.on'),col=sw?sw.dataset.c:'#fde68a',f=PREM_FRAMES[$('premFrame').value]||PREM_FRAMES.none,t=PREM_TITLES[$('premTitle').value]||'';
  const bio=String($('premBio').value||'').replace(/[<>&"']/g,'');
  e.innerHTML=`${f[0]}<b style="color:${col}">${String(user).replace(/[<>&"']/g,'')}</b>${f[1]}${t?`<span class="premTitle">${t}</span>`:''}${bio?`<div class="small">“${bio}”</div>`:''}`;
}
function premPickColor(c){document.querySelectorAll('#premSwatches .swatch').forEach(b=>b.classList.toggle('on',b.dataset.c===c));premPreview()}
let premDirty=false;
function renderPremium(){
  const st=$('premStatus');if(!st)return;
  if(user==='guest'){st.textContent='로그인하면 볼 수 있어요';return}
  const m=premiumMap[user],act=premActive(user),ed=$('premEdit');
  if(!act){
    st.innerHTML=m&&m.until!==undefined?'프리미엄 기간이 끝났어요. 받은 칭호는 그대로 남아 있어요.':'일반 회원이에요. 프리미엄은 현재 관리자만 지급할 수 있어요.';
    if(ed)ed.style.display='none';return;
  }
  const ts=Object.keys(m.titles||{}).filter(k=>PREM_TITLES[k]);
  st.innerHTML=`💎 <b>프리미엄 회원</b> · ${premDaysLeft(m)}<br>받은 칭호: ${ts.length?ts.map(k=>PREM_TITLES[k]).join(', '):'아직 없어요'}`;
  if(!ed)return;ed.style.display='';
  if(premDirty)return;
  const d=m.deco||{};
  $('premTitle').innerHTML='<option value="">칭호 없음</option>'+ts.map(k=>`<option value="${k}">${PREM_TITLES[k]}</option>`).join('');
  $('premTitle').value=ts.includes(d.title)?d.title:'';
  $('premSwatches').innerHTML=PREM_COLORS.map(c=>`<button class="swatch" data-c="${c}" style="background:${c}" onclick="premDirty=true;premPickColor('${c}')"></button>`).join('');
  premPickColor(PREM_COLORS.includes(d.nameColor)?d.nameColor:PREM_COLORS[0]);
  $('premFrame').value=PREM_FRAMES[d.frame]?d.frame:'none';
  $('premAura').value=PREM_AURAS[d.aura]?d.aura:'none';
  $('premBio').value=d.bio||'';
  premPreview();
}
async function savePremDeco(){
  if(!premActive(user))return alert('프리미엄 회원만 쓸 수 있어요.');
  const sw=document.querySelector('#premSwatches .swatch.on'),deco={nameColor:sw?sw.dataset.c:PREM_COLORS[0],frame:$('premFrame').value||'none',aura:$('premAura').value||'none',bio:String($('premBio').value||'').replace(/[<>&"']/g,'').trim().slice(0,30)};
  if($('premTitle').value)deco.title=$('premTitle').value;
  try{await dbRef('premium/'+safeKey(user)+'/deco').set(deco);premDirty=false;alert('저장했어요!')}
  catch(e){alert('저장하지 못했어요: '+(e.code||e.message))}
}
// ----- 능력치 혜택: 프리미엄은 몬스터·던전·협동 전투에서 체력·공격 +5% (PvP·랭크전 제외) -----
const PREM_BUFF=0.05;
function applyPremBuff(){
  try{
    if(typeof player==='undefined'||!player||player._pb||pvpMode||!premActive(user))return;
    player._pb=1;const k=1+PREM_BUFF;
    player.hp=Math.round(player.hp*k);player.max=Math.round(player.max*k);player.atk=Math.round(player.atk*k);
  }catch(e){}
}
['setup','setupDungeonBattle','startOnlineRoomLocal'].forEach(f=>{
  const o=window[f];if(typeof o!=='function')return;
  window[f]=function(){const r=o.apply(this,arguments);applyPremBuff();return r};
});
// ----- 캐릭터 오라: 전투 중 내 캐릭터 주변 효과 (꾸미기만, 능력치 없음) -----
function drawPremAura(o){
  const m=premiumMap[user],a=m&&m.deco&&m.deco.aura;
  if(!a||a==='none'||!PREM_AURAS[a]||!premActive(user))return;
  const t=Date.now()/400,col=a==='gold'?'#ffd86b':a==='blue'?'#60a5fa':a==='pink'?'#ff9ecb':`hsl(${(Date.now()/8)%360},90%,65%)`;
  ctx.save();ctx.strokeStyle=col;ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=22;ctx.lineWidth=3;
  for(let i=0;i<2;i++){ctx.globalAlpha=.55-i*.2;ctx.beginPath();ctx.arc(o.x,o.y,o.r+10+i*9+Math.sin(t+i)*3,0,7);ctx.stroke()}
  ctx.globalAlpha=.9;
  for(let i=0;i<5;i++){const g=t*.8+i*1.2566;ctx.beginPath();ctx.arc(o.x+Math.cos(g)*(o.r+22),o.y+Math.sin(g)*(o.r+22),2.5,0,7);ctx.fill()}
  ctx.restore();
}
{const _dc=drawC;drawC=function(o){try{if(typeof player!=='undefined'&&o===player)drawPremAura(o)}catch(e){}return _dc.apply(this,arguments)}}
// ----- 관리자: 지급 / 해제 / 조회 (닉네임 앞뒤 공백은 자동으로 지워요) -----
async function adminPremGrant(){
  if(!isAdmin())return alert('권한이 없어요.');
  const n=safeKey($('premTarget').value.trim()),days=Number($('premDays').value),t=$('premTitleSel').value;
  if(!n)return alert('닉네임을 입력해 주세요.');
  if(!(await nickExists(n)))return alert('없는 계정이야.');
  if(!Number.isFinite(days)||days<0||days>3650)return alert('기간은 0(영구)~3650일로 입력해 주세요.');
  try{
    const cur=(await dbRef('premium/'+n).get()).val()||{};
    const base=Math.max(Date.now(),typeof cur.until==='number'?cur.until:0);
    const until=(days===0||cur.until===0)?0:base+days*864e5;
    await dbRef('premium/'+n).update({until,['titles/'+t]:true});
    adminPremInfo();alert(`${n}님에게 프리미엄을 ${days===0?'영구':days+'일'} 지급했어요.`);
  }catch(e){alert('지급하지 못했어요: '+(e.code||e.message))}
}
// ----- 관리자: 이벤트 뿌리기 (전체 또는 최근 접속자에게 프리미엄 + 칭호) -----
async function adminPremEvent(){
  if(!isAdmin())return alert('권한이 없어요.');
  const t=$('premEvTitle').value,days=Math.floor(Number($('premEvDays').value)),recent=Math.floor(Number($('premEvRecent').value)||0),info=$('premEvInfo');
  if(!PREM_TITLES[t])return alert('칭호를 골라 주세요.');
  if(!Number.isFinite(days)||days<1||days>365)return alert('기간은 1~365일로 입력해 주세요.');
  if(recent<0||recent>3650)return alert('최근 접속 기간은 0~3650일로 입력해 주세요.');
  let users;
  try{users=(await dbRef('users').get()).val()||{}}catch(e){return alert('유저 목록을 불러오지 못했어요: '+(e.code||e.message))}
  const now=Date.now();
  const names=Object.keys(users).filter(n=>recent<=0||now-(Number(users[n]&&users[n].ts)||0)<=recent*864e5);
  if(!names.length)return alert('조건에 맞는 유저가 없어요.');
  if(names.length>500)return alert('대상이 '+names.length+'명이에요. 한 번에 500명까지만 지급할 수 있어요. 최근 접속 기간을 줄여 주세요.');
  if(!confirm(names.length+'명에게 프리미엄 '+days+'일과 「'+PREM_TITLES[t]+'」 칭호를 지급할까요?\n(되돌리려면 한 명씩 해제해야 해요)'))return;
  const ups=names.map(n=>{
    const cur=premiumMap[n]||{},base=Math.max(now,typeof cur.until==='number'?cur.until:0);
    return [n,cur.until===0?0:base+days*864e5];
  });
  let done=0;
  try{
    for(let i=0;i<ups.length;i+=100){
      const part={};
      ups.slice(i,i+100).forEach(([n,until])=>{part[n+'/until']=until;part[n+'/titles/'+t]=true});
      await dbRef('premium').update(part);done+=Math.min(100,ups.length-i);
      if(info)info.textContent='지급 중... '+done+' / '+ups.length;
    }
  }catch(e){if(info)info.textContent='중간에 멈췄어요('+done+'명 완료): '+(e.code||e.message);return alert('지급하지 못했어요: '+(e.code||e.message))}
  if(info)info.textContent='✅ '+done+'명에게 지급 완료';
  try{if(typeof adminNoticeTextAuto==='function')adminNoticeTextAuto('🎉 이벤트! 모두에게 프리미엄 '+days+'일과 「'+PREM_TITLES[t]+'」 칭호를 선물했어요!')}catch(e){}
  alert(done+'명에게 지급했어요!');
}
async function adminPremRevoke(){
  if(!isAdmin())return alert('권한이 없어요.');
  const n=safeKey($('premTarget').value.trim());if(!n)return alert('닉네임을 입력해 주세요.');
  if(!confirm(n+'님의 프리미엄을 해제(만료 처리)할까요?'))return;
  try{await dbRef('premium/'+n+'/until').set(1);adminPremInfo();alert('해제했어요.')}catch(e){alert('해제하지 못했어요: '+(e.code||e.message))}
}
async function adminPremInfo(){
  const n=safeKey($('premTarget').value.trim()),box=$('premAdminInfo');if(!box)return;
  if(!n){box.textContent='닉네임을 입력해 주세요.';return}
  try{
    const m=(await dbRef('premium/'+n).get()).val();
    if(!m){box.textContent=n+': 프리미엄 기록 없음';return}
    const act=typeof m.until==='number'&&(m.until===0||m.until>Date.now());
    box.innerHTML=`<b>${escH(n)}</b>: ${act?'💎 프리미엄 ('+premDaysLeft(m)+')':'만료됨'}<br>칭호: ${Object.keys(m.titles||{}).map(k=>PREM_TITLES[k]||k).join(', ')||'없음'}`;
  }catch(e){box.textContent='조회하지 못했어요: '+(e.code||e.message)}
}

const _uapPrem=updateAdminPanel;updateAdminPanel=function(){_uapPrem();try{renderPremium()}catch(e){}};

