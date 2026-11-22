/* ===================== 프리미엄 (1단계: 결제 없이 관리자 지급) ===================== */
// 데이터: anime/premium/<닉네임> = {until(0=영구 또는 만료 시각), titles:{id:true}, deco:{title,nameColor,frame,bio}}
// until·titles는 관리자만, deco는 프리미엄 본인만 규칙으로 쓸 수 있어요. 능력치·보상에는 영향이 없어요.
let premiumMap={};
const PREM_TITLES={pioneer:'🌱 개척자',patron:'💎 후원자',guardian:'✨ 별빛 수호자',veteran:'🏅 베테랑'};
const PREM_COLORS=['#ffffff','#ff9ecb','#ffd86b','#8be9fd','#b8ff9f','#c4a1ff','#ff8a8a'];
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
  $('premBio').value=d.bio||'';
  premPreview();
}
async function savePremDeco(){
  if(!premActive(user))return alert('프리미엄 회원만 쓸 수 있어요.');
  const sw=document.querySelector('#premSwatches .swatch.on'),deco={nameColor:sw?sw.dataset.c:PREM_COLORS[0],frame:$('premFrame').value||'none',bio:String($('premBio').value||'').replace(/[<>&"']/g,'').trim().slice(0,30)};
  if($('premTitle').value)deco.title=$('premTitle').value;
  try{await dbRef('premium/'+safeKey(user)+'/deco').set(deco);premDirty=false;alert('저장했어요!')}
  catch(e){alert('저장하지 못했어요: '+(e.code||e.message))}
}
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

