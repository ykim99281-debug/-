/* ===================== 📆 주간 도전 (매주 월요일 0시, 한국시간에 새로) + ⚙️ 설정 ===================== */
const WQ_MS=7*864e5,WQ_OFF=4*864e5-9*36e5;
const wqWeek=()=>Math.floor((Date.now()-WQ_OFF)/WQ_MS);
const wqEnd=()=>(wqWeek()+1)*WQ_MS+WQ_OFF;
const WQ=[{id:'kills',t:'몬스터 40마리 쓰러뜨리기',n:40,r:{d:3}},{id:'skills',t:'기술 150번 쓰기',n:150,r:{c:1000}},{id:'crit',t:'치명타 40번',n:40,r:{d:2}}];
function wqState(){
  if(!save)return null;
  const w=wqWeek();if(!save.wq||save.wq.w!==w)save.wq={w,p:{},c:{}};
  save.wq.p=save.wq.p||{};save.wq.c=save.wq.c||{};return save.wq;
}
let _wqT=null;
function wqAdd(id,v){
  const s=wqState();if(!s)return;const d=WQ.find(x=>x.id===id);if(!d)return;
  const cur=s.p[id]||0;s.p[id]=Math.min(d.n,cur+v);
  if(s.p[id]>=d.n&&cur<d.n){try{msg('📆 주간 도전 달성! 홈 탭에서 보상을 받아요')}catch(e){}}
  clearTimeout(_wqT);_wqT=setTimeout(()=>{try{store()}catch(e){}},8000);renderWeekly();
}
{const _dq=dqAdd;dqAdd=function(id,v,max){const r=_dq.apply(this,arguments);try{if(id==='kills'||id==='skills')wqAdd(id,v)}catch(e){}return r}}
function claimWq(id){
  const s=wqState(),d=WQ.find(x=>x.id===id);if(!s||!d)return;
  if(typeof SERVER==='function'&&SERVER())return alert('서버 모드에서는 주간 도전 보상이 잠시 쉬어요.');
  if(s.c[id]||(s.p[id]||0)<d.n)return;
  s.c[id]=1;if(d.r.c){coins+=d.r.c;save.coins=coins}if(d.r.d){dia+=d.r.d;save.dia=dia}
  store();sfx('coin');renderWeekly();
}
function renderWeekly(){
  const box=$('weeklyList');if(!box)return;const s=wqState();if(!s)return;
  const left=Math.max(0,wqEnd()-Date.now()),dd=Math.floor(left/864e5),hh=Math.floor(left%864e5/36e5);
  box.innerHTML=WQ.map(q=>{const p=Math.min(q.n,s.p[q.id]||0),done=p>=q.n,got=!!s.c[q.id],rw=(q.r.c?q.r.c+' '+CUR2:'')+(q.r.d?'다이아 '+q.r.d:'');
    return `<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.07)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span>${got?'✅':done?'🎁':'⬜'} <b>${q.t}</b> <small style="color:#9ca3af">(${p}/${q.n})</small></span>${got?'<small>받았어요</small>':done?`<button class="green" onclick="claimWq('${q.id}')">${rw} 받기</button>`:`<small style="color:#9ca3af">보상: ${rw}</small>`}</div><div style="height:6px;margin-top:6px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden"><div style="height:100%;width:${p/q.n*100}%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></div></div></div>`}).join('')+`<div class="small">월요일 0시(한국시간)에 새로 바뀌어요. (${dd}일 ${hh}시간 남음)</div>`;
}
{const _st5=showTab;showTab=function(id){_st5(id);if(id==='home')renderWeekly();if(id==='account')renderSettings()}}
setTimeout(renderWeekly,800);

/* ----- 설정: 효과음·진동·화면 흔들림 (내 기기에만 저장) ----- */
let GS={vib:1,shake:1};
try{GS=Object.assign(GS,JSON.parse(localStorage.getItem('gs')||'{}'))}catch(e){}
function toggleGs(k){GS[k]=GS[k]?0:1;try{localStorage.setItem('gs',JSON.stringify(GS))}catch(e){}renderSettings();if(GS[k]&&k==='vib')vib(40)}
function vib(ms){if(GS.vib&&typeof navigator!=='undefined'&&navigator.vibrate){try{navigator.vibrate(ms)}catch(e){}}}
function renderSettings(){
  const set=(id,on,label)=>{const b=$(id);if(b)b.textContent=(on?'✅ ':'⬜ ')+label+(on?' 켜짐':' 꺼짐')};
  set('setSfx',sfxOn,'🔊 효과음');set('setVib',!!GS.vib,'📳 진동');set('setShake',!!GS.shake,'💥 화면 흔들림');
}
{const _ts=toggleSfx;toggleSfx=function(){_ts.apply(this,arguments);renderSettings()}}
setTimeout(renderSettings,800);
