/* ===================== 💌 개인 쪽지 (받은 사람만 읽을 수 있고, 30일 뒤 지워져요) ===================== */
const DM_DAYS=30;
let dmRef=null,dmCache={},dmKnown=null,lastDmAt=0;
function dmSeenTs(){try{return Number(localStorage.getItem('dmSeen_'+user))||0}catch(e){return 0}}
function dmVisible(){return Object.keys(dmCache).map(k=>({k,...dmCache[k]})).filter(m=>m&&m.from&&m.msg&&!(typeof isBlocked==='function'&&isBlocked(m.from))).sort((a,b)=>(b.ts||0)-(a.ts||0))}
function dmUnread(){const t=dmSeenTs();return dmVisible().filter(m=>(m.ts||0)>t).length}
function updateDmBadge(){
  const n=dmUnread(),b=$('dmBadge');if(b)b.textContent=n?'('+n+'개 새 쪽지)':'';
  const tb=$('tab_online');if(tb){if(tb.dataset.base===undefined)tb.dataset.base=tb.textContent;tb.textContent=tb.dataset.base+(n?' 💌'+n:'')}
}
function renderDm(){
  const box=$('dmList');if(!box)return;
  if(user==='guest'){box.textContent='로그인하면 받은 쪽지를 볼 수 있어요.';return}
  const list=dmVisible().slice(0,30);
  box.innerHTML=list.length?list.map(m=>`<div style="padding:8px 10px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.07)"><b>${adminLabel(m.from)}</b> <small style="color:#9ca3af">· ${m.ts?new Date(m.ts).toLocaleString():''}</small><div style="margin:6px 0;white-space:pre-wrap;word-break:break-word">${escH(m.msg)}</div><button class="blue" onclick="dmReply('${encodeURIComponent(m.from).replace(/'/g,'%27')}')">답장</button> <button class="red" onclick="dmReport('${encodeURIComponent(m.k).replace(/'/g,'%27')}')">🚨 신고</button> <button class="gold" onclick="dmBlock('${encodeURIComponent(m.from).replace(/'/g,'%27')}')">🚫 차단</button> <button onclick="dmDelete('${encodeURIComponent(m.k).replace(/'/g,'%27')}')">🗑 삭제</button></div>`).join(''):'받은 쪽지가 없어요.';
  updateDmBadge();
}
function stopDm(){if(dmRef){try{dmRef.off()}catch(e){}dmRef=null}dmCache={};dmKnown=null;renderDm();updateDmBadge()}
function startDm(){
  stopDm();
  if(user==='guest'||!online||!db||!auth||!auth.currentUser)return;
  dmRef=dbRef('dm/'+safeKey(user)).limitToLast(60);
  dmRef.on('value',s=>{
    dmCache=s.val()||{};
    const keys=Object.keys(dmCache);
    if(dmKnown){keys.filter(k=>!dmKnown.has(k)).forEach(k=>{const m=dmCache[k];if(m&&m.from&&!(typeof isBlocked==='function'&&isBlocked(m.from))){try{msg('💌 새 쪽지: '+String(m.from).replace(/[<>&"']/g,''));sfx('coin')}catch(e){}}})}
    dmKnown=new Set(keys);
    renderDm();
    // 30일이 지난 쪽지는 내 쪽지함에서 지워요
    const cut=Date.now()-DM_DAYS*864e5,old=keys.filter(k=>Number(dmCache[k]&&dmCache[k].ts)>0&&dmCache[k].ts<cut);
    if(old.length){const part={};old.forEach(k=>{part[k]=null});dbRef('dm/'+safeKey(user)).update(part).catch(()=>{})}
  },()=>{});
}
async function sendDm(){
  if(user==='guest')return alert('로그인 후 보낼 수 있어요.');
  if(!online||!db)return alert('온라인 연결이 필요해요.');
  if(typeof isBanned==='function'&&isBanned())return alert('이용이 정지된 계정은 쪽지를 보낼 수 없어요.');
  if(typeof isMuted==='function'&&isMuted())return alert('채팅이 금지된 계정은 쪽지를 보낼 수 없어요.');
  const to=safeKey(String($('dmTo').value||'').trim()),msgText=String($('dmMsg').value||'').trim();
  if(!to)return alert('받는 사람 닉네임을 적어 주세요.');
  if(to===safeKey(user))return alert('나에게는 보낼 수 없어요.');
  if(msgText.length<1)return alert('쪽지 내용을 적어 주세요.');
  if(msgText.length>200)return alert('쪽지는 200자까지 보낼 수 있어요.');
  if(Date.now()-lastDmAt<3000)return alert('너무 빨라요. 잠시 후 다시 보내 주세요.');
  try{
    if(!(await dbRef('names/'+to).get()).exists())return alert('없는 닉네임이에요.');
    await dbRef('dm/'+to).push({from:user,msg:msgText,ts:Date.now()});
    lastDmAt=Date.now();$('dmMsg').value='';alert('쪽지를 보냈어요! 💌');
  }catch(e){alert('보내지 못했어요: '+(e.code||e.message))}
}
function dmReply(enc){const e=$('dmTo');if(e){e.value=decodeURIComponent(enc);const m=$('dmMsg');if(m)m.focus()}}
async function dmDelete(enc){
  try{await dbRef('dm/'+safeKey(user)+'/'+decodeURIComponent(enc)).remove()}catch(e){alert('지우지 못했어요: '+(e.code||e.message))}
}
async function dmReport(enc){
  const k=decodeURIComponent(enc),m=dmCache[k];if(!m)return;
  if(!confirm('"'+String(m.from)+'"님의 이 쪽지를 신고할까요? 쪽지 내용이 운영자에게 전달돼요.'))return;
  try{
    await dbRef('reports/'+safeKey(user+'_dm_'+k)).set({by:user,target:m.from,reason:'쪽지',msg:String(m.msg).slice(0,200),key:k,ts:Date.now()});
    alert('신고했어요. 운영자가 확인할게요.');
  }catch(e){alert('신고하지 못했어요: '+(e.code||e.message))}
}
function dmBlock(enc){const n=decodeURIComponent(enc);if(confirm('"'+n+'"님을 차단할까요? 차단하면 이 사람의 쪽지와 채팅이 보이지 않아요.')){blockUser(n);renderDm()}}
{const _fl=finishLogin;finishLogin=async function(n,uid){const r=await _fl(n,uid);try{startDm()}catch(e){}return r}}
{const _rg=resetToGuest;resetToGuest=function(){try{stopDm()}catch(e){}return _rg.apply(this,arguments)}}
{const _st=showTab;showTab=function(id){_st(id);if(id==='online'){try{localStorage.setItem('dmSeen_'+user,String(Date.now()))}catch(e){}renderDm()}}}
