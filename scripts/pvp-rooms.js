/* ===================== PvP 열린 방 목록 + 참가 버튼 ===================== */
let lastPvpList=0;
async function loadPvpRooms(){
  const box=$('pvpRoomList');if(!box)return;
  if(user==='guest'||!online||!db){box.textContent='로그인하면 열린 방을 볼 수 있어요';return}
  lastPvpList=Date.now();box.textContent='불러오는 중...';
  try{
    const v=(await dbRef('pvpRooms').limitToLast(50).get()).val()||{},now=Date.now();
    const rows=Object.keys(v).map(k=>{
      const d=v[k]||{},ps=d.players||{},ids=Object.keys(ps);
      const fresh=ids.some(id=>now-(Number(ps[id]&&ps[id].ts)||0)<30*60*1000);
      return {k,d,ps,ids,fresh};
    }).filter(r=>r.ids.length>0&&r.ids.length<4&&r.fresh&&!(r.d.gameStart&&r.d.gameStart.status==='start'));
    if(!rows.length){box.textContent='지금 열린 방이 없어요. 아래에서 방을 만들면 친구 화면에 바로 보여요.';return}
    box.innerHTML=rows.map(r=>{
      const host=(r.ps[r.d.host]&&r.ps[r.d.host].name)||(r.ps[r.ids[0]]&&r.ps[r.ids[0]].name)||'?';
      const rk=String(r.k).startsWith('랭크전_'),mode=r.d.mode==='team'?'2대2 팀전':'개인전',mine=(typeof pvpRoom!=='undefined'&&pvpRoom===r.k);
      const enc=encodeURIComponent(r.k).replace(/'/g,'%27');
      return `<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;margin:4px 0;border-radius:10px;background:rgba(255,255,255,.07)"><span style="flex:1;min-width:0">${rk?'🏅 ':''}<b>${escH(r.k)}</b><br><small style="color:#9ca3af">방장 ${escH(host)} · ${mode} · ${r.ids.length}/4명</small></span>${mine?'<small>참가 중</small>':`<button class="green" onclick="joinListedPvp('${enc}')">참가</button>`}</div>`;
    }).join('');
  }catch(e){box.textContent='방 목록을 불러오지 못했어요. ('+(e&&(e.code||e.message)||'알 수 없음')+')'}
}
function joinListedPvp(enc){
  const name=decodeURIComponent(enc);
  const input=$('pvpRoomName');if(input)input.value=name;
  joinPvpRoom(name.startsWith('랭크전_'));
}
{const _stRooms=showTab;showTab=function(id){_stRooms(id);if(id==='battle'&&Date.now()-lastPvpList>8000)loadPvpRooms()}}
setInterval(()=>{try{if(typeof curTab!=='undefined'&&curTab==='battle'&&!pvpRoom&&document.visibilityState==='visible'&&Date.now()-lastPvpList>12000)loadPvpRooms()}catch(e){}},5000);
